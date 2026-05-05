import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { syncAllUsersXP } from '../tasks/xpSync.js';

dotenv.config();

async function runSync() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        await syncAllUsersXP();

        console.log('✅ XP Sync completed successfully!');
    } catch (err) {
        console.error('❌ Error during sync:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

runSync();
