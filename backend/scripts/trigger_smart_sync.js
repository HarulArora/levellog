import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { syncAllRankings } from '../tasks/rankingsSync.js';

dotenv.config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to database. Running smart sync...');
        await syncAllRankings();
        console.log('Smart sync completed!');
    } catch (err) {
        console.error('Sync failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

run();
