import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Ranking from '../models/Ranking.js';

dotenv.config();

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const rankings = await Ranking.find({ title: /One Piece/i, contentType: 'manga' });
        console.log('--- One Piece Manga Rankings ---');
        rankings.forEach(r => {
            console.log(`ID: ${r.externalId}, Type: ${r.contentType}, Year: ${r.year}, RankType: ${r.rankType}`);
        });
        
        if (rankings.some(r => r.year === null || r.year === undefined)) {
            console.log('Found TBA entry, fixing now...');
            await Ranking.updateMany({ title: /One Piece/i, contentType: 'manga' }, { $set: { year: 1997 } });
            console.log('Fixed.');
        } else {
            console.log('No TBA entries found in database. Issue might be frontend cache.');
        }

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

check();
