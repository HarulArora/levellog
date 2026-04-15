import { shortPlatform, normalizeCover } from './helpers.js'

let cachedToken = null
let tokenExpiry = null

export const getAccessToken = async () => {

    if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
        return cachedToken
    }

    const response = await fetch(
        `https://id.twitch.tv/oauth2/token` +
        `?client_id=${process.env.IGDB_CLIENT_ID}` +
        `&client_secret=${process.env.IGDB_CLIENT_SECRET}` +
        `&grant_type=client_credentials`,
        { method: 'POST' }
    )

    const data = await response.json()

    cachedToken = data.access_token
    tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000

    return cachedToken
}

export const searchGames = async (query) => {

    const token = await getAccessToken()

    const sanitizedQuery = String(query).replace(/"/g, '\\"')
    const response = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
            'Client-ID': process.env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain'
        },
        body: `
      search "${sanitizedQuery}";
      fields name, cover.url, genres.name, platforms.name,
             summary, first_release_date, rating;
      limit 20;
    `
    })

    const data = await response.json()

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
            rating: game.rating
                ? (game.rating / 10).toFixed(1)
                : null
        }
    })
}