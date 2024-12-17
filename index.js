const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent
    ]
});

client.commands = new Collection();

// Crear directorios necesarios si no existen
const commandsPath = path.join(__dirname, 'commands');
const ticketsPath = path.join(__dirname, 'tickets');
const ticketsJSONPath = path.join(ticketsPath, 'ticketsJSON');

[commandsPath, ticketsPath, ticketsJSONPath].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Cargar eventos
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(`./events/${file}`);
    event(client);
}

// Función para desplegar comandos
async function deployCommands() {
    try {
        console.log('Iniciando registro de comandos slash...');
        
        const commands = [];
        const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

        for (const file of commandFiles) {
            const command = require(`./commands/${file}`);
            commands.push(command.data.toJSON());
            client.commands.set(command.data.name, command);
        }

        const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('Comandos slash registrados exitosamente');
    } catch (error) {
        console.error('Error al registrar comandos:', error);
    }
}

// Evento ready
client.once('ready', async () => {
    console.log(`Bot listo como ${client.user.tag}`);
    await deployCommands(); // Desplegar comandos al iniciar
});

// Manejo de interacciones
client.on('interactionCreate', async interaction => {
    // Solo manejar comandos slash aquí
    if (interaction.isCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) return;

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            try {
                const reply = {
                    content: 'Hubo un error al ejecutar este comando.',
                    ephemeral: true
                };
                
                if (interaction.deferred || interaction.replied) {
                    await interaction.editReply(reply);
                } else {
                    await interaction.reply(reply);
                }
            } catch (replyError) {
                console.error('Error al enviar respuesta de error:', replyError);
            }
        }
    }
});

client.login(process.env.TOKEN);
