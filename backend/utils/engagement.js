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

        // Permanent fix: Extract the session if it's passed as an options object { session }
        const actualSession = (sessionOrOptions && typeof sessionOrOptions === 'object' && 'session' in sessionOrOptions)
            ? sessionOrOptions.session
            : sessionOrOptions;

        await EngagementEvent.create([{
            contentId: String(contentId),
            contentType,
            eventType,
            userId,
            timestamp: new Date()
        }], { session: actualSession });
    } catch (error) {
        // Silently fail logging to prevent blocking the main user action
        logger.error('[Engagement] Failed to log event:', error);
    }
};
