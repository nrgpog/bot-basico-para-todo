const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cardGenerator = require('../utils/cardGenerator');
const cardValidator = require('../utils/cardValidator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ccchecker')
        .setDescription('Genera números de tarjetas de crédito')
        .addStringOption(option =>
            option.setName('bin')
                .setDescription('BIN en formato: 42668415xxxxxxxx')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('cantidad')
                .setDescription('Cantidad de tarjetas a generar (máximo 10)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(10)),

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            const bin = interaction.options.getString('bin');
            const amount = interaction.options.getInteger('cantidad');

            // Validar formato del BIN (8 números seguidos de 8 'x')
            const binPattern = /^\d{8}x{8}$/;
            if (!binPattern.test(bin)) {
                await interaction.editReply({
                    content: 'Formato de BIN inválido. Debe ser 8 números seguidos de 8 "x" (ejemplo: 42668415xxxxxxxx)',
                    ephemeral: true
                });
                return;
            }

            const generatedCards = cardGenerator.generateCards(bin, amount);
            
            // Obtener información del BIN para el primer número generado
            const firstCard = generatedCards[0];
            const binInfo = await cardValidator.getBinInfo(firstCard.number.substring(0, 6));

            const embed = new EmbedBuilder()
                .setColor('#2B2D31')
                .setTitle('🎲 Tarjetas Generadas')
                .setDescription('```\n' + generatedCards.map(card => card.formatted).join('\n') + '\n```');

            if (binInfo) {
                embed.addFields(
                    { name: 'Información del BIN', value: [
                        `Tipo: ${binInfo.scheme || 'Desconocido'}`,
                        `Marca: ${binInfo.brand || 'Desconocida'}`,
                        `Banco: ${binInfo.bank || 'Desconocido'}`,
                        `País: ${binInfo.country || 'Desconocido'}`
                    ].join('\n') }
                );
            }

            embed.setFooter({ text: 'Formato: Número|MM|YYYY|CVV' });

            // Crear botón para verificar
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`check_cards_${interaction.id}`)
                        .setLabel('Pasar a Checker')
                        .setStyle(ButtonStyle.Primary)
                        .setEmoji('✅')
                );

            const response = await interaction.editReply({
                embeds: [embed],
                components: [row]
            });

            // Crear colector de botones
            const collector = response.createMessageComponentCollector({
                time: 60000 // 1 minuto para usar el botón
            });

            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) {
                    await i.reply({
                        content: 'Solo quien generó las tarjetas puede verificarlas.',
                        ephemeral: true
                    });
                    return;
                }

                await i.deferUpdate();

                const checkEmbed = new EmbedBuilder()
                    .setColor('#2B2D31')
                    .setTitle('🔍 Verificando Tarjetas')
                    .setDescription('Resultados de la verificación:');

                let results = [];

                for (const card of generatedCards) {
                    try {
                        const result = await cardValidator.validateCard(
                            card.number,
                            card.exp.month,
                            card.exp.year,
                            card.cvv
                        );

                        results.push({
                            card: card.formatted,
                            isValid: result.isValid,
                            info: result.isValid ? {
                                type: result.cardInfo.type,
                                bank: result.cardInfo.bank,
                                country: result.cardInfo.country
                            } : { message: result.message }
                        });
                    } catch (error) {
                        results.push({
                            card: card.formatted,
                            isValid: false,
                            info: { message: 'Error en la verificación' }
                        });
                    }
                }

                const resultText = results.map(r => {
                    const status = r.isValid ? '✅' : '❌';
                    const info = r.isValid
                        ? `[${r.info.type}|${r.info.bank}|${r.info.country}]`
                        : `[${r.info.message}]`;
                    return `${status} ${r.card} ${info}`;
                }).join('\n');

                checkEmbed.setDescription('```\n' + resultText + '\n```');

                // Desactivar el botón después de usarlo
                row.components[0].setDisabled(true);

                await i.editReply({
                    embeds: [checkEmbed],
                    components: [row]
                });
            });

            collector.on('end', () => {
                if (!response.deleted) {
                    row.components[0].setDisabled(true);
                    interaction.editReply({
                        embeds: [embed],
                        components: [row]
                    }).catch(console.error);
                }
            });

        } catch (error) {
            console.error('Error en el comando ccchecker:', error);
            await interaction.editReply({
                content: `Error: ${error.message || 'Hubo un error al procesar tu solicitud. Por favor, intenta de nuevo.'}`,
                ephemeral: true
            });
        }
    },
};