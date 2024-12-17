const { EmbedBuilder } = require('discord.js');

function ticketWelcomeMessageAndEmbed(user, guildId) {
    const embed = new EmbedBuilder()
        .setColor('#2F3136')
        .setTitle('🎫 Ticket de Soporte')
        .setDescription(`
            Hola ${user}, bienvenido al sistema de tickets.
            
            Por favor, describe tu consulta o problema con el mayor detalle posible.
            Un miembro del equipo te atenderá lo antes posible.

            Para cerrar este ticket, usa el comando \`.close\`
        `)
        .setTimestamp()
        .setFooter({ text: 'Sistema de Tickets' });

    return {
        content: '@here - Nuevo ticket creado',
        embed: embed
    };
}

module.exports = {
    ticketWelcomeMessageAndEmbed
}; 