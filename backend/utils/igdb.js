import apiClient from './apiClient.js'
export { shortPlatform, normalizeCover } from './helpers.js'

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

export const searchGames = async (query) => {
    const token = await getAccessToken()
    const sanitizedQuery = String(query).replace(/"/g, '\\"')
    
    try {
        const response = await apiClient.post('https://api.igdb.com/v4/games', `
            search "${sanitizedQuery}";
            fields name, cover.url, genres.name, platforms.name,
                   summary, first_release_date, rating;
            limit 20;
        `, {
            headers: {
                'Client-ID': process.env.IGDB_CLIENT_ID,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            },
            retry: 2,
            retryDelay: 1000
        })

        const data = response.data
        return data.map(game => {
            const cover = normalizeCover(game.cover?.url)
            const platforms = [...new Set(
                (game.platforms || [])
                    .map(p => shortPlatform(p.name))
                    .filter(Boolean)
            )]

            return {
                igdbId: game.id,
                title: game.name,
                cover,
                genre: game.genres?.[0]?.name || 'Unknown',
                genres: game.genres?.map(g => g.name) || [],
                platforms,
                summary: game.summary || '',
                releaseYear: game.first_release_date
                    ? new Date(game.first_release_date * 1000).getFullYear()
                    : null,
                rating: game.rating ? (game.rating / 10).toFixed(1) : null
            }
        })
    } catch (error) {
        console.error('IGDB Search Error:', error.message)
        throw error
    }
}