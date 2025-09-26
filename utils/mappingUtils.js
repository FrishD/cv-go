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
    // Fallback to 'other' if the exact key is not found.
    return degreeMap[cleanDegree] || 'other';
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