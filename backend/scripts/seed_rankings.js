
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { syncAllRankings } from '../tasks/rankingsSync.js';
import logger from '../utils/logger.js';

dotenv.config();

async function seedRankings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Connected to MongoDB for seeding');

        await syncAllRankings();

        logger.info('Rankings seeded successfully');
    } catch (err) {
        logger.error('Seeding failed:', err);
    } finally {
        await mongoose.disconnect();
    }
}

seedRankings();
