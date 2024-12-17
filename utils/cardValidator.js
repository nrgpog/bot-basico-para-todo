const axios = require('axios');

class CardValidator {
    constructor() {
        this.binCache = new Map();
        this.lastCheck = new Map();
        this.rateLimit = 2000; // 2 segundos entre verificaciones
    }

    async getBinInfo(bin) {
        if (this.binCache.has(bin)) {
            return this.binCache.get(bin);
        }

        try {
            const response = await axios.get(`https://lookup.binlist.net/${bin}`, {
                headers: {
                    'Accept-Version': '3',
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            const binInfo = {
                scheme: response.data.scheme,
                type: response.data.type,
                brand: response.data.brand,
                bank: response.data.bank?.name || 'Unknown',
                country: response.data.country?.name || 'Unknown'
            };

            this.binCache.set(bin, binInfo);
            return binInfo;
        } catch (error) {
            console.error('Error obteniendo información del BIN:', error.message);
            return null;
        }
    }

    isValidExpiryDate(month, year) {
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;

        const expYear = parseInt(year);
        const expMonth = parseInt(month);

        if (isNaN(expYear) || isNaN(expMonth)) return false;
        if (expMonth < 1 || expMonth > 12) return false;
        if (expYear < currentYear) return false;
        if (expYear === currentYear && expMonth < currentMonth) return false;
        if (expYear > currentYear + 10) return false;

        return true;
    }

    isValidCVV(cvv, cardType = 'unknown') {
        const cvvLength = cvv.toString().length;
        if (cardType.toLowerCase() === 'amex') {
            return cvvLength === 4;
        }
        return cvvLength === 3;
    }

    async validateCard(cardNumber, expMonth, expYear, cvv) {
        // Verificar rate limit
        const now = Date.now();
        const lastCheckTime = this.lastCheck.get(cardNumber) || 0;
        if (now - lastCheckTime < this.rateLimit) {
            throw new Error('Por favor, espera unos segundos antes de verificar otra tarjeta.');
        }
        this.lastCheck.set(cardNumber, now);

        // Validaciones básicas
        if (!/^\d{13,19}$/.test(cardNumber)) {
            return {
                isValid: false,
                message: 'Número de tarjeta inválido'
            };
        }

        if (!this.isValidExpiryDate(expMonth, expYear)) {
            return {
                isValid: false,
                message: 'Fecha de expiración inválida'
            };
        }

        // Obtener información del BIN
        const bin = cardNumber.substring(0, 6);
        const binInfo = await this.getBinInfo(bin);

        if (!this.isValidCVV(cvv, binInfo?.scheme)) {
            return {
                isValid: false,
                message: 'CVV inválido'
            };
        }

        // Aquí podrías agregar más validaciones según necesites
        return {
            isValid: true,
            binInfo: binInfo,
            cardInfo: {
                number: cardNumber,
                expiry: `${expMonth}/${expYear}`,
                type: binInfo?.scheme || 'unknown',
                bank: binInfo?.bank || 'Unknown',
                country: binInfo?.country || 'Unknown'
            }
        };
    }
}

module.exports = new CardValidator(); 