/**
 * Shared Backend Helper Functions
 */

/**
 * Shortens IGDB platform names to common abbreviations for UI consistency.
 */
export const shortPlatform = (name) => {
    if (!name) return null;
    if (name.includes('PC') || name === 'Windows' || name === 'Linux' || name === 'Mac') return 'PC'
    if (name.includes('PlayStation 5')) return 'PS5'
    if (name.includes('PlayStation 4')) return 'PS4'
    if (name.includes('PlayStation 3')) return 'PS3'
    if (name.includes('PlayStation')) return 'PS'
    if (name.includes('Xbox Series')) return 'Xbox Series'
    if (name.includes('Xbox One')) return 'Xbox One'
    if (name.includes('Xbox')) return 'Xbox'
    if (name.includes('Nintendo Switch')) return 'Switch'
    if (name.includes('iOS') || name.includes('Android')) return 'Mobile'
    return null 
}

/**
 * Normalizes an IGDB cover URL and ensures it uses a specific size.
 */
export const normalizeCover = (url, size = 't_cover_big') => {
    if (!url) return null
    let fullUrl = typeof url === 'string' ? url : (url.url || null)
    if (!fullUrl) return null
    if (!fullUrl.startsWith('http')) fullUrl = 'https:' + fullUrl
    return fullUrl.replace(/t_[a-zA-Z0-9_]+/, size)
}
