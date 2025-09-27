/**
 * Service for masking sensitive data in strings.
 * This is used to hide information from unverified users.
 */

// Masks parts of a word, leaving the first and last characters visible.
// e.g., "important" -> "i*******t"
const maskWord = (word) => {
    if (word.length <= 2) {
        return '**'; // Mask short words completely
    }
    return word[0] + '*'.repeat(word.length - 2) + word[word.length - 1];
};

// Masks numbers, leaving first and last digits.
// e.g., "054-123-4567" -> "0**-***-***7"
const maskNumbers = (text) => {
    return text.replace(/\d/g, (match, offset, fullText) => {
        // Don't mask the first or last digit in a sequence of digits
        const isFirst = offset === 0 || !/\d/.test(fullText[offset - 1]);
        const isLast = offset === fullText.length - 1 || !/\d/.test(fullText[offset + 1]);
        if (isFirst || isLast) {
            return match;
        }
        return '*';
    });
};

// Masks email addresses.
// e.g., "test.email@example.com" -> "t********l@e********m"
const maskEmail = (email) => {
    const [localPart, domain] = email.split('@');
    if (!domain) {
        return maskWord(localPart);
    }
    const maskedLocalPart = maskWord(localPart);
    const maskedDomain = maskWord(domain);
    return `${maskedLocalPart}@${maskedDomain}`;
};

/**
 * Masks sensitive information in a given text string.
 * It masks:
 * - Email addresses
 * - Numbers (preserving first/last digits of sequences)
 * - Potential names (currently simple words, can be expanded)
 *
 * @param {string} text The text to mask.
 * @returns {string} The masked text.
 */
const maskSensitiveData = (text) => {
    if (!text || typeof text !== 'string') {
        return text;
    }

    let maskedText = text;

    // Mask emails first as they are specific patterns
    const emailRegex = /[\w.-]+@[\w.-]+\.\w+/g;
    maskedText = maskedText.replace(emailRegex, (email) => maskEmail(email));

    // Then, mask numbers
    maskedText = maskNumbers(maskedText);

    // Finally, mask words that could be names (simple approach)
    // This is a basic implementation and could be improved with more sophisticated name detection.
    // For now, we avoid masking very short words.
    const wordRegex = /\b[a-zA-Z\u0590-\u05FF]{4,}\b/g; // Words with 4+ chars (English & Hebrew)
    maskedText = maskedText.replace(wordRegex, (word) => {
        // Avoid re-masking parts of emails
        if (word.includes('*') || word.includes('@')) {
            return word;
        }
        return maskWord(word);
    });

    return maskedText;
};

module.exports = {
    maskSensitiveData,
};