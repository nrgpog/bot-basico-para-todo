const { SlashCommandBuilder } = require('@discordjs/builders');
const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('roleset')
        .setDescription('Configura los roles que tendrán acceso a los tickets')
        .addRoleOption(option =>
            option.setName('rol')
                .setDescription('El rol que tendrá acceso a los tickets')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('accion')
                .setDescription('Añadir o remover el rol')
                .setRequired(true)
                .addChoices(
                    { name: 'Añadir', value: 'add' },
                    { name: 'Remover', value: 'remove' }
                ))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const role = interaction.options.getRole('rol');
        const action = interaction.options.getString('accion');
        const rolesFilePath = path.join('tickets', 'ticketsJSON', 'allowedRoles.json');
        
        let allowedRoles = {};
        if (fs.existsSync(rolesFilePath)) {
            allowedRoles = JSON.parse(fs.readFileSync(rolesFilePath, 'utf8'));
        }

        if (!allowedRoles[interaction.guildId]) {
            allowedRoles[interaction.guildId] = [];
        }

        if (action === 'add') {
            if (!allowedRoles[interaction.guildId].includes(role.id)) {
                allowedRoles[interaction.guildId].push(role.id);
                await interaction.reply({
                    content: `El rol ${role.name} ha sido añadido a la lista de roles con acceso a tickets.`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `El rol ${role.name} ya tiene acceso a los tickets.`,
                    ephemeral: true
                });
                return;
            }
        } else {
            const index = allowedRoles[interaction.guildId].indexOf(role.id);
            if (index > -1) {
                allowedRoles[interaction.guildId].splice(index, 1);
                await interaction.reply({
                    content: `El rol ${role.name} ha sido removido de la lista de roles con acceso a tickets.`,
                    ephemeral: true
                });
            } else {
                await interaction.reply({
                    content: `El rol ${role.name} no tenía acceso a los tickets.`,
                    ephemeral: true
                });
                return;
            }
        }

        fs.writeFileSync(rolesFilePath, JSON.stringify(allowedRoles, null, 4));
    },
}; 