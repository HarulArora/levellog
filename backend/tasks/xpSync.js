import cron from 'node-cron';
import User from '../models/User.js';
import Game from '../models/Game.js';
import MovieEntry from '../models/MovieEntry.js';
import AnimeEntry from '../models/AnimeEntry.js';
import MovieComment from '../models/MovieComment.js';
import GameLike from '../models/GameLike.js';
import MovieLike from '../models/MovieLike.js';
import AnimeLike from '../models/AnimeLike.js';
import Comment from '../models/Comment.js';
import AnimeComment from '../models/AnimeComment.js';
import Follow from '../models/Follow.js';
import { getLevelInfo } from '../utils/xp.js';
import logger from '../utils/logger.js';

/**
 * XP Synchronization Task
 * Audits all users and corrects XP/Levels based on current database truth.
 */
export const syncAllUsersXP = async () => {
    logger.info('[XP Sync] Starting platform-wide XP audit...');
    
    try {
        const users = await User.find({});
        let correctionsCount = 0;

        for (const user of users) {
            const [
                games, movies, anime,
                gameLikes, movieLikes, animeLikes,
                gameComments, animeComments, movieComments,
                following, followers
            ] = await Promise.all([
                Game.find({ userId: user._id }),
                MovieEntry.find({ userId: user._id }),
                AnimeEntry.find({ userId: user._id }),
                GameLike.find({ userId: user._id }),
                MovieLike.find({ userId: user._id }),
                AnimeLike.find({ userId: user._id }),
                Comment.find({ userId: user._id }),
                AnimeComment.find({ userId: user._id }),
                MovieComment.find({ userId: user._id }),
                Follow.find({ followerId: user._id }),
                Follow.find({ followingId: user._id })
            ]);

            let expectedXP = 0;
            
            // 1. Add to Pond (+1 XP)
            expectedXP += games.length + movies.length + anime.length;

            // 2. Rate (+1 XP if > 0)
            expectedXP += games.filter(g => (g.rating || 0) > 0).length;
            expectedXP += movies.filter(m => (m.rating || 0) > 0).length;
            expectedXP += anime.filter(a => (a.rating || 0) > 0).length;

            // 3. Like (+1 XP)
            expectedXP += gameLikes.length + movieLikes.length + animeLikes.length;

            // 4. Comment (+1 XP)
            expectedXP += gameComments.length + animeComments.length + movieComments.length;

            // 5. Follow Someone (+1 XP)
            expectedXP += following.length;

            // 6. Get Followed (+1 XP)
            expectedXP += followers.length;

            if (user.xp !== expectedXP) {
                const { current } = getLevelInfo(expectedXP);
                
                await User.findByIdAndUpdate(user._id, {
                    $set: {
                        xp: expectedXP,
                        level: current.level,
                        badge: current.badge
                    }
                });

                logger.info(`[XP Sync] Corrected @${user.username}: ${user.xp} -> ${expectedXP} XP (Level ${current.level})`);
                correctionsCount++;
            }
        }

        logger.info(`[XP Sync] Audit completed. ${correctionsCount} users corrected.`);
    } catch (error) {
        logger.error('[XP Sync] Critical error during audit:', error);
    }
};

/**
 * Initialize XP Cron Jobs
 * Runs every Sunday at midnight (0 0 * * 0)
 */
export const initXPCron = () => {
    // 0 0 * * * -> Every day at midnight
    cron.schedule('0 0 * * *', () => {
        syncAllUsersXP();
    });
    
    logger.info('[XP Sync] Scheduled daily audit task.');
};
