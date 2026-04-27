import cron from 'node-cron';
import { calculateTopRated, calculateTrending, calculateComingSoon } from '../utils/rankings.js';
import logger from '../utils/logger.js';

const CONTENT_TYPES = ['game', 'movie', 'tv', 'anime', 'manga'];

export const syncAllRankings = async () => {
    logger.info('[Sync] Starting full rankings recalculation...');
    
    for (const type of CONTENT_TYPES) {
        try {
            await calculateTopRated(type);
            await calculateTrending(type);
            if (type !== 'manga') await calculateComingSoon(type);
        } catch (error) {
            logger.error(`[Sync] Failed to calculate rankings for ${type}:`, error);
        }
    }
    
    logger.info('[Sync] Full rankings recalculation completed.');
};

export const initRankingCrons = () => {
    // Trending every 1 hour
    cron.schedule('0 * * * *', async () => {
        logger.info('[Cron] Running hourly trending update...');
        for (const type of CONTENT_TYPES) {
            try {
                await calculateTrending(type);
            } catch (err) {
                logger.error(`[Cron] Trending failed for ${type}:`, err);
            }
        }
    });

    // Top Rated & Coming Soon every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        logger.info('[Cron] Running 6-hourly ranking update...');
        for (const type of CONTENT_TYPES) {
            try {
                await calculateTopRated(type);
                if (type !== 'manga') await calculateComingSoon(type);
            } catch (err) {
                logger.error(`[Cron] Ranking failed for ${type}:`, err);
            }
        }
    });

    // Run once on startup
    syncAllRankings();
};
