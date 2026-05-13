import mongoose from 'mongoose';
import Ranking from './models/Ranking.js';
import apiClient from './utils/apiClient.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

async function fixRankings() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/levellog';
        console.log(`Connecting to ${mongoUri}...`);
        await mongoose.connect(mongoUri);

        // Find suspicious years (Future or 0 or null)
        const suspicious = await Ranking.find({ 
            contentType: { $in: ['anime', 'manga'] },
            $or: [
                { year: { $gt: 2026 } },
                { year: 0 },
                { year: null }
            ]
        });

        console.log(`Found ${suspicious.length} suspicious rankings to fix.`);

        for (const item of suspicious) {
            try {
                console.log(`Fixing [${item.contentType}] ${item.title} (Year: ${item.year})...`);
                // Delay for rate limiting
                await new Promise(r => setTimeout(r, 1000));
                
                const res = await apiClient.get(`https://api.jikan.moe/v4/${item.contentType}/${item.contentId}`, { retry: 1 });
                const data = res.data?.data;
                
                if (data) {
                    const correctYear = data.aired?.prop?.from?.year || data.published?.prop?.from?.year || data.year || (data.aired?.from ? new Date(data.aired.from).getFullYear() : null);
                    if (correctYear) {
                        item.year = correctYear;
                        await item.save();
                        console.log(`✅ Fixed: ${correctYear}`);
                    } else {
                        console.log(`❌ No year found in Jikan`);
                    }
                }
            } catch (err) {
                console.error(`Failed to fix ${item.title}: ${err.message}`);
            }
        }

        console.log('Finished fixing rankings.');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

fixRankings();
