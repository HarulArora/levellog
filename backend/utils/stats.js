import GlobalStats from '../models/GlobalStats.js';
import Game from '../models/Game.js';
import GameLike from '../models/GameLike.js';
import Wishlist from '../models/Wishlist.js';

import MediaStats from '../models/MediaStats.js';
import MovieEntry from '../models/MovieEntry.js';
import AnimeEntry from '../models/AnimeEntry.js';
import MovieLike from '../models/MovieLike.js';
import AnimeLike from '../models/AnimeLike.js';
import MovieWishlist from '../models/MovieWishlist.js';
import AnimeWishlist from '../models/AnimeWishlist.js';

/**
 * ── GAME STATS (LEGACY SYSTEM) ──
 */
export const updateGlobalStats = async (igdbId, delta) => {
    const { loggedCount = 0, wishlistCount = 0, likeCount = 0, ratingCount = 0, ratingValue = 0 } = delta;
    const stats = await GlobalStats.findOneAndUpdate(
        { igdbId },
        {
            $inc: {
                loggedCount,
                wishlistCount,
                likeCount,
                ratingCount,
                totalRatingSum: ratingValue
            }
        },
        { upsert: true, new: true }
    );
    if (stats.ratingCount > 0) {
        stats.avgRating = parseFloat((stats.totalRatingSum / stats.ratingCount).toFixed(1));
    } else {
        stats.avgRating = 0;
    }
    await stats.save();
};

export const syncGlobalStats = async (igdbId) => {
    const [logged, rated, likes, wish] = await Promise.all([
        Game.countDocuments({ igdbId }),
        Game.aggregate([
            { $match: { igdbId, rating: { $gt: 0 } } },
            { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: '$rating' } } }
        ]),
        GameLike.countDocuments({ igdbId }),
        Wishlist.countDocuments({ igdbId })
    ]);

    const r = rated[0] || { count: 0, sum: 0 };
    const avg = r.count > 0 ? parseFloat((r.sum / r.count).toFixed(1)) : 0;

    await GlobalStats.findOneAndUpdate(
        { igdbId },
        {
            loggedCount: logged,
            wishlistCount: wish,
            likeCount: likes,
            ratingCount: r.count,
            totalRatingSum: r.sum,
            avgRating: avg
        },
        { upsert: true }
    );
};

/**
 * ── MEDIA STATS (UNIFIED SYSTEM) ──
 */

/**
 * Performs a full recalculation for a media item (Sync).
 * Use this for background maintenance or initialization.
 */
export const syncMediaStats = async (externalId, type) => {
    try {
        const id = parseInt(externalId);
        const EntryModel = (type === 'movie' || type === 'tv') ? MovieEntry : AnimeEntry;
        const LikeModel = (type === 'movie' || type === 'tv') ? MovieLike : AnimeLike;
        const WishlistModel = (type === 'movie' || type === 'tv') ? MovieWishlist : AnimeWishlist;

        const [statsAgg, likeCount, wishlistCount] = await Promise.all([
            EntryModel.aggregate([
                { $match: { externalId: id, type } },
                { $group: { 
                    _id: '$externalId', 
                    totalRatingSum: { $sum: { $cond: [{ $gt: ['$rating', 0] }, '$rating', 0] } }, 
                    ratingCount: { $sum: { $cond: [{ $gt: ['$rating', 0] }, 1, 0] } }, 
                    loggedCount: { $sum: 1 } 
                }}
            ]),
            LikeModel.countDocuments({ externalId: id, type }),
            WishlistModel.countDocuments({ externalId: id, type })
        ]);

        const stats = statsAgg[0] || { totalRatingSum: 0, ratingCount: 0, loggedCount: 0 };
        const avgRating = stats.ratingCount > 0 ? parseFloat((stats.totalRatingSum / stats.ratingCount).toFixed(1)) : null;

        await MediaStats.findOneAndUpdate(
            { externalId: id, type },
            {
                avgRating,
                ratingCount: stats.ratingCount,
                totalRatingSum: stats.totalRatingSum,
                loggedCount: stats.loggedCount,
                likeCount,
                wishlistCount,
                updatedAt: new Date()
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('Sync Media Stats Error:', error);
    }
};

/**
 * Incremental update for O(1) performance during CRUD operations.
 */
export const updateMediaStats = async (externalId, type, delta = {}) => {
    try {
        const id = parseInt(externalId);
        const { loggedCount = 0, likeCount = 0, wishlistCount = 0, ratingCount = 0, ratingValue = 0 } = delta;

        // If no delta is provided, fallback to a full sync (legacy behavior)
        if (Object.keys(delta).length === 0) {
            return syncMediaStats(externalId, type);
        }

        const stats = await MediaStats.findOneAndUpdate(
            { externalId: id, type },
            {
                $inc: {
                    loggedCount,
                    likeCount,
                    wishlistCount,
                    ratingCount,
                    totalRatingSum: ratingValue
                },
                $set: { updatedAt: new Date() }
            },
            { upsert: true, new: true }
        );

        // Recalculate average based on new totals
        if (stats.ratingCount > 0) {
            stats.avgRating = parseFloat((stats.totalRatingSum / stats.ratingCount).toFixed(1));
        } else {
            stats.avgRating = null;
        }
        await stats.save();
    } catch (error) {
        console.error('Update Media Stats Error:', error);
        // On failure, trigger a full sync to heal the data
        syncMediaStats(externalId, type);
    }
};

export const getBulkStats = async (ids, type) => {
    if (!ids || ids.length === 0) return {};
    const statsList = await MediaStats.find({ 
        externalId: { $in: ids.map(id => parseInt(id)) }, 
        type 
    }).lean();

    const statsMap = {};
    statsList.forEach(s => {
        statsMap[s.externalId] = s;
    });
    return statsMap;
};
