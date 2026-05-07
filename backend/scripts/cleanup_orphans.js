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

async function cleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const users = await User.find({}, '_id').lean();
        const validUserIds = users.map(u => u._id.toString());
        console.log(`Found ${validUserIds.length} valid users`);

        for (const { name, model } of models) {
            console.log(`Checking ${name}...`);
            
            // Find all records
            const records = await model.find({}, 'userId title gameTitle').lean();
            const orphaned = records.filter(r => !r.userId || !validUserIds.includes(r.userId.toString()));
            
            if (orphaned.length > 0) {
                console.log(`Found ${orphaned.length} orphaned records in ${name}:`);
                orphaned.forEach(r => console.log(`  - Title: ${r.title || r.gameTitle}, UserID: ${r.userId}`));
                
                const deleteResult = await model.deleteMany({
                    _id: { $in: orphaned.map(r => r._id) }
                });
                console.log(`  Deleted ${deleteResult.deletedCount} orphaned records from ${name}`);
            } else {
                console.log(`No orphaned records found in ${name}`);
            }
        }

        console.log('Cleanup complete!');
        process.exit(0);
    } catch (error) {
        console.error('Cleanup failed:', error);
        process.exit(1);
    }
}

cleanup();
