import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.js';
import AnimeEntry from '../models/AnimeEntry.js';
import MovieEntry from '../models/MovieEntry.js';
import Game from '../models/Game.js';
import AnimeLike from '../models/AnimeLike.js';
import MovieLike from '../models/MovieLike.js';
import GameLike from '../models/GameLike.js';
import AnimeWishlist from '../models/AnimeWishlist.js';
import MovieWishlist from '../models/MovieWishlist.js';
import Wishlist from '../models/Wishlist.js';

const models = [
    { name: 'AnimeEntry', model: AnimeEntry },
    { name: 'MovieEntry', model: MovieEntry },
    { name: 'Game', model: Game },
    { name: 'AnimeLike', model: AnimeLike },
    { name: 'MovieLike', model: MovieLike },
    { name: 'GameLike', model: GameLike },
    { name: 'AnimeWishlist', model: AnimeWishlist },
    { name: 'MovieWishlist', model: MovieWishlist },
    { name: 'Wishlist', model: Wishlist }
];

async function findNaruto() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({}, '_id').lean();
        const validUserIds = users.map(u => u._id.toString());
        console.log(`Found ${validUserIds.length} valid users`);

        for (const { name, model } of models) {
            const records = await model.find({}).lean();
            
            const matches = records.filter(r => {
                const title = (r.title || r.gameTitle || '').toLowerCase();
                return title.includes('naruto');
            });

            const orphans = records.filter(r => !r.userId || !validUserIds.includes(r.userId.toString()));

            if (matches.length > 0) {
                console.log(`\nFound ${matches.length} Naruto records in ${name}:`);
                matches.forEach(r => {
                    const isOrphan = !r.userId || !validUserIds.includes(r.userId.toString());
                    console.log(`  - ID: ${r._id}, Title: ${r.title || r.gameTitle}, UserID: ${r.userId}, ExternalID: ${r.externalId || r.igdbId}, Orphan: ${isOrphan}, CreatedAt: ${r.createdAt}`);
                });
            }

            if (orphans.length > 0) {
                console.log(`\nFound ${orphans.length} orphaned records in ${name} (including non-Naruto):`);
                orphans.forEach(r => {
                    console.log(`  - ID: ${r._id}, Title: ${r.title || r.gameTitle}, UserID: ${r.userId}`);
                });
            }
        }

        console.log('\nSearch complete!');
        process.exit(0);
    } catch (error) {
        console.error('Search failed:', error);
        process.exit(1);
    }
}

findNaruto();
