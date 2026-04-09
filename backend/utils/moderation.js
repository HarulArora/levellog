const OFFENSIVE_WORDS = [
    'fuck', 'shit', 'asshole', 'bitch', 'bastard', 'cunt', 'dick', 'pussy', 'nazi', 'racist',
    'retard', 'faggot', 'slut', 'whore', 'negro', 'kike', 'spic'
]

/**
 * Censories offensive words in a string.
 * Replaces them with asterisks (*).
 * @param {string} text 
 * @returns {string}
 */
export const censorText = (text) => {
    if (!text) return text
    let censored = text
    OFFENSIVE_WORDS.forEach(word => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi')
        censored = censored.replace(regex, (match) => '*'.repeat(match.length))
    })
    return censored
}
