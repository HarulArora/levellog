import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ranking from '../models/Ranking.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const stats = await Ranking.aggregate([
            { $group: { _id: { type: "$contentType", rank: "$rankType" }, count: { $sum: 1 } } }
        ]);
        console.log('Ranking Stats:', JSON.stringify(stats, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
