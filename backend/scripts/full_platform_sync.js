import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { syncAllUsersXP, cleanupDuplicates } from '../tasks/xpSync.js';

dotenv.config();

async function runFullSync() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🚀 Starting Full Platform Audit & Synchronization...');
        
        console.log('\nStep 1: Cleaning up any duplicate library entries...');
        await cleanupDuplicates();
        
        console.log('\nStep 2: Re-calculating XP for all users based on actual activity...');
        await syncAllUsersXP();
        
        console.log('\n✅ Platform synchronization complete!');
    } catch (err) {
        console.error('❌ Sync failed:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

runFullSync();
