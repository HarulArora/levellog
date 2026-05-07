import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import AnimeEntry from '../models/AnimeEntry.js';
import User from '../models/User.js';

async function listAll() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const entries = await AnimeEntry.find({}).sort({ createdAt: -1 }).limit(20).lean();
        console.log(`Found ${entries.length} recent entries:`);

        for (const e of entries) {
            const user = await User.findById(e.userId).lean();
            console.log(`Entry: ID=${e._id}, Title="${e.title}", User="${user ? user.username : 'NULL'}", CreatedAt=${e.createdAt}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

listAll();
