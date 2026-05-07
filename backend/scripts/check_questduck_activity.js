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

async function checkQuestDuck() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const userId = '69ee6e5372184f4cc0cd7214'; // Quest_Duck
        
        console.log('Checking activity for Quest_Duck...');
        
        const entries = await AnimeEntry.find({ userId }).lean();
        console.log(`Found ${entries.length} anime entries:`);
        for (const e of entries) {
            console.log(`Entry: Title="${e.title}", CreatedAt=${e.createdAt}, ExternalID=${e.externalId}`);
        }

        const likes = await AnimeLike.find({ userId }).lean();
        console.log(`Found ${likes.length} likes:`);
        for (const l of likes) {
            console.log(`Like: Title="${l.title || l.gameTitle}", CreatedAt=${l.createdAt}, ExternalID=${l.externalId}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkQuestDuck();
