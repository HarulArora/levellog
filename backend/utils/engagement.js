import EngagementEvent from '../models/EngagementEvent.js';
import logger from './logger.js';

/**
 * Logs an engagement event for the trending algorithm.
 * @param {string} contentId - The external ID of the content (IGDB ID, TMDB ID, etc.)
 * @param {string} contentType - 'game', 'movie', 'tv', 'anime', 'manga'
 * @param {string} eventType - 'like', 'comment', 'wishlist', 'rating', 'view'
 * @param {string} userId - (Optional) The ID of the user who performed the action
 */
export const logEngagement = async (contentId, contentType, eventType, userId = null, sessionOrOptions = null) => {
    try {
        if (!contentId || !contentType || !eventType) return;

        // Weights matching the trending formula
        const weights = {
            like: 3,
            comment: 4,
            wishlist: 2,
            rating: 5,
            view: 1
        };
        const weight = weights[eventType] || 1;

        // Permanent fix: Extract the session if it's passed as an options object { session }
        const actualSession = (sessionOrOptions && typeof sessionOrOptions === 'object' && 'session' in sessionOrOptions)
            ? sessionOrOptions.session
            : sessionOrOptions;

        // Get the start of the current day
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await EngagementEvent.updateOne(
            { 
                contentId: String(contentId), 
                contentType, 
                date: today 
            },
            { 
                $inc: { dailyScore: weight } 
            },
            { 
                upsert: true,
                session: actualSession 
            }
        );
    } catch (error) {
        // Silently fail logging to prevent blocking the main user action
        logger.error('[Engagement] Failed to log event:', error);
    }
};
