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

    const response = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
            'Client-ID': process.env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain'
        },
        body: `
      search "${query}";
      fields name, cover.url, genres.name, platforms.name,
             summary, first_release_date, rating;
      limit 20;
    `
    })

    const data = await response.json()

    return data.map(game => {

        const cover = game.cover?.url
            ? game.cover.url
                .replace('t_thumb', 't_cover_big')
                .replace('//', 'https://')
            : null

        const platforms = game.platforms?.map(p => {
            const name = p.name
            if (name.includes('PC')) return 'PC'
            if (name.includes('PlayStation 5')) return 'PS5'
            if (name.includes('PlayStation 4')) return 'PS4'
            if (name.includes('PlayStation')) return 'PS'
            if (name.includes('Xbox Series')) return 'Xbox Series'
            if (name.includes('Xbox One')) return 'Xbox One'
            if (name.includes('Xbox')) return 'Xbox'
            if (name.includes('Nintendo Switch')) return 'Switch'
            if (name.includes('iOS') || name.includes('Android')) return 'Mobile'
            return null
        }).filter(Boolean) || []

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