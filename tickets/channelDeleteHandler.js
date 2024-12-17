const fs = require('fs');
const path = require('path');

module.exports = (client, activeTickets) => {
    client.on('channelDelete', async channel => {
        if (channel.topic === 'Ticket de soporte') {
            const guildId = channel.guild.id;
            if (activeTickets[guildId]) {
                // Encontrar y eliminar el ticket del registro
                const userId = Object.entries(activeTickets[guildId])
                    .find(([_, channelId]) => channelId === channel.id)?.[0];

                if (userId) {
                    delete activeTickets[guildId][userId];
                    const ticketsFilePath = path.join('tickets', 'ticketsJSON', 'activeTickets.json');
                    fs.writeFileSync(ticketsFilePath, JSON.stringify(activeTickets, null, 4));
                }
            }
        }
    });
}; 