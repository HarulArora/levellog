import apiClient from './apiClient.js'
import { shortPlatform, normalizeCover } from './helpers.js'
export { shortPlatform, normalizeCover }

let cachedToken = null
let tokenExpiry = null

export const getAccessToken = async () => {
    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken
    }

    try {
        const params = new URLSearchParams()
        params.append('client_id', process.env.IGDB_CLIENT_ID)
        params.append('client_secret', process.env.IGDB_CLIENT_SECRET)
        params.append('grant_type', 'client_credentials')

        const response = await apiClient.post(
            'https://id.twitch.tv/oauth2/token',
            params,
            { retry: 2, retryDelay: 1000 }
        )

        const data = response.data
        cachedToken = data.access_token
        tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000
        return cachedToken
    } catch (error) {
        console.error('Failed to get IGDB access token:', error.message)
        throw error
    }
}

export const searchGames = async (query, page = 1, limit = 20) => {
    const token = await getAccessToken()
    const sanitizedQuery = String(query).replace(/"/g, '\\"')
    const offset = (page - 1) * limit
    
    const performQuery = async (body) => {
        return await apiClient.post('https://api.igdb.com/v4/games', body, {
            headers: {
                'Client-ID': process.env.IGDB_CLIENT_ID,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            retry: 1,
            retryDelay: 1000
        })
    }

    try {
        // 1. Primary: High-relevance search command
        let searchString = `search "${sanitizedQuery}";`
        let response = await performQuery(
            `${searchString} fields name, cover.url, genres.name, platforms.name, summary, first_release_date, rating; limit ${limit}; offset ${offset};`
        )

        // 2. Fallback: If no results, try pattern matching (better for partial matches)
        if (!response.data || response.data.length === 0) {
            searchString = `where name ~ *"${sanitizedQuery}"*;`
            response = await performQuery(
                `fields name, cover.url, genres.name, platforms.name, summary, first_release_date, rating; ${searchString} limit ${limit}; offset ${offset};`
            )
        }

        const data = response.data
        if (!Array.isArray(data)) return { results: [], total: 0, totalPages: 1 }

        const results = data.map(game => {
            const cover = normalizeCover(game.cover?.url)
            
            // 🚀 Defensive platform mapping
            const platforms = [...new Set(
                (Array.isArray(game.platforms) ? game.platforms : [])
                    .filter(p => p && typeof p === 'object' && p.name)
                    .map(p => shortPlatform(p.name))
                    .filter(Boolean)
            )]

            // 🚀 Defensive genre mapping
            const genreList = (Array.isArray(game.genres) ? game.genres : [])
                .filter(g => g && typeof g === 'object' && g.name)
                .map(g => g.name)

            // 🛡️ Ensure ID is always a number
            const numericId = parseInt(game.id)

            return {
                id: numericId,
                igdbId: numericId,
                title: game.name || 'Unknown Title',
                cover,
                genre: genreList[0] || 'Unknown',
                genres: genreList,
                platforms,
                summary: game.summary || '',
                year: game.first_release_date
                    ? new Date(game.first_release_date * 1000).getFullYear()
                    : null,
                rating: game.rating ? (game.rating / 10).toFixed(1) : null
            }
        }).filter(g => !isNaN(g.id)) // Last safety check

        // Fetch total count
        let total = 0
        try {
            const countRes = await apiClient.post('https://api.igdb.com/v4/games/count', searchString, {
                headers: {
                    'Client-ID': process.env.IGDB_CLIENT_ID,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'text/plain'
                }
            })
            total = countRes.data?.count || 0
        } catch (countErr) {
            console.error('Failed to fetch count for search:', countErr.message)
        }

        const totalPages = Math.ceil(total / limit) || 1

        return { results, total, totalPages }
    } catch (error) {
        console.error(`[IGDB Search Error] Query: "${query}" | Error:`, error.message)
        throw error
    }
}