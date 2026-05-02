import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MovieComment from '../models/MovieComment.js';

dotenv.config();

async function fixComment() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const res = await MovieComment.updateOne(
            { _id: '69f255176fd55a7a645f6bb5' }, 
            { externalId: 70523 }
        );
        console.log('Update result:', res);
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

fixComment();
