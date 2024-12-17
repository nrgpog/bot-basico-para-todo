const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ticketid')
        .setDescription('Configura el canal donde aparecerá el botón de tickets')
        .addChannelOption(option =>
            option.setName('canal')
                .setDescription('El canal donde aparecerá el botón de tickets')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const channel = interaction.options.getChannel('canal');
        const configPath = path.join('tickets', 'ticketsJSON', 'channelConfig.json');
        
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        }

        config[interaction.guildId] = channel.id;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

        await interaction.reply({
            content: `El canal de tickets ha sido configurado en <#${channel.id}>. El botón aparecerá la próxima vez que se reinicie el bot.`,
            ephemeral: true
        });
    },
}; 