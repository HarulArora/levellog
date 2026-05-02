import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ranking from '../models/Ranking.js';
import MediaStats from '../models/MediaStats.js';
import AnimeEntry from '../models/AnimeEntry.js';

dotenv.config();

async function clean() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // 1. Delete "Ghost" rankings with invalid types or null years
        const r = await Ranking.deleteMany({ 
            $or: [
                { title: /One Piece/i },
                { contentType: 'media' }, // Delete corrupted types
                { year: null }           // Delete anything that failed to heal
            ]
        });
        console.log(`Deleted ${r.deletedCount} corrupted or target rankings.`);

        // 2. Clean MediaStats for One Piece to remove any "Fake" ratings
        const s = await MediaStats.deleteMany({ externalId: 13, type: 'manga' });
        const s2 = await MediaStats.deleteMany({ externalId: 21, type: 'anime' });
        console.log(`Reset MediaStats for One Piece.`);

        // 3. Force correct year in the main Entries
        await AnimeEntry.updateOne({ externalId: 13, type: 'manga' }, { $set: { year: 1997 } });
        await AnimeEntry.updateOne({ externalId: 21, type: 'anime' }, { $set: { year: 1999 } });
        console.log(`Fixed Entry years in main database.`);

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

clean();
