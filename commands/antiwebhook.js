const { SlashCommandBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, '../config.json');

// Crear archivo de configuración si no existe
if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify({ antiWebhook: {} }));
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('antiwebhook')
        .setDescription('Configura la protección anti-webhook')
        .addBooleanOption(option =>
            option.setName('activar')
                .setDescription('Activar o desactivar la protección anti-webhook')
                .setRequired(true)),

    async execute(interaction) {
        const activar = interaction.options.getBoolean('activar');
        const guildId = interaction.guildId;

        try {
            const config = JSON.parse(fs.readFileSync(configPath));
            
            config.antiWebhook[guildId] = activar;
            
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

            await interaction.reply({
                content: `La protección anti-webhook ha sido ${activar ? 'activada' : 'desactivada'} para este servidor.`,
                ephemeral: true
            });
        } catch (error) {
            console.error(error);
            await interaction.reply({
                content: 'Hubo un error al configurar la protección anti-webhook.',
                ephemeral: true
            });
        }
    },
}; 