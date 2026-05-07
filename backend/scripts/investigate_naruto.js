import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import AnimeEntry from '../models/AnimeEntry.js';
import AnimeLike from '../models/AnimeLike.js';
import AnimeWishlist from '../models/AnimeWishlist.js';
import MovieEntry from '../models/MovieEntry.js';
import MovieLike from '../models/MovieLike.js';
import MovieWishlist from '../models/MovieWishlist.js';
import Game from '../models/Game.js';
import GameLike from '../models/GameLike.js';
import Wishlist from '../models/Wishlist.js';
import User from '../models/User.js';

async function investigate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const narutoQuery = { $or: [{ title: /Naruto/i }, { gameTitle: /Naruto/i }] };
        
        const animeLogs = await AnimeEntry.find(narutoQuery).lean();
        const animeLikes = await AnimeLike.find(narutoQuery).lean();
        const animeWish = await AnimeWishlist.find(narutoQuery).lean();
        
        const movieLogs = await MovieEntry.find(narutoQuery).lean();
        const movieLikes = await MovieLike.find(narutoQuery).lean();
        const movieWish = await MovieWishlist.find(narutoQuery).lean();

        const gameLogs = await Game.find(narutoQuery).lean();
        const gameLikes = await GameLike.find(narutoQuery).lean();
        const gameWish = await Wishlist.find(narutoQuery).lean();

        const allNaruto = [
            ...animeLogs.map(l => ({ ...l, collection: 'AnimeEntry' })),
            ...animeLikes.map(l => ({ ...l, collection: 'AnimeLike' })),
            ...animeWish.map(l => ({ ...l, collection: 'AnimeWishlist' })),
            ...movieLogs.map(l => ({ ...l, collection: 'MovieEntry' })),
            ...movieLikes.map(l => ({ ...l, collection: 'MovieLike' })),
            ...movieWish.map(l => ({ ...l, collection: 'MovieWishlist' })),
            ...gameLogs.map(l => ({ ...l, collection: 'Game' })),
            ...gameLikes.map(l => ({ ...l, collection: 'GameLike' })),
            ...gameWish.map(l => ({ ...l, collection: 'Wishlist' }))
        ];

        console.log(`Found ${allNaruto.length} Naruto-related records.`);

        for (const record of allNaruto) {
            const user = record.userId ? await User.findById(record.userId).lean() : null;
            console.log(`Record in ${record.collection}: Title="${record.title || record.gameTitle}", User="${user ? user.username : 'NULL/UNKNOWN'}", ID=${record._id}`);
        }

        // Also check for records with NO userId or invalid userId
        const orphanAnime = await AnimeEntry.find({ userId: { $exists: false } }).lean();
        const orphanGame = await Game.find({ userId: { $exists: false } }).lean();
        const orphanGame2 = await Game.find({ userId: null }).lean();

        console.log(`Found ${orphanAnime.length} orphan AnimeEntry records.`);
        console.log(`Found ${orphanGame.length + orphanGame2.length} orphan Game records.`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

investigate();
