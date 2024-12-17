require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require('fs');
const path = require('path');
const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionFlagsBits,
    EmbedBuilder
} = require('discord.js');
const { ticketWelcomeMessageAndEmbed } = require('../tickets/embeds');
const channelDeleteHandler = require('../tickets/channelDeleteHandler');

// Configuración de archivos
const rolesFilePath = path.join('tickets', 'ticketsJSON', 'allowedRoles.json');
const ticketsFilePath = path.join('tickets', 'ticketsJSON', 'activeTickets.json');
const configPath = path.join('tickets', 'ticketsJSON', 'channelConfig.json');

// Inicialización de archivos
let allowedRoles = {};
let activeTickets = {};
let channelConfig = {};

// Cargar o crear archivos de configuración
[
    { path: rolesFilePath, data: allowedRoles },
    { path: ticketsFilePath, data: activeTickets },
    { path: configPath, data: channelConfig }
].forEach(({ path: filePath, data }) => {
    if (fs.existsSync(filePath)) {
        Object.assign(data, JSON.parse(fs.readFileSync(filePath, 'utf8')));
    } else {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 4));
    }
});

function truncateTitle(title, maxLength = 100) {
    if (title.length <= maxLength) return title;
    return title.substr(0, title.lastIndexOf(' ', maxLength)) + '...';
}

module.exports = (client) => {
    // Función para generar título del ticket con IA
    async function generateTicketTitle(messages) {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Dados los siguientes mensajes de los clientes, sugiera un título para el ticket que no pase de las 2 palabras, por ejemplo si el cliente dice algo como "vengo a reclamar support" entonces el titulo seria "reclamo support" o simplemente seria "support" de titulo, tu unica respuesta a este mensaje sera con solo 2 palabras, esa respuesta sera leida por un script y se asignara dicha respuesta como titulo del ticket. client_messages: \n\n${messages.join('\n')}`;

        try {
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            return text.trim();
        } catch (error) {
            console.error("Error al generar el título:", error);
            return "Ticket Support";
        }
    }

    // Configuración inicial del botón de tickets
    client.once('ready', () => {
        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

            for (const guildId in config) {
                const channelId = config[guildId];
                const guild = client.guilds.cache.get(guildId);

                if (guild) {
                    const channel = guild.channels.cache.get(channelId);
                    if (channel) {
                        channel.messages.fetch({ limit: 10 })
                            .then(messages => {
                                const ticketMessage = messages.find(m =>
                                    m.components.length > 0 &&
                                    m.components[0].components.some(c => c.customId === 'create_ticket')
                                );

                                if (!ticketMessage) {
                                    const row = new ActionRowBuilder()
                                        .addComponents(
                                            new ButtonBuilder()
                                                .setCustomId('create_ticket')
                                                .setLabel('Crear Ticket')
                                                .setStyle(ButtonStyle.Secondary)
                                                .setEmoji('🎫')
                                        );

                                    const embed = new EmbedBuilder()
                                        .setDescription('🎫 ¿Tienes alguna consulta o problema? ¡Haz clic en el botón de abajo para abrir un ticket y te ayudaremos lo antes posible!')
                                        .setColor('#2F3136');

                                    channel.send({
                                        embeds: [embed],
                                        components: [row]
                                    });
                                }
                            });
                    }
                }
            }
        }
    });

    // Renombrar tickets con IA
    client.on('messageCreate', async (message) => {
        if (message.guild && message.channel && message.channel.name.startsWith('aeo-ticket-')) {
            const messages = await message.channel.messages.fetch({ limit: 7 });
            if (messages.size === 7) {
                const title = await generateTicketTitle(messages.map(m => m.content));
                const truncatedTitle = truncateTitle(title);
                message.channel.setName(truncatedTitle);
            }
        }

        // Comando para cerrar tickets
        if (message.channel.topic === 'Ticket de soporte' && message.content === ".close") {
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('confirm_close_ticket')
                        .setLabel('Cerrar Ticket')
                        .setStyle(ButtonStyle.Danger)
                        .setEmoji('🔒')
                );

            const embed = new EmbedBuilder()
                .setColor('#FF0000')
                .setTitle('🔒 Cierre de Ticket')
                .setDescription('Por favor, confirma que deseas cerrar este ticket.')
                .setFooter({ text: 'Esta acción no puede deshacerse.' });

            message.channel.send({ embeds: [embed], components: [row] });
        }
    });

    // Manejo de interacciones de botones
    client.on('interactionCreate', async interaction => {
        if (!interaction.isButton()) return;

        // Crear ticket
        if (interaction.customId === 'create_ticket') {
            try {
                // Primero enviamos un mensaje de "creando ticket" para reconocer la interacción
                await interaction.deferReply({ ephemeral: true });
                
                const guild = interaction.guild;
                const member = interaction.member;

                const rolesForGuild = allowedRoles[guild.id] || [];
                const rolePermissionOverwrites = rolesForGuild.map(roleId => ({
                    id: roleId,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
                }));

                if (!activeTickets[guild.id]) {
                    activeTickets[guild.id] = {};
                }

                if (activeTickets[guild.id][member.id]) {
                    const existingChannel = guild.channels.cache.get(activeTickets[guild.id][member.id]);
                    if (existingChannel) {
                        await interaction.editReply({
                            content: `Ya tienes un ticket abierto en <#${existingChannel.id}>. Por favor, utiliza ese ticket antes de crear uno nuevo.`,
                            ephemeral: true
                        });
                        return;
                    } else {
                        delete activeTickets[guild.id][member.id];
                        fs.writeFileSync(ticketsFilePath, JSON.stringify(activeTickets, null, 4));
                    }
                }

                const ticketCategory = guild.channels.cache.find(c => c.name === 'TICKETS' && c.type === ChannelType.GuildCategory);
                if (!ticketCategory) {
                    await interaction.editReply({
                        content: 'No se encontró la categoría "TICKETS". Por favor, crea una categoría llamada "TICKETS" primero.',
                        ephemeral: true
                    });
                    return;
                }

                const ticketChannel = await guild.channels.create({
                    name: `aeo-ticket-${member.user.username}`,
                    type: ChannelType.GuildText,
                    topic: 'Ticket de soporte',
                    parent: ticketCategory.id,
                    permissionOverwrites: [
                        {
                            id: guild.id,
                            deny: PermissionFlagsBits.ViewChannel
                        },
                        {
                            id: member.id,
                            allow: PermissionFlagsBits.ViewChannel | PermissionFlagsBits.SendMessages
                        },
                        ...rolePermissionOverwrites
                    ]
                });

                activeTickets[guild.id][member.id] = ticketChannel.id;
                fs.writeFileSync(ticketsFilePath, JSON.stringify(activeTickets, null, 4));

                const messageData = ticketWelcomeMessageAndEmbed(member.user, interaction.guildId);
                await ticketChannel.send({ content: messageData.content, embeds: [messageData.embed] });
                
                await interaction.editReply({
                    content: `¡Ticket creado exitosamente! <#${ticketChannel.id}>`,
                    ephemeral: true
                });
            } catch (error) {
                console.error("Error al crear el ticket:", error);
                if (!interaction.replied) {
                    try {
                        await interaction.reply({
                            content: 'Hubo un problema al crear el ticket. Por favor, inténtalo de nuevo.',
                            ephemeral: true
                        });
                    } catch (replyError) {
                        console.error("Error al enviar respuesta de error:", replyError);
                    }
                }
            }
        }

        // Confirmar cierre de ticket
        if (interaction.customId === 'confirm_close_ticket') {
            try {
                // Primero verificamos si es un canal de ticket
                if (interaction.channel.topic !== 'Ticket de soporte') {
                    await interaction.reply({
                        content: 'Este comando solo puede ser utilizado dentro de un canal de ticket.',
                        ephemeral: true
                    });
                    return;
                }

                await interaction.deferReply();
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle('🔒 Ticket Cerrado')
                    .setDescription('Este ticket será eliminado en 5 segundos...')
                    .setTimestamp();

                await interaction.editReply({ embeds: [embed] });

                // Usamos una promesa para manejar el timeout de manera más segura
                await new Promise(resolve => setTimeout(resolve, 5000));

                try {
                    await interaction.channel.delete();
                } catch (deleteError) {
                    console.error('Error al eliminar el canal:', deleteError);
                    if (!interaction.channel.deleted) {
                        await interaction.channel.send('Error al cerrar el ticket. Por favor, inténtalo de nuevo.');
                    }
                }
            } catch (error) {
                console.error('Error al cerrar el ticket:', error);
                if (!interaction.replied) {
                    try {
                        await interaction.reply({
                            content: 'Error al procesar la solicitud. Por favor, inténtalo de nuevo.',
                            ephemeral: true
                        });
                    } catch (replyError) {
                        console.error("Error al enviar respuesta de error:", replyError);
                    }
                }
            }
        }
    });

    // Manejar eliminación de canales
    channelDeleteHandler(client, activeTickets);
}; 