import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ranking from '../models/Ranking.js';
import apiClient from '../utils/apiClient.js';

dotenv.config();

const CONTENT_TYPES = ['anime', 'manga'];
const JIKAN_BASE_URL = 'https://api.jikan.moe/v4';

async function backfill() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database. Starting backfill...');

        for (const type of CONTENT_TYPES) {
            console.log(`Processing ${type}...`);

            // 1. Fetch Trending (Airing for anime, Publishing for manga)
            console.log(`  Fetching Trending ${type}...`);
            const trendingRes = await apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, {
                params: { limit: 25, filter: type === 'manga' ? 'publishing' : 'airing', sfw: true }
            });
            const trendingItems = (trendingRes.data?.data || []).map((item, index) => ({
                contentId: String(item.mal_id),
                contentType: type,
                rankType: 'trending',
                rankPosition: index + 1,
                title: item.title,
                cover: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url,
                genres: item.genres?.map(g => g.name) || [],
                year: item.aired?.prop?.from?.year || item.published?.prop?.from?.year || item.year,
                score: item.score || 0
            }));

            // 2. Fetch Top Rated
            console.log(`  Fetching Top Rated ${type}...`);
            const topRes = await apiClient.get(`${JIKAN_BASE_URL}/top/${type}`, {
                params: { limit: 25, filter: 'bypopularity', sfw: true }
            });
            const topItems = (topRes.data?.data || []).map((item, index) => ({
                contentId: String(item.mal_id),
                contentType: type,
                rankType: 'top_rated',
                rankPosition: index + 1,
                title: item.title,
                cover: item.images?.webp?.large_image_url || item.images?.jpg?.large_image_url,
                genres: item.genres?.map(g => g.name) || [],
                year: item.aired?.prop?.from?.year || item.published?.prop?.from?.year || item.year,
                score: item.score || 0
            }));

            // Atomic update for this type
            await Ranking.deleteMany({ contentType: type, rankType: { $in: ['trending', 'top_rated'] } });
            if (trendingItems.length > 0) await Ranking.insertMany(trendingItems);
            if (topItems.length > 0) await Ranking.insertMany(topItems);

            console.log(`  Finished ${type}. (Added ${trendingItems.length + topItems.length} items)`);
            
            // Wait to respect Jikan rate limit
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log('Backfill completed successfully!');
    } catch (err) {
        console.error('Backfill failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

backfill();
