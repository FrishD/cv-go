// utils/mappingUtils.js

const degreeMap = {
    '🎓 תואר ראשון': 'bachelor',
    '🎓 תואר שני': 'master',
    '📜 תעודת מקצוע': 'certificate',
    '🏛️ קורס מקצועי': 'professional_course',
    '🤔 אחר': 'other'
};

const hoursMap = {
    'משרה מלאה': 'full_time',
    'משרה חלקית': 'part_time',
    'גמיש': 'flexible',
    'אחר': 'other'
};

function mapDegree(hebrewDegree) {
    if (!hebrewDegree) return 'other';
    const cleanDegree = String(hebrewDegree).trim();

    // First, try a direct match
    if (degreeMap[cleanDegree]) {
        return degreeMap[cleanDegree];
    }

    // As a fallback, strip emojis/symbols and compare text
    const textOnlyInput = cleanDegree.replace(/[^\u0590-\u05FF\s]/g, '').trim();
    for (const key in degreeMap) {
        const textOnlyKey = key.replace(/[^\u0590-\u05FF\s]/g, '').trim();
        if (textOnlyKey === textOnlyInput && textOnlyInput !== '') {
            return degreeMap[key];
        }
    }

    return 'other';
}

function mapHours(hebrewHours) {
    if (!hebrewHours) return 'flexible'; // Default to flexible
    const hoursStr = String(hebrewHours).trim();

    // Check for string-based mapping first
    if (hoursMap[hoursStr]) {
        return hoursMap[hoursStr];
    }

    // Then check for numeric mapping
    const hours = parseInt(hoursStr, 10);
    if (!isNaN(hours)) {
        if (hours >= 35) return 'full_time';
        if (hours > 0) return 'part_time';
    }

    // Default for any other case (e.g. non-numeric string not in map)
    return 'flexible';
}

module.exports = {
    mapDegree,
    mapHours
};