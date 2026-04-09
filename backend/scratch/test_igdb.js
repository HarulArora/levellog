import fetch from 'node-fetch'
import dotenv from 'dotenv'
dotenv.config()

async function test() {
    const tokenResponse = await fetch('https://id.twitch.tv/oauth2/token' +
        `?client_id=${process.env.IGDB_CLIENT_ID}` +
        `&client_secret=${process.env.IGDB_CLIENT_SECRET}` +
        `&grant_type=client_credentials`,
        { method: 'POST' }
    )
    const tokenData = await tokenResponse.json()
    const token = tokenData.access_token
    console.log('Token extracted')

    const response = await fetch('https://api.igdb.com/v4/games', {
        method: 'POST',
        headers: {
            'Client-ID': process.env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain'
        },
        body: 'fields name, rating, rating_count; where rating > 85 & rating_count > 500; limit 5;'
    })
    const data = await response.json()
    console.log('Data:', JSON.stringify(data, null, 2))
}

test().catch(console.error)
