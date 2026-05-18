import express from 'express';
import Ranking from '../models/Ranking.js';
import logger from '../utils/logger.js';
import apiClient from '../utils/apiClient.js';
import { getAccessToken, normalizeCover } from '../utils/igdb.js';
import GlobalStats from '../models/GlobalStats.js';
import MediaStats from '../models/MediaStats.js';

const router = express.Router();

const TMDB_BASE_URL = 'https://api.tmdb.org/3';
const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

// In-memory cache for resolved release years to prevent rate limit issues
const yearCache = new Map();

const recoverMissingYears = async (rankings, type) => {
    const missingItems = rankings.filter(r => !r.year || r.year === 0);
    if (missingItems.length === 0) return rankings;

    const idsToFetch = missingItems.map(r => parseInt(r.contentId)).filter(id => !isNaN(id) && id > 0);
    if (idsToFetch.length === 0) return rankings;

    const fetchedYears = {};

    try {
        if (type === 'game') {
            const uncachedIds = idsToFetch.filter(id => !yearCache.has(`game-${id}`));
            if (uncachedIds.length > 0) {
                const token = await getAccessToken();
                const headers = { 
                    'Client-ID': process.env.IGDB_CLIENT_ID, 
                    'Authorization': `Bearer ${token}`, 
                    'Content-Type': 'text/plain' 
                };
                const resApi = await apiClient.post(
                    'https://api.igdb.com/v4/games', 
                    `fields first_release_date; where id = (${uncachedIds.join(',')}); limit 100;`, 
                    { headers }
                );
                (resApi.data || []).forEach(g => {
                    if (g.first_release_date) {
                        const y = new Date(g.first_release_date * 1000).getFullYear();
                        yearCache.set(`game-${g.id}`, y);
                    }
                });
            }
            idsToFetch.forEach(id => {
                fetchedYears[id] = yearCache.get(`game-${id}`) || null;
            });
        } 
        else if (type === 'anime' || type === 'manga') {
            for (const id of idsToFetch) {
                const cacheKey = `${type}-${id}`;
                if (yearCache.has(cacheKey)) {
                    fetchedYears[id] = yearCache.get(cacheKey);
                    continue;
                }
                try {
                    // Quick rate-limit safe delay
                    await new Promise(r => setTimeout(r, 340));
                    const resApi = await apiClient.get(`${JIKAN_BASE_URL}/${type}/${id}`, { retry: 1 });
                    const y = resApi.data?.data?.aired?.prop?.from?.year || resApi.data?.data?.published?.prop?.from?.year || resApi.data?.data?.year;
                    if (y) {
                        yearCache.set(cacheKey, y);
                        fetchedYears[id] = y;
                    }
                } catch (e) {
                    logger.warn(`[Rankings Year Recover] Anime/Manga ${id} failed: ${e.message}`);
                }
            }
        } 
        else if (type === 'movie' || type === 'tv') {
            for (const id of idsToFetch) {
                const cacheKey = `${type}-${id}`;
                if (yearCache.has(cacheKey)) {
                    fetchedYears[id] = yearCache.get(cacheKey);
                    continue;
                }
                try {
                    const resApi = await apiClient.get(`${TMDB_BASE_URL}/${type}/${id}`, {
                        params: { api_key: process.env.TMDB_API_KEY },
                        retry: 1
                    });
                    const dateStr = resApi.data?.release_date || resApi.data?.first_air_date || '';
                    const y = parseInt(dateStr.split('-')[0]);
                    if (y && !isNaN(y)) {
                        yearCache.set(cacheKey, y);
                        fetchedYears[id] = y;
                    }
                } catch (e) {
                    logger.warn(`[Rankings Year Recover] Movie/TV ${id} failed: ${e.message}`);
                }
            }
        }
    } catch (err) {
        logger.error(`[Rankings Universal Year Recover] Failed: ${err.message}`);
    }

    return rankings.map(r => {
        const idNum = parseInt(r.contentId);
        return {
            ...r,
            year: r.year && r.year > 0 ? r.year : (fetchedYears[idNum] || null)
        };
    });
};

// Helper to merge and unique with Website Stats Priority
const mergeUnique = async (existing, fetched, type) => {
    const ids = new Set(existing.map(i => String(i.contentId || i.id || i.externalId)));
    const merged = [...existing];

    // Bulk fetch website stats for the new items
    const externalIds = fetched.map(item => parseInt(item.contentId || item.id || item.externalId || item.mal_id)).filter(id => !isNaN(id));
    let statsMap = {};

    if (type === 'game') {
        const stats = await GlobalStats.find({ igdbId: { $in: externalIds } }).lean();
        stats.forEach(s => statsMap[s.igdbId] = s.avgRating);
    } else {
        const stats = await MediaStats.find({ externalId: { $in: externalIds }, type }).lean();
        stats.forEach(s => statsMap[s.externalId] = s.avgRating);
    }

    for (const item of fetched) {
        const id = String(item.contentId || item.id || item.externalId || item.mal_id);
        if (!ids.has(id) && merged.length < 100) {
            // Priority: Website Stat ONLY (as per user request to 'fix everything on this page')
            const siteRating = statsMap[parseInt(id)];
            
            merged.push({
                ...item,
                contentId: id,
                avgRating: siteRating && siteRating > 0 ? siteRating : 0
            });
            ids.add(id); // Crucial: mark as seen so duplicates in 'fetched' are skipped
        }
    }
    return merged;
};

// ── GET /api/rankings/top_rated?type=game&limit=100 ──
router.get('/top_rated', async (req, res) => {
    try {
        const { type, limit = 100 } = req.query;
        if (!type) return res.status(400).json({ success: false, message: 'Type is required' });

        let rankings = await Ranking.find({ contentType: type, rankType: 'top_rated' })
            .sort({ rankPosition: 1 }).limit(parseInt(limit)).lean();

        logger.info(`[Rankings] Found ${rankings.length} ${type} top_rated in DB`);

        // Deduplicate existing rankings (Safety Layer)
        const seenIds = new Set();
        rankings = rankings.filter(r => {
            if (!r.contentId || seenIds.has(String(r.contentId))) return false;
            seenIds.add(String(r.contentId));
            return true;
        });

        // Refresh stats and year from website/external for existing rankings
        const ids = rankings.map(r => parseInt(r.contentId)).filter(id => !isNaN(id));
        if (ids.length > 0) {
            if (type === 'game') {
                const stats = await GlobalStats.find({ igdbId: { $in: ids } }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.igdbId] = s.avgRating);
                rankings = rankings.map(r => ({ ...r, avgRating: sMap[r.contentId] || 0 }));
            } else {
                const stats = await MediaStats.find({ externalId: { $in: ids }, type }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.externalId] = s.avgRating);
                rankings = rankings.map(r => ({ ...r, avgRating: sMap[r.contentId] || 0 }));
            }
            // Recover any missing years universally
            rankings = await recoverMissingYears(rankings, type);
        }

        // Backfill ONLY if database is extremely low (< 10 items)
        if (rankings.length < 10) {
            try {
                let fallback = [];
                if (type === 'game') {
                    const token = await getAccessToken();
                    const headers = { 'Client-ID': process.env.IGDB_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' };
                    const resApi = await apiClient.post('https://api.igdb.com/v4/games', `fields name, cover.url, genres.name, rating, first_release_date; where rating > 85 & rating_count > 50 & cover != null; sort rating desc; limit 100;`, { headers });
                    fallback = (resApi.data || []).map(g => ({
                        id: g.id, title: g.name, cover: normalizeCover(g.cover?.url), 
                        genres: g.genres?.map(gn => gn.name) || [], avgRating: g.rating ? parseFloat((g.rating / 10).toFixed(1)) : 0,
                        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null
                    }));
                } else if (type === 'anime' || type === 'manga') {
                    // Just fetch 1 page (25 items) quickly to avoid timeout
                    try {
                        const resApi = await apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { 
                            params: { page: 1, limit: 25, filter: 'bypopularity', sfw: true },
                            retry: 1 
                        });
                        fallback = (resApi.data?.data || []).map(item => ({
                            id: item.mal_id, title: item.title, cover: item.images?.webp?.large_image_url,
                            genres: item.genres?.map(g => g.name) || [], avgRating: 0,
                            year: item.aired?.prop?.from?.year || item.published?.prop?.from?.year
                        }));
                    } catch (err) { logger.error(`[Jikan Top Fallback] failed:`, err.message); }
                } else {
                    // Fetch until we have 110 items (or max 10 pages) because filtering reduces count
                    let page = 1;
                    while (fallback.length < 110 && page <= 10) {
                        try {
                            const resApi = await apiClient.get(`${TMDB_BASE_URL}/${type}/top_rated`, { 
                                params: { api_key: process.env.TMDB_API_KEY, page },
                                retry: 1
                            });
                            const pageItems = (resApi.data?.results || [])
                                .filter(m => !m.genre_ids?.includes(16) && m.original_language !== 'ja') 
                                .map(item => ({
                                    id: item.id, title: item.title || item.name, cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                                    avgRating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 0, year: parseInt((item.release_date || item.first_air_date || '').split('-')[0])
                                }));
                            fallback = [...fallback, ...pageItems];
                            if ((resApi.data?.results || []).length === 0) break;
                            page++;
                            await new Promise(r => setTimeout(r, 150));
                        } catch (err) { logger.error(`[TMDB Top Rated Page ${page}] failed:`, err.message); break; }
                    }
                }
                if (fallback.length > 110) fallback = fallback.slice(0, 110);
                logger.info(`[Rankings Backfill] Fetched ${fallback.length} ${type} from live API`);
                rankings = await mergeUnique(rankings, fallback, type);
            } catch (err) { 
                const errMsg = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message;
                logger.error(`[Rankings Fallback] ${type} top_rated failed: ${errMsg}`); 
            }
        }

        res.json({ success: true, rankings });
    } catch (error) {
        logger.error('Rankings API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch top-rated rankings' });
    }
});

// ── GET /api/rankings/trending?type=anime&limit=100 ──
router.get('/trending', async (req, res) => {
    try {
        const { type, limit = 100 } = req.query;
        if (!type) return res.status(400).json({ success: false, message: 'Type is required' });

        let rankings = await Ranking.find({ contentType: type, rankType: 'trending' })
            .sort({ rankPosition: 1 }).limit(parseInt(limit)).lean();

        logger.info(`[Rankings] Found ${rankings.length} ${type} trending in DB`);

        // Deduplicate existing rankings (Safety Layer)
        const seenIds = new Set();
        rankings = rankings.filter(r => {
            if (!r.contentId || seenIds.has(String(r.contentId))) return false;
            seenIds.add(String(r.contentId));
            return true;
        });

        // Refresh stats from website
        const ids = rankings.map(r => parseInt(r.contentId)).filter(id => !isNaN(id));
        if (ids.length > 0) {
            if (type === 'game') {
                const stats = await GlobalStats.find({ igdbId: { $in: ids } }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.igdbId] = s.avgRating);
                rankings = rankings.map(r => ({ ...r, avgRating: sMap[r.contentId] || 0 }));
            } else {
                const stats = await MediaStats.find({ externalId: { $in: ids }, type }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.externalId] = s.avgRating);
                rankings = rankings.map(r => ({ ...r, avgRating: sMap[r.contentId] || 0 }));
            }
            // Recover any missing years universally
            rankings = await recoverMissingYears(rankings, type);
        }

        // Backfill ONLY if database is extremely low (< 10 items)
        if (rankings.length < 10) {
            try {
                let fallback = [];
                if (type === 'game') {
                    const token = await getAccessToken();
                    const headers = { 'Client-ID': process.env.IGDB_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' };
                    const resApi = await apiClient.post('https://api.igdb.com/v4/games', `fields name, cover.url, genres.name, rating, first_release_date; where rating > 70 & rating_count > 50 & cover != null; sort rating_count desc; limit 100;`, { headers });
                    fallback = (resApi.data || []).map(g => ({
                        id: g.id, title: g.name, cover: normalizeCover(g.cover?.url), 
                        genres: g.genres?.map(gn => gn.name) || [], avgRating: g.rating ? parseFloat((g.rating / 10).toFixed(1)) : 0,
                        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null
                    }));
                } else if (type === 'anime' || type === 'manga') {
                    // Just fetch 1 page (25 items) quickly to avoid timeout
                    try {
                        const resApi = await apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { 
                            params: { page: 1, limit: 25, filter: type === 'manga' ? 'publishing' : 'airing', sfw: true },
                            retry: 1
                        });
                        fallback = (resApi.data?.data || []).map(item => ({
                            id: item.mal_id, title: item.title, cover: item.images?.webp?.large_image_url,
                            genres: item.genres?.map(g => g.name) || [], avgRating: 0,
                            year: item.aired?.prop?.from?.year || item.published?.prop?.from?.year
                        }));
                    } catch (err) { logger.error(`[Jikan Trending Fallback] failed:`, err.message); }
                } else {
                    // Fetch until we have 110 items (or max 15 pages) because filtering reduces count
                    let page = 1;
                    while (fallback.length < 110 && page <= 15) {
                        try {
                            const resApi = await apiClient.get(`${TMDB_BASE_URL}/trending/${type}/week`, { 
                                params: { api_key: process.env.TMDB_API_KEY, page },
                                retry: 1
                            });
                            const pageItems = (resApi.data?.results || [])
                                .filter(m => !m.genre_ids?.includes(16) && m.original_language !== 'ja') 
                                .map(item => ({
                                    id: item.id, title: item.title || item.name, cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                                    avgRating: item.vote_average ? parseFloat(item.vote_average.toFixed(1)) : 0, year: parseInt((item.release_date || item.first_air_date || '').split('-')[0])
                                }));
                            fallback = [...fallback, ...pageItems];
                            if ((resApi.data?.results || []).length === 0) break;
                            page++;
                            await new Promise(r => setTimeout(r, 150));
                        } catch (err) { logger.error(`[TMDB Trending Page ${page}] failed:`, err.message); break; }
                    }
                    if (fallback.length > 110) fallback = fallback.slice(0, 110);
                }
                rankings = await mergeUnique(rankings, fallback, type);
            } catch (err) { 
                const errMsg = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message;
                logger.error(`[Rankings Fallback] ${type} trending failed: ${errMsg}`); 
            }
        }

        res.json({ success: true, rankings });
    } catch (error) {
        logger.error('Trending API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch trending rankings' });
    }
});

// ── GET /api/rankings/coming_soon?type=movie&limit=100 ──
router.get('/coming_soon', async (req, res) => {
    try {
        const { type, limit = 100 } = req.query;
        if (!type) return res.status(400).json({ success: false, message: 'Type is required' });

        let rankings = await Ranking.find({ contentType: type, rankType: 'coming_soon' })
            .sort({ rankPosition: 1 }).limit(parseInt(limit)).lean();

        logger.info(`[Rankings] Found ${rankings.length} ${type} coming_soon in DB`);

        // Deduplicate existing rankings (Safety Layer)
        const seenIds = new Set();
        rankings = rankings.filter(r => {
            if (!r.contentId || seenIds.has(String(r.contentId))) return false;
            seenIds.add(String(r.contentId));
            return true;
        });

        // Refresh stats from website
        const ids = rankings.map(r => parseInt(r.contentId)).filter(id => !isNaN(id));
        if (ids.length > 0) {
            const currentYear = new Date().getFullYear();
            if (type === 'game') {
                const stats = await GlobalStats.find({ igdbId: { $in: ids } }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.igdbId] = s.avgRating);
                rankings = rankings.map(r => ({ ...r, avgRating: sMap[r.contentId] || 0 }));
            } else {
                const stats = await MediaStats.find({ externalId: { $in: ids }, type }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.externalId] = s.avgRating);
                rankings = rankings.map(r => ({ ...r, avgRating: sMap[r.contentId] || 0 }));
            }
            
            // Fast filter for current items
            rankings = rankings.filter(r => !r.year || r.year >= currentYear);
        }

        // Backfill ONLY if database is extremely low (< 10 items)
        if (rankings.length < 10 && type !== 'manga') {
            try {
                let fallback = [];
                const nowSec = Math.floor(Date.now() / 1000);
                const nowStr = new Date().toISOString().split('T')[0];

                if (type === 'game') {
                    const token = await getAccessToken();
                    const headers = { 'Client-ID': process.env.IGDB_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' };
                    const resApi = await apiClient.post('https://api.igdb.com/v4/games', `fields name, cover.url, genres.name, first_release_date, rating; where first_release_date >= ${nowSec} & cover != null; sort first_release_date asc; limit 100;`, { headers });
                    fallback = (resApi.data || []).map(g => ({
                        id: g.id, title: g.name, cover: normalizeCover(g.cover?.url), 
                        genres: g.genres?.map(gn => gn.name) || [], avgRating: g.rating ? g.rating / 10 : 0,
                        year: g.first_release_date ? new Date(g.first_release_date * 1000).getFullYear() : null
                    }));
                } else if (type === 'anime') {
                    try {
                        const resApi = await apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { 
                            params: { page: 1, limit: 25, filter: 'upcoming', sfw: true },
                            retry: 1
                        });
                        fallback = (resApi.data?.data || []).map(item => ({
                            id: item.mal_id, title: item.title, cover: item.images?.webp?.large_image_url,
                            genres: item.genres?.map(g => g.name) || [], avgRating: 0,
                            year: item.aired?.prop?.from?.year || item.year
                        }));
                    } catch (err) { logger.error(`[Jikan Coming Soon Fallback] failed:`, err.message); }
                } else if (type === 'movie' || type === 'tv') {
                    // Fetch until we have 110 items (or max 15 pages) because filtering reduces count
                    const endpoint = type === 'movie' ? 'discover/movie' : 'discover/tv';
                    const dateParam = type === 'movie' ? 'primary_release_date.gte' : 'first_air_date.gte';
                    let page = 1;

                    while (fallback.length < 110 && page <= 15) {
                        try {
                            const resApi = await apiClient.get(`${TMDB_BASE_URL}/${endpoint}`, { 
                                params: { 
                                    api_key: process.env.TMDB_API_KEY, 
                                    [dateParam]: nowStr,
                                    without_genres: '16',
                                    with_original_language: 'en|fr|de|es|it|ko|cn', 
                                    sort_by: type === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc',
                                    page
                                },
                                retry: 1
                            });
                            const pageItems = (resApi.data?.results || [])
                                .filter(m => m.original_language !== 'ja')
                                .map(item => ({
                                    id: item.id, title: item.title || item.name, cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                                    avgRating: 0, year: parseInt((item.release_date || item.first_air_date || '').split('-')[0])
                                }));
                            fallback = [...fallback, ...pageItems];
                            if ((resApi.data?.results || []).length === 0) break;
                            page++;
                            await new Promise(r => setTimeout(r, 150));
                        } catch (err) { logger.error(`[TMDB Discover Page ${page}] failed:`, err.message); break; }
                    }
                    if (fallback.length > 110) fallback = fallback.slice(0, 110);
                }
                rankings = await mergeUnique(rankings, fallback, type);
            } catch (err) { 
                const errMsg = err.response ? `${err.response.status} ${JSON.stringify(err.response.data)}` : err.message;
                logger.error(`[Rankings Fallback] ${type} coming_soon failed: ${errMsg}`); 
            }
        }
        res.json({ success: true, rankings });
    } catch (error) {
        logger.error('Coming Soon API Error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch coming soon rankings' });
    }
});

export default router;
