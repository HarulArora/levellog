import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ranking from '../models/Ranking.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const count = await Ranking.countDocuments();
        const types = await Ranking.distinct('contentType');
        console.log('Ranking Count:', count);
        console.log('Ranking Types:', types);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
