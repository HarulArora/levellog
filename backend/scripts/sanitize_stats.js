import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load models (absolute paths for script reliability)
import MediaStats from '../models/MediaStats.js';
import GlobalStats from '../models/GlobalStats.js';
import Ranking from '../models/Ranking.js';

dotenv.config();

const sanitize = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            console.error('MONGODB_URI not found in environment variables');
            process.exit(1);
        }

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('--- Database Sanitization Started ---');

        // 1. Remove MediaStats with 0 ratings
        const mediaRes = await MediaStats.deleteMany({ ratingCount: 0 });
        console.log(`[MediaStats] Purged ${mediaRes.deletedCount} entries with 0 ratings`);

        // 2. Remove GlobalStats with 0 ratings
        const globalRes = await GlobalStats.deleteMany({ ratingCount: 0 });
        console.log(`[GlobalStats] Purged ${globalRes.deletedCount} entries with 0 ratings`);

        // 3. Purge ghost ratings from Ranking collection
        // We reset cached avgRating to 0. The API will now correctly pull only from internal stats.
        const rankingRes = await Ranking.updateMany({}, { $set: { avgRating: 0 } });
        console.log(`[Ranking] Reset cached avgRating for ${rankingRes.modifiedCount} entries`);

        console.log('--- Sanitization Complete ---');
        process.exit(0);
    } catch (error) {
        console.error('Sanitization failed:', error);
        process.exit(1);
    }
};

sanitize();
