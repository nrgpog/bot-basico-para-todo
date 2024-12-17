const { SlashCommandBuilder } = require('@discordjs/builders');
const { CommandInteraction } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Muestra una lista de comandos disponibles'),

    /**
     * @param {CommandInteraction} interaction
     */
    async execute(interaction) {
        const helpMessage = [
            '# Lista de Comandos:',
            '',
            '## "CC Checker" Sistema:',
            '</ccchecker:0> - **Generador y Verificador de Tarjetas**',
            '• Formato del BIN: `42668415xxxxxxxx` (8 números + 8 "x")',
            '• Genera hasta 10 tarjetas por comando',
            '• Incluye información detallada del BIN',
            '• Botón de verificación integrado',
            '• Formato de salida: `Número|MM|YYYY|CVV`',
            '',
            '## "SystemTickets" Comandos:',
            '.close - **Cierra un ticket**',
            '**Slash Commands:** </ticketid:1203882843999043705>, </roleset:1203882843542126609>',
            '',
            '## "Antiwebhook":',
            '</antiwebhook:1206762599375437835> - **Para evitar raids**',
            '',
            '## "Minijuego de Adivinanzas":',
            '!startgame - **Inicia una nueva ronda del juego de adivinanzas**',
            '!addimage - **[Admin] Agrega una nueva imagen al juego**',
            '',
            '**Características del juego:**',
            '• Imágenes pixeladas con 3 niveles de dificultad',
            '• Sistema de puntos: Fácil (5), Media (10), Difícil (15)',
            '• Tabla de clasificación con los mejores jugadores',
            '• Una oportunidad por ronda para adivinar',
            '',
            '## "Extras":',
            '</help:0> - **Muestra este mensaje de ayuda**',
            '',
            '## "Configuración":',
            'El bot cuenta con:',
            '• Sistema de Bienvenidas',
            '• Sistema Anti-Webhook',
            '• Sistema de Tickets',
            '• Sistema de Minijuegos',
            '• Sistema de CC Checker'
        ].join('\n');

        await interaction.reply({ content: helpMessage, ephemeral: true });
    },
}; 