import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import AnimeEntry from '../models/AnimeEntry.js';

async function findByExternalId() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const entries = await AnimeEntry.find({ externalId: { $in: [20, 1735] } }).lean();
        console.log(`Found ${entries.length} entries by externalId.`);
        for (const e of entries) {
            console.log(`Entry: ID=${e._id}, Title="${e.title}", User=${e.userId}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

findByExternalId();
