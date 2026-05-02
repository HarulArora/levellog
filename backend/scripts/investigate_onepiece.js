import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AnimeEntry from '../models/AnimeEntry.js';

dotenv.config();

async function investigate() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const entries = await AnimeEntry.find({ title: /One Piece/i }).lean();
        console.log('One Piece Entries:', JSON.stringify(entries, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

investigate();
