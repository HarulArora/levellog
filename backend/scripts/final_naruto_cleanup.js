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

async function finalCleanup() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const narutoIds = [20, 1735]; // MAL IDs for Naruto and Naruto: Shippuden

        console.log('Cleaning up Naruto and Naruto: Shippuden...');

        const eDelete = await AnimeEntry.deleteMany({ externalId: { $in: narutoIds } });
        console.log(`Deleted ${eDelete.deletedCount} records from AnimeEntry`);

        const lDelete = await AnimeLike.deleteMany({ externalId: { $in: narutoIds } });
        console.log(`Deleted ${lDelete.deletedCount} records from AnimeLike`);

        const wDelete = await AnimeWishlist.deleteMany({ externalId: { $in: narutoIds } });
        console.log(`Deleted ${wDelete.deletedCount} records from AnimeWishlist`);

        console.log('Cleanup complete!');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

finalCleanup();
