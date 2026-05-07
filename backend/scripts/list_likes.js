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
import User from '../models/User.js';

async function listAllLikes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const likes = await AnimeLike.find({}).sort({ createdAt: -1 }).limit(20).lean();
        console.log(`Found ${likes.length} recent likes:`);
        for (const l of likes) {
            const user = await User.findById(l.userId).lean();
            console.log(`Like: ID=${l._id}, Title="${l.title || l.gameTitle}", User="${user ? user.username : 'NULL'}", CreatedAt=${l.createdAt}`);
        }

        const wish = await AnimeWishlist.find({}).sort({ createdAt: -1 }).limit(20).lean();
        console.log(`Found ${wish.length} recent wishlists:`);
        for (const w of wish) {
            const user = await User.findById(w.userId).lean();
            console.log(`Wishlist: ID=${w._id}, Title="${w.title || w.gameTitle}", User="${user ? user.username : 'NULL'}", CreatedAt=${w.createdAt}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listAllLikes();
