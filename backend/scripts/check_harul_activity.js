import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import EngagementEvent from '../models/EngagementEvent.js';
import AnimeEntry from '../models/AnimeEntry.js';
import AnimeLike from '../models/AnimeLike.js';
import AnimeWishlist from '../models/AnimeWishlist.js';

async function checkUserActivity() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const userId = '69b1e3fa74cd2b752fe83419'; // harularora
        
        console.log('Checking activity for harularora...');
        
        const events = await EngagementEvent.find({ userId }).sort({ timestamp: -1 }).limit(20).lean();
        console.log(`Found ${events.length} engagement events:`);
        for (const e of events) {
            console.log(`Event: Type=${e.eventType}, Content=${e.contentId}, Time=${e.timestamp}`);
        }

        const entries = await AnimeEntry.find({ userId }).lean();
        console.log(`Found ${entries.length} anime entries:`);
        for (const e of entries) {
            console.log(`Entry: Title="${e.title}", CreatedAt=${e.createdAt}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUserActivity();
