// igdb.js
// This file handles getting access token from Twitch
// and making requests to IGDB API

import axios from 'axios'

// Store token in memory so we don't request it every time
let accessToken = null
let tokenExpiry = null


// ── GET ACCESS TOKEN ──
// IGDB uses OAuth2 — we need a token to make requests
// Token expires every 60 days — we refresh automatically
const getAccessToken = async () => {

    // If we have a valid token — reuse it
    if (accessToken && tokenExpiry && Date.now() < tokenExpiry) {
        return accessToken
    }

    // Request new token from Twitch
    const response = await axios.post(
        `https://id.twitch.tv/oauth2/token`,
        null,
        {
            params: {
                client_id: process.env.IGDB_CLIENT_ID,
                client_secret: process.env.IGDB_CLIENT_SECRET,
                grant_type: 'client_credentials'
            }
        }
    )

    // Save token and expiry time
    accessToken = response.data.access_token
    // expires_in is in seconds — convert to milliseconds
    tokenExpiry = Date.now() + (response.data.expires_in * 1000)

    return accessToken
}


// ── SEARCH GAMES ──
// Search IGDB for games matching a query
export const searchGames = async (query) => {
    const token = await getAccessToken()

    const response = await axios.post(
        'https://api.igdb.com/v4/games',
        // IGDB uses a special query language called Apicalypse
        `search "${query}";
     fields name, cover.url, genres.name, 
             platforms.name, summary, 
             first_release_date, rating;
     limit 6;
     where cover != null;`,
        {
            headers: {
                'Client-ID': process.env.IGDB_CLIENT_ID,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'text/plain'
            }
        }
    )

    // Format the data nicely
    return response.data.map(game => ({
        igdbId: game.id,
        title: game.name,
        // Fix cover URL — IGDB gives small thumbnails
        // Replace with bigger image
        cover: game.cover?.url
            ? game.cover.url
                .replace('t_thumb', 't_cover_big')
                .replace('//', 'https://')
            : null,
        genres: game.genres?.map(g => g.name) || [],
        platforms: game.platforms?.map(p => p.name) || [],
        summary: game.summary || '',
        releaseYear: game.first_release_date
            ? new Date(game.first_release_date * 1000).getFullYear()
            : null,
        rating: game.rating ? Math.round(game.rating / 10) : 0
    }))
}