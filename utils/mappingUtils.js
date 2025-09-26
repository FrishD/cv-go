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
    return degreeMap[hebrewDegree] || '';
}

function mapHours(hebrewHours) {
    // Handle direct mapping first
    if (hoursMap[hebrewHours]) {
        return hoursMap[hebrewHours];
    }
    // Handle numeric strings
    const hours = parseInt(hebrewHours, 10);
    if (!isNaN(hours)) {
        if (hours >= 35) return 'full_time';
        if (hours > 0) return 'part_time';
    }
    return '';
}

module.exports = {
    mapDegree,
    mapHours
};