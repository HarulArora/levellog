import cron from 'node-cron';
import User from '../models/User.js';
import Game from '../models/Game.js';
import MovieEntry from '../models/MovieEntry.js';
import AnimeEntry from '../models/AnimeEntry.js';
import GameLike from '../models/GameLike.js';
import MovieLike from '../models/MovieLike.js';
import AnimeLike from '../models/AnimeLike.js';
import Comment from '../models/Comment.js';
import AnimeComment from '../models/AnimeComment.js';
import MovieComment from '../models/MovieComment.js';
import Follow from '../models/Follow.js';
import logger from '../utils/logger.js';
import { getLevelInfo } from '../utils/xp.js';

/**
 * 🛡️ Platform-wide XP Audit
 * This task recalculates the 'Truth' for every user's XP based on their actual database entries.
 * It corrects discrepancies caused by failed transactions, race conditions, or manual deletions.
 */
export const syncAllUsersXP = async () => {
    logger.info('[XP Sync] Starting platform-wide XP audit...');
    try {
        const users = await User.find({});
        let correctionCount = 0;

        for (const user of users) {
            // 1. Fetch counts across all engagement models
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

            // ── CATEGORY BREAKDOWN ──
            
            // 1. Logging (+1 XP per item)
            const logXP = games.length + movies.length + anime.length;
            expectedXP += logXP;

            // 2. Rating (+1 XP per item with rating > 0)
            const ratingXP = 
                games.filter(g => (g.rating || 0) > 0).length +
                movies.filter(m => (m.rating || 0) > 0).length +
                anime.filter(a => (a.rating || 0) > 0).length;
            expectedXP += ratingXP;

            // 3. Media Liking (+1 XP)
            const likeXP = gameLikes.length + movieLikes.length + animeLikes.length;
            expectedXP += likeXP;

            // 4. Commenting (+1 XP)
            const commentXP = gameComments.length + animeComments.length + movieComments.length;
            expectedXP += commentXP;

            // 5. Engagement (+1 XP for following, +1 XP for being followed)
            const socialXP = following.length + followers.length;
            expectedXP += socialXP;

            // 6. Safety Net: Minimum XP = Follower Count (As per auth.js logic)
            // If the user somehow has more followers than documented (legacy), we respect the count field
            const minXP = user.followerCount || 0;
            if (expectedXP < minXP) {
                expectedXP = minXP;
            }

            // 2. Update if out of sync
            if (user.xp !== expectedXP) {
                const { current } = getLevelInfo(expectedXP);
                
                await User.updateOne(
                    { _id: user._id },
                    { 
                        $set: { 
                            xp: expectedXP,
                            level: current.level,
                            badge: current.badge
                        } 
                    }
                );
                
                logger.info(`[XP Sync] Corrected @${user.username}: ${user.xp} -> ${expectedXP} XP | Breakdown: Logs(${logXP}), Ratings(${ratingXP}), Likes(${likeXP}), Comments(${commentXP}), Social(${socialXP})`);
                correctionCount++;
            }
        }

        logger.info(`[XP Sync] Audit complete. Corrected ${correctionCount} users.`);
    } catch (err) {
        logger.error('[XP Sync] Audit failed:', err);
    }
};

/**
 * Initialize XP Cron Jobs
 * Runs every day at midnight (0 0 * * *)
 */
export const initXPCron = () => {
    cron.schedule('0 0 * * *', () => {
        syncAllUsersXP();
    });
    
    logger.info('[XP Sync] Scheduled daily audit task.');
};
