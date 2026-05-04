import express from 'express';
import Ranking from '../models/Ranking.js';
import logger from '../utils/logger.js';
import apiClient from '../utils/apiClient.js';
import { getAccessToken, normalizeCover } from '../utils/igdb.js';
import GlobalStats from '../models/GlobalStats.js';
import MediaStats from '../models/MediaStats.js';

const router = express.Router();

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

// Helper to merge and unique with Website Stats Priority
const mergeUnique = async (existing, fetched, type) => {
    const ids = new Set(existing.map(i => String(i.contentId || i.id || i.externalId)));
    const merged = [...existing];

    // Bulk fetch website stats for the new items
    const externalIds = fetched.map(item => parseInt(item.contentId || item.id || item.externalId || item.mal_id));
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
        const ids = rankings.map(r => parseInt(r.contentId));
        if (ids.length > 0) {
            if (type === 'game') {
                const stats = await GlobalStats.find({ igdbId: { $in: ids } }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.igdbId] = s.avgRating);
                
                const missingYearIds = rankings.filter(r => !r.year || r.year === 0).map(r => parseInt(r.contentId));
                let yearMap = {};
                if (missingYearIds.length > 0) {
                    try {
                        const token = await getAccessToken();
                        const headers = { 'Client-ID': process.env.IGDB_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' };
                        const resApi = await apiClient.post('https://api.igdb.com/v4/games', `fields first_release_date; where id = (${missingYearIds.join(',')}); limit 50;`, { headers });
                        (resApi.data || []).forEach(g => { if (g.first_release_date) yearMap[g.id] = new Date(g.first_release_date * 1000).getFullYear(); });
                    } catch (err) { logger.error(`[Rankings Year Refresh] Failed:`, err.message); }
                }

                rankings = rankings.map(r => ({ 
                    ...r, 
                    avgRating: sMap[r.contentId] || r.avgRating,
                    year: r.year && r.year > 0 ? r.year : (yearMap[r.contentId] || null)
                }));
            } else {
                const stats = await MediaStats.find({ externalId: { $in: ids }, type }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.externalId] = s.avgRating);
                rankings = rankings.map(r => ({ ...r, avgRating: sMap[r.contentId] || r.avgRating }));
            }
        }

        // Backfill if needed
        if (rankings.length < 100) {
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
                    // Fetch 5 pages for 125 items to ensure 100 unique after merge
                    for (let page = 1; page <= 5; page++) {
                        try {
                            const resApi = await apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { 
                                params: { page, limit: 25, filter: 'bypopularity', sfw: true },
                                retry: 3 
                            });
                            const pageItems = (resApi.data?.data || []).map(item => ({
                                id: item.mal_id, title: item.title, cover: item.images?.webp?.large_image_url,
                                genres: item.genres?.map(g => g.name) || [], avgRating: item.score ? parseFloat(item.score.toFixed(1)) : 0,
                                year: item.aired?.prop?.from?.year || item.published?.prop?.from?.year
                            }));
                            fallback = [...fallback, ...pageItems];
                            if (pageItems.length < 25) break;
                            if (page < 5) await new Promise(r => setTimeout(r, 500));
                        } catch (err) { logger.error(`[Jikan Top Page ${page}] failed:`, err.message); break; }
                    }
                } else {
                    // Fetch until we have 110 items (or max 10 pages) because filtering reduces count
                    let page = 1;
                    while (fallback.length < 110 && page <= 10) {
                        try {
                            const resApi = await apiClient.get(`${TMDB_BASE_URL}/${type}/top_rated`, { 
                                params: { api_key: process.env.TMDB_API_KEY, page },
                                retry: 3
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
        const ids = rankings.map(r => parseInt(r.contentId));
        if (ids.length > 0) {
            if (type === 'game') {
                const stats = await GlobalStats.find({ igdbId: { $in: ids } }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.igdbId] = s.avgRating);
                
                const missingYearIds = rankings.filter(r => !r.year || r.year === 0).map(r => parseInt(r.contentId));
                let yearMap = {};
                if (missingYearIds.length > 0) {
                    try {
                        const token = await getAccessToken();
                        const headers = { 'Client-ID': process.env.IGDB_CLIENT_ID, 'Authorization': `Bearer ${token}`, 'Content-Type': 'text/plain' };
                        const resApi = await apiClient.post('https://api.igdb.com/v4/games', `fields first_release_date; where id = (${missingYearIds.join(',')}); limit 50;`, { headers });
                        (resApi.data || []).forEach(g => { if (g.first_release_date) yearMap[g.id] = new Date(g.first_release_date * 1000).getFullYear(); });
                    } catch (err) { logger.error(`[Rankings Year Refresh] Failed:`, err.message); }
                }

                rankings = rankings.map(r => ({ 
                    ...r, 
                    avgRating: sMap[r.contentId] || r.avgRating,
                    year: r.year && r.year > 0 ? r.year : (yearMap[r.contentId] || null)
                }));
            } else {
                const stats = await MediaStats.find({ externalId: { $in: ids }, type }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.externalId] = s.avgRating);
                rankings = rankings.map(r => ({ ...r, avgRating: sMap[r.contentId] || r.avgRating }));
            }
        }

        if (rankings.length < 100) {
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
                    // Fetch 5 pages for 125 items to ensure 100 unique after merge
                    for (let page = 1; page <= 5; page++) {
                        try {
                            const resApi = await apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { 
                                params: { page, limit: 25, filter: type === 'manga' ? 'publishing' : 'airing', sfw: true },
                                retry: 3
                            });
                            const pageItems = (resApi.data?.data || []).map(item => ({
                                id: item.mal_id, title: item.title, cover: item.images?.webp?.large_image_url,
                                genres: item.genres?.map(g => g.name) || [], avgRating: item.score ? parseFloat(item.score.toFixed(1)) : 0,
                                year: item.aired?.prop?.from?.year || item.published?.prop?.from?.year
                            }));
                            fallback = [...fallback, ...pageItems];
                            if (pageItems.length < 25) break;
                            if (page < 5) await new Promise(r => setTimeout(r, 500));
                        } catch (err) { logger.error(`[Jikan Trending Page ${page}] failed:`, err.message); break; }
                    }
                } else {
                    // Fetch until we have 110 items (or max 15 pages) because filtering reduces count
                    let page = 1;
                    while (fallback.length < 110 && page <= 15) {
                        try {
                            const resApi = await apiClient.get(`${TMDB_BASE_URL}/trending/${type}/week`, { 
                                params: { api_key: process.env.TMDB_API_KEY, page },
                                retry: 3
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
        const ids = rankings.map(r => parseInt(r.contentId));
        if (ids.length > 0) {
            if (type === 'game') {
                const stats = await GlobalStats.find({ igdbId: { $in: ids } }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.igdbId] = s.avgRating);
                rankings = rankings.map(r => ({ ...r, avgRating: sMap[r.contentId] || r.avgRating }));
            } else {
                const stats = await MediaStats.find({ externalId: { $in: ids }, type }).lean();
                const sMap = {}; stats.forEach(s => sMap[s.externalId] = s.avgRating);
                rankings = rankings.map(r => ({ ...r, avgRating: sMap[r.contentId] || r.avgRating }));
            }
        }

        if (rankings.length < 100 && type !== 'manga') {
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
                    // Fetch 5 pages for 125 items to ensure 100 unique after merge
                    for (let page = 1; page <= 5; page++) {
                        try {
                            const resApi = await apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, { 
                                params: { page, limit: 25, filter: 'upcoming', sfw: true },
                                retry: 3
                            });
                            const pageItems = (resApi.data?.data || []).map(item => ({
                                id: item.mal_id, title: item.title, cover: item.images?.webp?.large_image_url,
                                genres: item.genres?.map(g => g.name) || [], avgRating: 0,
                                year: item.aired?.prop?.from?.year || item.year
                            }));
                            fallback = [...fallback, ...pageItems];
                            if (pageItems.length < 25) break;
                            if (page < 5) await new Promise(r => setTimeout(r, 500));
                        } catch (err) { logger.error(`[Jikan Coming Soon Page ${page}] failed:`, err.message); break; }
                    }
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
                                retry: 3
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
