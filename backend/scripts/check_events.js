import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import EngagementEvent from '../models/EngagementEvent.js';

async function checkEvents() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Search by contentId for known Naruto MAL IDs
        const narutoIds = ['20', '1735']; 
        const events = await EngagementEvent.find({ contentId: { $in: narutoIds } }).lean();
        console.log(`Found ${events.length} Naruto engagement events.`);
        
        for (const e of events) {
            console.log(`Event: Type=${e.eventType}, User=${e.userId}, Content=${e.contentId}, Time=${e.timestamp}`);
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkEvents();
