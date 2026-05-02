import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Game from '../models/Game.js';
import MovieEntry from '../models/MovieEntry.js';
import AnimeEntry from '../models/AnimeEntry.js';
import GameLike from '../models/GameLike.js';
import MovieLike from '../models/MovieLike.js';
import AnimeLike from '../models/AnimeLike.js';
import Comment from '../models/Comment.js';
import MovieComment from '../models/MovieComment.js';
import AnimeComment from '../models/AnimeComment.js';

dotenv.config();

async function investigateUser() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findOne({ username: 'Quest_Duck' });
        if (!user) {
            console.log('User @Quest_Duck not found.');
            return;
        }

        const userId = user._id;
        console.log(`Investigating @Quest_Duck (${userId})...\n`);

        const [
            games, movies, anime,
            gLikes, mLikes, aLikes,
            gComments, mComments, aComments
        ] = await Promise.all([
            Game.find({ userId }).lean(),
            MovieEntry.find({ userId }).lean(),
            AnimeEntry.find({ userId }).lean(),
            GameLike.find({ userId }).lean(),
            MovieLike.find({ userId }).lean(),
            AnimeLike.find({ userId }).lean(),
            Comment.find({ userId }).lean(),
            MovieComment.find({ userId }).lean(),
            AnimeComment.find({ userId }).lean()
        ]);

        console.log('--- LOGS & RATINGS ---');
        [...games, ...movies, ...anime].forEach(e => {
            console.log(`- [${e.type || 'game'}] "${e.title || e.gameTitle}" | Rating: ${e.rating || 0} | Created: ${e.createdAt}`);
        });

        console.log('\n--- LIKES ---');
        [...gLikes, ...mLikes, ...aLikes].forEach(l => {
            console.log(`- [${l.type || 'game'}] "${l.title || l.gameTitle}" | Created: ${l.createdAt}`);
        });

        console.log('\n--- COMMENTS ---');
        [...gComments, ...mComments, ...aComments].forEach(c => {
            console.log(`- [${c.type || 'game'}] Text: "${c.text.slice(0, 50)}..." | Created: ${c.createdAt}`);
        });

    } catch (err) {
        console.error(err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

investigateUser();
