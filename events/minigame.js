const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');
const Jimp = require('jimp');
const fs = require('fs');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const {
    GoogleGenerativeAI,
    HarmCategory,
    HarmBlockThreshold,
} = require("@google/generative-ai");

// Asegurarse de que existen los directorios y archivos necesarios
const imagesDir = path.join(__dirname, '..', 'images');
if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir);
}

const gameDataPath = path.join(__dirname, '..', 'gameData.json');
if (!fs.existsSync(gameDataPath)) {
    fs.writeFileSync(gameDataPath, '[]');
}

const scoresPath = path.join(__dirname, '..', 'scores.json');
if (!fs.existsSync(scoresPath)) {
    fs.writeFileSync(scoresPath, '{}');
}

// Función para obtener/actualizar puntuaciones
function getScores() {
    try {
        return JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
    } catch (error) {
        return {};
    }
}

function updateScore(userId, points) {
    const scores = getScores();
    scores[userId] = (scores[userId] || 0) + points;
    fs.writeFileSync(scoresPath, JSON.stringify(scores, null, 2));
    return scores[userId];
}

function getTopScores(limit = 10) {
    const scores = getScores();
    return Object.entries(scores)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limit);
}

// Función para truncar texto
function truncateText(text, maxLength = 75) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
}

// Sistema de seguimiento de imágenes usadas recientemente
const recentlyUsedImages = new Set();

// Función para seleccionar una imagen aleatoria evitando repeticiones
function selectRandomGame(gameData) {
    // Si todas las imágenes han sido usadas recientemente, reiniciar
    if (recentlyUsedImages.size >= gameData.length) {
        recentlyUsedImages.clear();
    }

    // Filtrar las imágenes que no se han usado recientemente
    const availableGames = gameData.filter((_, index) => !recentlyUsedImages.has(index));
    
    // Seleccionar una imagen aleatoria de las disponibles
    const randomIndex = Math.floor(Math.random() * availableGames.length);
    const selectedGameIndex = gameData.indexOf(availableGames[randomIndex]);
    
    // Marcar la imagen como usada recientemente
    recentlyUsedImages.add(selectedGameIndex);
    
    return gameData[selectedGameIndex];
}

module.exports = (client) => {
    const gameMessages = new Map();

    client.on('messageCreate', async (message) => {
        if (message.content === '!startgame') {
            console.log('Comando !startgame recibido');
            try {
                const gameData = JSON.parse(fs.readFileSync(gameDataPath, 'utf8'));
                if (gameData.length === 0) {
                    await message.reply('No hay imágenes disponibles para el juego. Utiliza el comando `!addimage` para agregar imágenes.');
                    return;
                }

                const selectedGame = selectRandomGame(gameData);
                const imagePath = selectedGame.imagePath;
                const options = selectedGame.options;
                const correctOption = selectedGame.correctOption;

                if (!fs.existsSync(imagePath)) {
                    await message.reply('Error: La imagen seleccionada ya no existe. Por favor, intenta de nuevo.');
                    return;
                }

                // Generar dificultad aleatoria
                const difficulties = [
                    { name: 'Fácil', pixelate: 8, points: 5 },
                    { name: 'Media', pixelate: 12, points: 10 },
                    { name: 'Difícil', pixelate: 16, points: 15 }
                ];
                const difficulty = difficulties[Math.floor(Math.random() * difficulties.length)];

                const cleanedOptions = options.map(option => option.replace(/-/g, '').trim());
                const uniqueOptions = [...new Set(cleanedOptions)];

                const image = await Jimp.read(imagePath);
                // Ajustar tamaño para mejor visibilidad
                image.scaleToFit(512, 512)
                     .quality(100)
                     .pixelate(difficulty.pixelate);
                const buffer = await image.getBufferAsync(Jimp.MIME_PNG);

                const embed = new EmbedBuilder()
                    .setTitle(`¿Qué imagen es esta? (${difficulty.name} - ${difficulty.points} puntos)`)
                    .setDescription('Adivina qué se muestra en la imagen pixelada\n⚠️ ¡Solo tienes una oportunidad!')
                    .setColor('#2B2D31')
                    .setImage('attachment://pixelated.png');

                // Botones de opciones
                const optionsRow = new ActionRowBuilder()
                    .addComponents(
                        uniqueOptions.map((option, index) =>
                            new ButtonBuilder()
                                .setCustomId(`option${index + 1}`)
                                .setLabel(truncateText(option))
                                .setStyle(ButtonStyle.Primary)
                        )
                    );

                // Botón de puntuaciones
                const scoresRow = new ActionRowBuilder()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId('showScores')
                            .setLabel('Ver Puntuaciones 🏆')
                            .setStyle(ButtonStyle.Secondary)
                    );

                const sentMessage = await message.channel.send({
                    embeds: [embed],
                    files: [{ attachment: buffer, name: 'pixelated.png' }],
                    components: [optionsRow, scoresRow]
                });

                gameMessages.set(sentMessage.id, { ...selectedGame, difficulty });
            } catch (error) {
                console.error('Error al procesar la imagen:', error);
                await message.reply('Ocurrió un error al iniciar el juego. Por favor, inténtalo de nuevo.');
            }
        }

        if (message.content === '!addimage') {
            console.log('Comando !addimage recibido');
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                await message.reply('Solo los administradores pueden agregar imágenes al juego.');
                return;
            }

            const attachment = message.attachments.first();
            if (!attachment) {
                await message.reply('Por favor, adjunta una imagen al comando.');
                return;
            }

            try {
                const imagePath = path.join(imagesDir, `${Date.now()}.png`);
                const fetchResponse = await fetch(attachment.url);
                
                if (!fetchResponse.ok) {
                    throw new Error(`Error al descargar la imagen: ${fetchResponse.statusText}`);
                }

                const imageBuffer = await fetchResponse.buffer();
                fs.writeFileSync(imagePath, imageBuffer);

                if (!process.env.GEMINI_API_KEY) {
                    throw new Error('No se ha configurado la API key de Gemini');
                }

                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({
                    model: "gemini-1.5-flash",
                    safetySettings: [
                        {
                            category: HarmCategory.HARM_CATEGORY_HARASSMENT,
                            threshold: HarmBlockThreshold.BLOCK_NONE,
                        },
                        {
                            category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
                            threshold: HarmBlockThreshold.BLOCK_NONE,
                        },
                        {
                            category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
                            threshold: HarmBlockThreshold.BLOCK_NONE,
                        },
                        {
                            category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                            threshold: HarmBlockThreshold.BLOCK_NONE,
                        },
                    ]
                });

                const prompt = `Analiza esta imagen y genera 4 opciones CORTAS (máximo 75 caracteres cada una) para un juego de adivinanzas.

Reglas:
- La opción correcta debe empezar con doble guión (--)
- Las opciones incorrectas deben empezar con un solo guión (-)
- Cada opción debe ser única y claramente distinguible
- Usa descripciones BREVES pero específicas
- MÁXIMO 75 CARACTERES por opción

Ejemplo de formato:
-- Gato siamés dormido
- Perro labrador negro
- Conejo blanco saltando
- Zorro rojo cazando

Las opciones deben ser CORTAS pero descriptivas.`;

                const image = {
                    inlineData: {
                        data: imageBuffer.toString("base64"),
                        mimeType: "image/png",
                    },
                };

                const result = await model.generateContent([prompt, image]);
                const aiResponse = await result.response;
                const text = aiResponse.text();

                const options = text.split('\n')
                    .map(option => option.trim())
                    .filter(option => option.startsWith('-'));

                // Validación mejorada de las opciones
                if (options.length < 4) {
                    throw new Error('La IA no generó suficientes opciones válidas');
                }

                const correctOption = options.find(option => option.startsWith('--'));
                if (!correctOption) {
                    throw new Error('La IA no generó una opción correcta válida');
                }

                const cleanedCorrectOption = correctOption.replace(/-/g, '').trim();
                const incorrectOptions = options
                    .filter(option => !option.startsWith('--'))
                    .map(option => option.replace(/-/g, '').trim());

                // Validación adicional
                if (incorrectOptions.length < 3) {
                    throw new Error('No se generaron suficientes opciones incorrectas');
                }

                // Verificar que las opciones sean suficientemente diferentes
                const allOptions = [cleanedCorrectOption, ...incorrectOptions];
                const uniqueWords = new Set(allOptions.map(opt => opt.toLowerCase()));
                if (uniqueWords.size < 4) {
                    throw new Error('Las opciones generadas son demasiado similares');
                }

                const gameData = {
                    imagePath,
                    options: allOptions,
                    correctOption: cleanedCorrectOption
                };

                const existingData = JSON.parse(fs.readFileSync(gameDataPath, 'utf8'));
                existingData.push(gameData);
                fs.writeFileSync(gameDataPath, JSON.stringify(existingData, null, 2));

                await message.reply('¡La imagen ha sido analizada y agregada al juego correctamente!');
            } catch (error) {
                console.error("Error al analizar la imagen:", error);
                await message.reply(`Error: ${error.message || 'Hubo un error al analizar la imagen. Por favor, inténtalo de nuevo.'}`);
                
                // Limpieza en caso de error
                if (imagePath && fs.existsSync(imagePath)) {
                    try {
                        fs.unlinkSync(imagePath);
                    } catch (cleanupError) {
                        console.error('Error al limpiar archivo temporal:', cleanupError);
                    }
                }
            }
        }
    });

    client.on('interactionCreate', async (interaction) => {
        if (interaction.isButton()) {
            if (interaction.customId === 'showScores') {
                const topScores = await getTopScores();
                const scoreList = await Promise.all(topScores.map(async ([userId, score], index) => {
                    try {
                        const user = await client.users.fetch(userId);
                        return `${index + 1}. ${user.username}: ${score} puntos`;
                    } catch {
                        return `${index + 1}. Usuario Desconocido: ${score} puntos`;
                    }
                }));

                const embed = new EmbedBuilder()
                    .setTitle('🏆 Tabla de Puntuaciones')
                    .setDescription(scoreList.length > 0 ? scoreList.join('\n') : 'No hay puntuaciones aún')
                    .setColor('#FFD700');

                await interaction.reply({ embeds: [embed], ephemeral: true });
                return;
            }

            if (interaction.customId.startsWith('option')) {
                const gameMessage = gameMessages.get(interaction.message.id);

                if (!gameMessage) {
                    await interaction.reply({
                        content: 'No se encontró el juego correspondiente. Por favor, inicia uno nuevo.',
                        ephemeral: true
                    });
                    return;
                }

                const correctOption = gameMessage.correctOption;
                const selectedLabel = interaction.component.label;
                const difficulty = gameMessage.difficulty;

                if (selectedLabel === correctOption) {
                    const newScore = updateScore(interaction.user.id, difficulty.points);
                    const embed = new EmbedBuilder()
                        .setTitle('🎉 ¡Correcto!')
                        .setDescription(`Has ganado ${difficulty.points} puntos\nTu puntuación total: ${newScore} puntos`)
                        .setColor('#00FF00');

                    await interaction.reply({ embeds: [embed], ephemeral: false });
                    
                    // Desactivar solo los botones de opciones
                    const disabledButtons = interaction.message.components.map((row, index) => {
                        const newRow = new ActionRowBuilder();
                        row.components.forEach(button => {
                            if (index === 0) { // Primera fila (botones de opciones)
                                newRow.addComponents(
                                    ButtonBuilder.from(button).setDisabled(true)
                                );
                            } else { // Segunda fila (botón de puntuaciones)
                                newRow.addComponents(
                                    ButtonBuilder.from(button).setDisabled(false)
                                );
                            }
                        });
                        return newRow;
                    });

                    await interaction.message.edit({ components: disabledButtons });
                    gameMessages.delete(interaction.message.id);
                } else {
                    const embed = new EmbedBuilder()
                        .setTitle('❌ ¡Incorrecto!')
                        .setDescription(`La respuesta correcta era: ${correctOption}`)
                        .setColor('#FF0000');

                    await interaction.reply({ embeds: [embed], ephemeral: false });
                    
                    // Desactivar solo los botones de opciones
                    const disabledButtons = interaction.message.components.map((row, index) => {
                        const newRow = new ActionRowBuilder();
                        row.components.forEach(button => {
                            if (index === 0) { // Primera fila (botones de opciones)
                                newRow.addComponents(
                                    ButtonBuilder.from(button).setDisabled(true)
                                );
                            } else { // Segunda fila (botón de puntuaciones)
                                newRow.addComponents(
                                    ButtonBuilder.from(button).setDisabled(false)
                                );
                            }
                        });
                        return newRow;
                    });

                    await interaction.message.edit({ components: disabledButtons });
                    gameMessages.delete(interaction.message.id);
                }
            }
        }
    });
}; 