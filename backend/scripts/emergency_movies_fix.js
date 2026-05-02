import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ranking from '../models/Ranking.js';
import apiClient from '../utils/apiClient.js';

dotenv.config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function backfillMovies() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database. Starting Movies/TV backfill...');

        const targets = [
            { type: 'movie', endpoint: 'movie/popular', rank: 'trending' },
            { type: 'movie', endpoint: 'movie/top_rated', rank: 'top_rated' },
            { type: 'tv', endpoint: 'tv/popular', rank: 'trending' },
            { type: 'tv', endpoint: 'tv/top_rated', rank: 'top_rated' }
        ];

        for (const target of targets) {
            console.log(`Processing ${target.type} ${target.rank}...`);
            const res = await apiClient.get(`http://api.themoviedb.org/3/${target.endpoint}`, {
                params: { api_key: TMDB_API_KEY }
            });

            const items = (res.data?.results || []).slice(0, 25).map((item, index) => ({
                contentId: String(item.id),
                contentType: target.type,
                rankType: target.rank,
                rankPosition: index + 1,
                title: item.title || item.name,
                cover: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
                genres: [],
                year: parseInt((item.release_date || item.first_air_date || '').split('-')[0]),
                score: item.vote_average || 0
            }));

            await Ranking.deleteMany({ contentType: target.type, rankType: target.rank });
            if (items.length > 0) await Ranking.insertMany(items);
            console.log(`  Added ${items.length} items.`);
        }

        console.log('Movies/TV Backfill completed!');
    } catch (err) {
        console.error('Movies/TV Backfill failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

backfillMovies();
