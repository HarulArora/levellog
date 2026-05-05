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
import Follow from '../models/Follow.js';

dotenv.config({ path: '../.env' });

async function diagnoseXP() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const users = await User.find({});
        console.log(`Checking ${users.length} users...`);

        const mismatchedUsers = [];

        for (const user of users) {
            const userId = user._id;

            // Fetch all XP-earning entities
            const [
                games, movies, anime,
                gameLikes, movieLikes, animeLikes,
                gameComments, movieComments, animeComments,
                following, followers
            ] = await Promise.all([
                Game.find({ userId }),
                MovieEntry.find({ userId }),
                AnimeEntry.find({ userId }),
                GameLike.find({ userId }),
                MovieLike.find({ userId }),
                AnimeLike.find({ userId }),
                Comment.find({ userId }),
                MovieComment.find({ userId }),
                AnimeComment.find({ userId }),
                Follow.find({ followerId: userId }),
                Follow.find({ followingId: userId })
            ]);

            let expectedXP = 0;
            
            // 1. Logs (+1 per entry)
            expectedXP += games.length + movies.length + anime.length;
            
            // 2. Ratings (+1 per entry if rating > 0)
            expectedXP += games.filter(g => (g.rating || 0) > 0).length;
            expectedXP += movies.filter(m => (m.rating || 0) > 0).length;
            expectedXP += anime.filter(a => (a.rating || 0) > 0).length;
            
            // 3. Likes (+1 per like)
            expectedXP += gameLikes.length + movieLikes.length + animeLikes.length;
            
            // 4. Comments (+1 per comment)
            expectedXP += gameComments.length + movieComments.length + animeComments.length;
            
            // 5. Follows (+1 for following and +1 for being followed)
            expectedXP += following.length + followers.length;

            if (user.xp !== expectedXP) {
                mismatchedUsers.push({
                    username: user.username,
                    currentXP: user.xp,
                    calculatedXP: expectedXP,
                    diff: expectedXP - user.xp,
                    details: {
                        logs: games.length + movies.length + anime.length,
                        ratings: games.filter(g => (g.rating || 0) > 0).length + movies.filter(m => (m.rating || 0) > 0).length + anime.filter(a => (a.rating || 0) > 0).length,
                        likes: gameLikes.length + movieLikes.length + animeLikes.length,
                        comments: gameComments.length + movieComments.length + animeComments.length,
                        following: following.length,
                        followers: followers.length
                    }
                });
            }
        }

        console.log('\n--- XP Mismatch Report ---');
        console.log(`Total mismatched accounts found: ${mismatchedUsers.length}`);
        
        if (mismatchedUsers.length > 0) {
            console.log('\nMismatched Accounts:');
            mismatchedUsers.forEach(u => {
                console.log(`- @${u.username}: Current=${u.currentXP} | Expected=${u.calculatedXP} (Diff: ${u.diff > 0 ? '+' : ''}${u.diff})`);
                console.log(`  Details: [Logs: ${u.details.logs}, Ratings: ${u.details.ratings}, Likes: ${u.details.likes}, Comments: ${u.details.comments}, Following: ${u.details.following}, Followers: ${u.details.followers}]`);
            });
        } else {
            console.log('✨ All account XP matches perfectly!');
        }

    } catch (err) {
        console.error('❌ Error during diagnosis:', err);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

diagnoseXP();
