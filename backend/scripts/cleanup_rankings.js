import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ranking from '../models/Ranking.js';

dotenv.config();

async function clean() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        await Ranking.deleteMany({ contentType: { $in: ['anime', 'manga', 'movie', 'tv'] } });
        console.log('Cleaned bad rankings.');
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

clean();
