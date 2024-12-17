const axios = require('axios');
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

async function checkCreditCard(ccNumber, expMonth, expYear, cvc) {
    const xcheckerAPIURL = `https://www.xchecker.cc/api.php?cc=${ccNumber}|${expMonth}|${expYear}|${cvc}`;
    const headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.80 Safari/537.36",
        "Accept": "*/*",
    };

    try {
        const response = await axios.get(xcheckerAPIURL, { headers, validateStatus: false });

        if (response.status === 200 && response.headers['content-type'].includes('json')) {
            const data = response.data;
            if (data.ccNumber) {
                const output = {
                    ccNumber: data.ccNumber,
                    bankName: data.bankName || '',
                    status: data.status,
                    details: data.details
                };
                return output;
            } else {
                console.log(`Error no especificado para ${ccNumber}`, data);
                return `${ccNumber} => ${data.error || 'Error no especificado'}`;
            }
        } else {
            console.log(`Error HTTP: ${response.status}`, response.data);
            return `HTTP service error: ${response.status}, retry...`;
        }
    } catch (error) {
        console.error('Excepción al hacer la solicitud:', error);
        return 'Error making request';
    }
}


module.exports.checkCreditCard = checkCreditCard;