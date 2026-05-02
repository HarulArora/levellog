import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ranking from '../models/Ranking.js';
import AnimeEntry from '../models/AnimeEntry.js';

dotenv.config();

async function fix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const r = await Ranking.updateMany({ title: /One Piece/i, contentType: 'anime' }, { $set: { year: 1999 } });
        const a = await AnimeEntry.updateMany({ externalId: 21, type: 'anime' }, { $set: { year: 1999 } });
        console.log(`Updated ${r.modifiedCount} rankings and ${a.modifiedCount} entries.`);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

fix();
