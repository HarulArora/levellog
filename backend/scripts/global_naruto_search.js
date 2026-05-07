import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

async function searchGlobal() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        
        for (const col of collections) {
            const name = col.name;
            const count = await db.collection(name).countDocuments({ 
                $or: [
                    { title: /naruto/i },
                    { gameTitle: /naruto/i },
                    { name: /naruto/i }
                ]
            });
            if (count > 0) {
                console.log(`Collection ${name} has ${count} Naruto records.`);
                const records = await db.collection(name).find({ 
                    $or: [
                        { title: /naruto/i },
                        { gameTitle: /naruto/i },
                        { name: /naruto/i }
                    ]
                }).limit(5).toArray();
                records.forEach(r => console.log(` - ID: ${r._id}, Title: ${r.title || r.gameTitle || r.name}, User: ${r.userId}`));
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

searchGlobal();
