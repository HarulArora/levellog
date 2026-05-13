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
            await calculateComingSoon(type);
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

    // Top Rated every day at midnight
    cron.schedule('0 0 * * *', async () => {
        logger.info('[Cron] Running daily Top Rated update...');
        for (const type of CONTENT_TYPES) {
            try {
                await calculateTopRated(type);
            } catch (err) {
                logger.error(`[Cron] Top Rated failed for ${type}:`, err);
            }
        }
    });

    // Coming Soon every 3 days at 1 AM
    cron.schedule('0 1 */3 * *', async () => {
        logger.info('[Cron] Running 3-day Coming Soon update...');
        for (const type of CONTENT_TYPES) {
            try {
                await calculateComingSoon(type);
            } catch (err) {
                logger.error(`[Cron] Coming Soon failed for ${type}:`, err);
            }
        }
    });

    // Run once on startup
    syncAllRankings();
};
