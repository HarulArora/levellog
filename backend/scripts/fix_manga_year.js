import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ranking from '../models/Ranking.js';

dotenv.config();

async function fix() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const r = await Ranking.updateMany({ title: /Piece/i, contentType: 'manga' }, { $set: { year: 1997 } });
        console.log(`Updated ${r.modifiedCount} manga rankings.`);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

fix();
