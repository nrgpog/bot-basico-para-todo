function generateCreditCardNumbers(binPattern, amount, expDate, cvv) {
    const cards = [];
    for (let i = 0; i < amount; i++) {
        let cardNumber = '';
        for (const char of binPattern) {
            if (char === 'x' && cardNumber.length < 15) {
                cardNumber += Math.floor(Math.random() * 10).toString();
            } else if (char !== 'x') {
                cardNumber += char;
            }
        }
        if (cardNumber.length > 15) {
            cardNumber = cardNumber.substring(0, 15);
        } else while (cardNumber.length < 15) {
            cardNumber += Math.floor(Math.random() * 10).toString();
        }
        cardNumber = applyLuhnAlgorithm(cardNumber);
        if (!valid_credit_card(cardNumber)) {
            i--;
            continue;
        }

        let expMonth, expYear;
        if (expDate) {
            [expMonth, expYear] = expDate.split('/');
            expMonth = expMonth === 'xx' || expMonth === 'rnd' ? generateRandomMonth() : expMonth;
            expYear = expYear === 'xxxx' || expYear === 'rnd' ? generateRandomYear() : expYear;
        } else {
            [expMonth, expYear] = generateExpDate().split('/');
        }
        const generatedCVV = cvv === 'xxx' || cvv === 'rnd' ? generateCVV() : cvv;

        const formattedCard = `${cardNumber}|${expMonth}|${expYear}|${generatedCVV}`;
        cards.push(formattedCard);
    }
    return cards;
}

function generateRandomMonth() {
    return ('0' + (Math.floor(Math.random() * 12) + 1)).slice(-2);
}

function generateRandomYear() {
    const currentYear = new Date().getFullYear();
    return (currentYear + Math.floor(Math.random() * 5) + 1).toString();
}
function generateCVV() {
    return Math.floor(100 + Math.random() * 900).toString();
}

function valid_credit_card(value) {
    if (/[^0-9-\s]+/.test(value)) return false;

    let nCheck = 0, bEven = false;
    value = value.replace(/\D/g, "");

    for (let n = value.length - 1; n >= 0; n--) {
        let cDigit = value.charAt(n),
            nDigit = parseInt(cDigit, 10);

        if (bEven && (nDigit *= 2) > 9) nDigit -= 9;

        nCheck += nDigit;
        bEven = !bEven;
    }

    return (nCheck % 10) == 0;
}

function applyLuhnAlgorithm(number) {
    let sum = 0;
    let shouldDouble = false;
    for (let i = number.length - 2; i >= 0; i--) {
        let digit = parseInt(number.charAt(i));

        if (shouldDouble) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }

        sum += digit;
        shouldDouble = !shouldDouble;
    }

    const mod = sum % 10;
    const luhnDigit = mod === 0 ? 0 : 10 - mod;
    return number + luhnDigit.toString();
}

function generateCVV() {
    return ('' + Math.floor(Math.random() * 1000)).padStart(3, '0');
}

function generateExpDate() {
    const currentYear = new Date().getFullYear();
    const year = Math.floor(Math.random() * 5) + currentYear;
    const month = ('0' + (Math.floor(Math.random() * 12) + 1)).slice(-2);
    return `${month}/${year}`;
}



module.exports.generateCreditCardNumbers = generateCreditCardNumbers;