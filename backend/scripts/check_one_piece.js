import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ranking from '../models/Ranking.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const op = await Ranking.findOne({ title: /One Piece/i, rankType: 'trending' });
        console.log('One Piece Trending Data:', JSON.stringify(op, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
