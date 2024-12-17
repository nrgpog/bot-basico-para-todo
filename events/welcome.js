const { EmbedBuilder } = require('discord.js');

module.exports = (client) => {
    client.on('guildMemberAdd', async (member) => {
        const welcomeChannelId = "1316433789026566144";
        const welcomeChannel = member.guild.channels.cache.get(welcomeChannelId);
        
        if (!welcomeChannel) return;

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#2B2D31')
            .setTitle(`¡Bienvenido ${member.user.username}! 🎉`)
            .setDescription(`
            ¡Hola ${member}! Bienvenido a **${member.guild.name}**
            
            👋 Eres el miembro #${member.guild.memberCount}
            
            📜 No olvides leer las reglas del servidor
            🎮 Diviértete y disfruta tu estancia
            `)
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setTimestamp()
            .setFooter({ 
                text: `${member.guild.name} • Nuevo Miembro`, 
                iconURL: member.guild.iconURL({ dynamic: true })
            });

        try {
            await welcomeChannel.send({ 
                content: `¡${member} se ha unido al servidor! 🎊`,
                embeds: [welcomeEmbed] 
            });
        } catch (error) {
            console.error('Error al enviar mensaje de bienvenida:', error);
        }
    });
}; 