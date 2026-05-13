import mongoose from 'mongoose';
import Ranking from './models/Ranking.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function checkRankings() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/levellog';
        console.log(`Connecting to ${mongoUri}...`);
        await mongoose.connect(mongoUri);
        const rankings = await Ranking.find({ contentType: { $in: ['anime', 'manga'] } });
        
        console.log(`Checking ${rankings.length} rankings...`);
        const suspicious = rankings.filter(r => r.year > 2026 || (r.year < 1950 && r.year !== null && r.year !== 0));
        
        console.log('Suspicious years found (Future/Too Old):', suspicious.length);
        suspicious.forEach(r => {
            console.log(`[${r.contentType}] ${r.title}: ${r.year} (${r.rankType})`);
        });

        // Check for common long-running shows
        const longRunning = ['One Piece', 'Detective Conan', 'Doraemon', 'Kingdom', 'Kingdom (2012)', 'Kingdom (2024)', 'Pokémon', 'Bleach'];
        console.log('\nChecking known long-running shows for current-year bias:');
        rankings.filter(r => longRunning.some(lr => r.title.includes(lr))).forEach(r => {
            console.log(`[Known Long-Running] ${r.title}: ${r.year} (${r.rankType})`);
        });

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkRankings();
