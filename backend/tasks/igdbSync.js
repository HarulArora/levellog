import cron from 'node-cron'
import GlobalList from '../models/GlobalList.js'
import { getAccessToken } from '../utils/igdb.js'
import { normalizeCover } from '../utils/helpers.js'
import logger from '../utils/logger.js'
import apiClient from '../utils/apiClient.js'

/**
 * IGDB Synchronization Task
 * Fetches global game lists from IGDB and persists them to MongoDB.
 */
export const syncIGDBLists = async () => {
    logger.info('[Sync] Starting IGDB global lists sync...')
    
    try {
        const token = await getAccessToken()
        const now = Math.floor(Date.now() / 1000)
        
        const headers = {
            'Client-ID': process.env.IGDB_CLIENT_ID,
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'text/plain'
        }

        const endpoints = [
            {
                key: 'trending',
                body: 'fields name, cover.url, genres.name, rating, rating_count; where rating > 85 & rating_count > 500 & cover != null & genres != null; sort rating_count desc; limit 15;'
            },
            {
                key: 'top-rated',
                body: 'fields name, cover.url, genres.name, rating, rating_count; where rating > 90 & rating_count > 200 & cover != null & genres != null; sort rating desc; limit 15;'
            },
            {
                key: 'coming-soon',
                body: `fields name, first_release_date, cover.url, rating, rating_count, summary, genres.name; where first_release_date >= ${now} & cover != null; sort first_release_date asc; limit 15;`
            }
        ]

        for (const config of endpoints) {
            const response = await apiClient.post('https://api.igdb.com/v4/games', config.body, { headers });

            const data = response.data || []
            
            const normalizedGames = data.map(g => ({
                id: g.id,
                title: g.name,
                cover: normalizeCover(g.cover?.url),
                genre: g.genres?.[0]?.name || 'Unknown',
                rating: g.rating ? (g.rating / 10).toFixed(1) : null,
                ratingCount: g.rating_count || 0,
                hypes: g.hypes || 0,
                releaseDate: g.first_release_date
                    ? new Date(g.first_release_date * 1000).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric'
                    })
                    : 'TBA'
            }))

            await GlobalList.findOneAndUpdate(
                { key: config.key },
                { 
                    games: normalizedGames,
                    lastUpdated: new Date()
                },
                { upsert: true, returnDocument: 'after' }
            )
            
            logger.info(`[Sync] Successfully updated ${config.key} (${normalizedGames.length} games)`)
        }

        logger.info('[Sync] IGDB global lists sync completed.')
    } catch (error) {
        logger.error('[Sync] Critical error during IGDB sync:', error)
    }
}

// Schedule: Every 6 hours
export const initCronJobs = () => {
    // 0 0 */6 * * * -> At minute 0, every 6 hours
    cron.schedule('0 0 */6 * * *', () => {
        syncIGDBLists()
    })
    
    // Also run once on startup
    syncIGDBLists()
}
