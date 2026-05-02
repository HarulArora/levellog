import mongoose from 'mongoose';
import dotenv from 'dotenv';
import MovieComment from '../models/MovieComment.js';
import MovieEntry from '../models/MovieEntry.js';

dotenv.config();

async function checkComment() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const comments = await MovieComment.find({ externalId: 70523 }).lean();
        console.log('Comments for Dark (70523):', JSON.stringify(comments, null, 2));

        const boysComments = await MovieComment.find({ externalId: 76479 }).lean();
        console.log('Comments for The Boys (76479):', JSON.stringify(boysComments, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
    }
}

checkComment();
