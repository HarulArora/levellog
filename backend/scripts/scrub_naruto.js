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
import MediaStats from '../models/MediaStats.js';
import GlobalStats from '../models/GlobalStats.js';

async function finalCleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const narutoIds = [20, 1735];
        const usersToClean = ['69ee6e5372184f4cc0cd7214', '69b1ddec7d5b6919ae1336a1']; // Quest_Duck and Gazzy

        console.log('Cleaning up accidental logs...');

        // Delete from all collections for these users and content
        const collections = [
            AnimeEntry, AnimeLike, AnimeWishlist,
            MovieEntry, MovieLike, MovieWishlist,
            Game, GameLike, Wishlist
        ];

        for (const Model of collections) {
            const result = await Model.deleteMany({
                $or: [
                    { externalId: { $in: narutoIds }, userId: { $in: usersToClean } },
                    { igdbId: { $in: narutoIds }, userId: { $in: usersToClean } }
                ]
            });
            if (result.deletedCount > 0) {
                console.log(`Deleted ${result.deletedCount} records from ${Model.modelName}`);
            }
        }

        // Fix Stats
        console.log('Synchronizing stats...');
        for (const id of narutoIds) {
            // Count actual logs in DB
            const logCount = await AnimeEntry.countDocuments({ externalId: id });
            const likeCount = await AnimeLike.countDocuments({ externalId: id });
            const wishCount = await AnimeWishlist.countDocuments({ externalId: id });
            const ratings = await AnimeEntry.find({ externalId: id, rating: { $gt: 0 } }).select('rating');
            
            const ratingCount = ratings.length;
            const avgRating = ratingCount > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / ratingCount : 0;

            await MediaStats.findOneAndUpdate(
                { externalId: id, type: 'anime' },
                { loggedCount: logCount, likeCount: likeCount, wishlistCount: wishCount, ratingCount: ratingCount, avgRating: avgRating },
                { upsert: true }
            );
            console.log(`Synced stats for anime ${id}: Logged=${logCount}, Rated=${ratingCount}`);
        }

        console.log('Cleanup complete!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

finalCleanup();
