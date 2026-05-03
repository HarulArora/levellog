import Ranking from '../models/Ranking.js';
import EngagementEvent from '../models/EngagementEvent.js';
import Game from '../models/Game.js';
import AnimeEntry from '../models/AnimeEntry.js';
import MovieEntry from '../models/MovieEntry.js';
import MediaStats from '../models/MediaStats.js';
import GlobalList from '../models/GlobalList.js';
import apiClient from './apiClient.js';
import logger from './logger.js';

/**
 * BAYESIAN AVERAGE (MAL Formula)
 * W = (v * R + m * C) / (v + m)
 */
export const calculateTopRated = async (type) => {
    logger.info(`[Rankings] Calculating Top Rated for ${type}...`);
    
    const m = 25; // Minimum ratings threshold
    let stats;
    
    // 1. Get global mean (C)
    if (type === 'game') {
        const globalStats = await Game.aggregate([
            { $match: { rating: { $gt: 0 } } },
            { $group: { _id: null, avg: { $avg: '$rating' } } }
        ]);
        stats = globalStats[0]?.avg || 0;
    } else {
        const globalStats = await MediaStats.aggregate([
            { $match: { type: type, ratingCount: { $gt: 0 } } },
            { $group: { _id: null, avg: { $avg: '$avgRating' } } }
        ]);
        stats = globalStats[0]?.avg || 0;
    }
    const C = stats;

    // 2. Get all titles with their average rating and count
    let titles = [];
    if (type === 'game') {
        titles = await Game.aggregate([
            { $match: { rating: { $gt: 0 } } },
            { $group: { 
                _id: '$igdbId', 
                R: { $avg: '$rating' }, 
                v: { $sum: 1 },
                title: { $first: '$title' },
                cover: { $first: '$cover' },
                genre: { $first: '$genre' },
                year: { $first: '$year' }
            }},
            { $match: { v: { $gte: 1 } } } // We filter by m later in the formula
        ]);
    } else {
        const mediaData = await MediaStats.find({ type: type, ratingCount: { $gt: 0 } });
        // We need titles/covers from Entry models
        const EntryModel = type === 'anime' || type === 'manga' ? AnimeEntry : MovieEntry;
        const entries = await EntryModel.find({ externalId: { $in: mediaData.map(d => d.externalId) } });
        
        titles = mediaData.map(d => {
            const entry = entries.find(e => e.externalId === d.externalId);
            return {
                _id: d.externalId,
                R: d.avgRating,
                v: d.ratingCount,
                title: entry?.title,
                cover: entry?.cover,
                genres: entry?.genres
            };
        });
    }

    // 3. Apply formula and sort
    const ranked = titles.map(t => {
        const v = t.v;
        const R = t.R;
        const score = (v * R + m * C) / (v + m);
        return {
            contentId: String(t._id),
            contentType: type,
            rankType: 'top_rated',
            score: parseFloat(score.toFixed(3)),
            title: t.title,
            cover: t.cover,
            genres: t.genres || [t.genre],
            avgRating: t.R,
            year: t.year
        };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 100)
    .map((item, index) => ({ ...item, rankPosition: index + 1 }));

    // 4. Atomic Update: Clear and Insert
    await Ranking.deleteMany({ contentType: type, rankType: 'top_rated' });
    if (ranked.length > 0) {
        await Ranking.insertMany(ranked);
    }
    
    logger.info(`[Rankings] Top Rated updated for ${type} (${ranked.length} items)`);
};

/**
 * TRENDING (Time-Decay Composite)
 */
export const calculateTrending = async (type) => {
    logger.info(`[Rankings] Calculating Trending for ${type}...`);
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // 1. Aggregate engagement events
    const events = await EngagementEvent.aggregate([
        { $match: { contentType: type, timestamp: { $gte: thirtyDaysAgo } } },
        { $group: {
            _id: '$contentId',
            likes: { $sum: { $cond: [{ $eq: ['$eventType', 'like'] }, 1, 0] } },
            comments: { $sum: { $cond: [{ $eq: ['$eventType', 'comment'] }, 1, 0] } },
            wishlists: { $sum: { $cond: [{ $eq: ['$eventType', 'wishlist'] }, 1, 0] } },
            ratings: { $sum: { $cond: [{ $eq: ['$eventType', 'rating'] }, 1, 0] } },
            views: { $sum: { $cond: [{ $eq: ['$eventType', 'view'] }, 1, 0] } },
            lastActivity: { $max: '$timestamp' }
        }}
    ]);

    // 2. Calculate scores with decay
    const now = Date.now();
    const ranked = events.map(e => {
        const rawScore = (e.likes * 3) + (e.comments * 4) + (e.wishlists * 2) + (e.ratings * 5) + (e.views * 1);
        const hoursSinceActivity = (now - new Date(e.lastActivity).getTime()) / (1000 * 60 * 60);
        const decay = 1 / (1 + hoursSinceActivity / 24);
        const score = rawScore * decay;
        
        return {
            contentId: e._id,
            contentType: type,
            rankType: 'trending',
            score: parseFloat(score.toFixed(3)),
        };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);

    // 3. Hydrate with titles/covers
    const finalRanked = [];
    for (let i = 0; i < ranked.length; i++) {
        const item = ranked[i];
        let metadata = null;
        const extId = parseInt(item.contentId);
        
        if (type === 'game') {
            const [g, l, w] = await Promise.all([
                Game.findOne({ igdbId: extId }),
                import('../models/GameLike.js').then(m => m.default.findOne({ igdbId: extId })),
                import('../models/Wishlist.js').then(m => m.default.findOne({ igdbId: extId }))
            ]);
            
            const source = g || l || w;
            if (source) {
                metadata = { 
                    title: source.title, 
                    cover: source.cover, 
                    genres: source.genres || (source.genre ? [source.genre] : []), 
                    avgRating: g?.rating || 0,
                    year: source.year || source.releaseYear
                };
            }
        } else if (['anime', 'manga', 'movie', 'tv'].includes(type)) {
            const EntryModel = (type === 'anime' || type === 'manga') ? AnimeEntry : MovieEntry;
            const LikeModel = (type === 'anime' || type === 'manga') ? import('../models/AnimeLike.js').then(m => m.default) : import('../models/MovieLike.js').then(m => m.default);
            const WishModel = (type === 'anime' || type === 'manga') ? import('../models/AnimeWishlist.js').then(m => m.default) : import('../models/MovieWishlist.js').then(m => m.default);

            const [entry, like, wish, stats] = await Promise.all([
                EntryModel.findOne({ externalId: extId, type }),
                LikeModel.then(M => M.findOne({ externalId: extId, type })),
                WishModel.then(M => M.findOne({ externalId: extId, type })),
                MediaStats.findOne({ externalId: extId, type })
            ]);

            const source = entry || like || wish;
            if (source) {
                metadata = { 
                    title: source.title, 
                    cover: source.cover, 
                    genres: source.genres || (source.genre ? [source.genre] : []),
                    avgRating: stats?.avgRating || 0,
                    year: source.year || (source.releaseDate ? new Date(source.releaseDate).getFullYear() : null)
                };
            }
        }
        
        if (metadata && metadata.title) {
            finalRanked.push({
                ...item,
                ...metadata,
                rankPosition: finalRanked.length + 1
            });
        }
        
        if (finalRanked.length >= 100) break; 
    }

    // 4. Atomic Update
    await Ranking.deleteMany({ contentType: type, rankType: 'trending' });
    if (finalRanked.length > 0) {
        await Ranking.insertMany(finalRanked);
    }
    
    logger.info(`[Rankings] Trending updated for ${type} (${finalRanked.length} items)`);
};

/**
 * COMING SOON / UPCOMING (Unified)
 */
export const calculateComingSoon = async (type) => {
    logger.info(`[Rankings] Syncing Coming Soon for ${type}...`);
    
    let items = [];
    
    if (type === 'game') {
        try {
            const { getAccessToken, normalizeCover } = await import('./igdb.js');
            const token = await getAccessToken();
            const now = Math.floor(Date.now() / 1000);
            const headers = { 'Client-ID': process.env.IGDB_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' };
            
            const res = await apiClient.post('https://api.igdb.com/v4/games', 
                `fields name, cover.url, genres.name, first_release_date; where first_release_date >= ${now} & cover != null; sort first_release_date asc; limit 100;`, 
                { headers }
            );
            
            items = (res.data || []).map(g => ({
                contentId: String(g.id),
                title: g.name,
                cover: normalizeCover(g.cover?.url),
                year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null,
                genres: g.genres?.map(gn => gn.name) || []
            }));
        } catch (err) { logger.error(`[Rankings] IGDB Coming Soon error:`, err.message); }
    } else if (type === 'anime' || type === 'manga') {
        try {
            // For manga, Jikan supports 'upcoming' filter as well
            const res = await apiClient.get(`https://api.jikan.moe/v4/top/${type}`, { 
                params: { 
                    limit: 25, 
                    filter: 'upcoming', 
                    sfw: true 
                },
                retry: 2
            });
            items = (res.data?.data || []).map(item => ({
                contentId: String(item.mal_id),
                title: item.title,
                cover: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url,
                year: item.aired?.prop?.from?.year || item.published?.prop?.from?.year || item.year,
                genres: item.genres?.map(g => g.name) || []
            }));
        } catch (err) { logger.error(`[Rankings] Jikan Coming Soon error for ${type}:`, err.message); }
    } else {
        try {
            const endpoint = type === 'movie' ? 'movie/upcoming' : 'tv/on_the_air';
            const res = await apiClient.get(`http://api.themoviedb.org/3/${endpoint}`, { params: { api_key: process.env.TMDB_API_KEY } });
            items = (res.data?.results || []).map(item => ({
                contentId: String(item.id),
                title: item.title || item.name,
                cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                year: parseInt((item.release_date || item.first_air_date || '').split('-')[0]),
                genres: []
            }));
        } catch (err) { logger.error(`[Rankings] TMDB Coming Soon error:`, err.message); }
    }

    if (items.length > 0) {
        const ranked = items.map((item, index) => ({
            ...item,
            contentType: type,
            rankType: 'coming_soon',
            score: 0, 
            rankPosition: index + 1
        }));

        await Ranking.deleteMany({ contentType: type, rankType: 'coming_soon' });
        await Ranking.insertMany(ranked);
    }
    
    logger.info(`[Rankings] Coming Soon updated for ${type} (${items.length} items)`);
};
