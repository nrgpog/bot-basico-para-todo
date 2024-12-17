const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('virustotal')
        .setDescription('Analiza una URL usando VirusTotal')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('La URL a analizar')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply();
        const url = interaction.options.getString('url');
        
        try {
            const response = await axios.post('https://www.virustotal.com/vtapi/v2/url/scan', null, {
                params: {
                    apikey: process.env.VIRUSTOTAL_API_KEY,
                    url: url
                }
            });

            // Esperar 15 segundos para obtener resultados
            await new Promise(resolve => setTimeout(resolve, 15000));

            const results = await axios.get('https://www.virustotal.com/vtapi/v2/url/report', {
                params: {
                    apikey: process.env.VIRUSTOTAL_API_KEY,
                    resource: url
                }
            });

            const embed = new EmbedBuilder()
                .setTitle('Resultados del análisis de VirusTotal')
                .setColor('#00ff00')
                .addFields(
                    { name: 'URL analizada', value: url },
                    { name: 'Positivos', value: `${results.data.positives}/${results.data.total}` },
                    { name: 'Fecha de escaneo', value: new Date(results.data.scan_date).toLocaleString() }
                );

            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply('Hubo un error al analizar la URL.');
        }
    },
}; 