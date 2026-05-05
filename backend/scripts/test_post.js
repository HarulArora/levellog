import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import Game from '../models/Game.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const testPostServerSide = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const user = await User.findOne({ username: 'Harul' }); // or whichever user they are

        const req = {
            user: user,
            body: {
                title: 'Dishonored',
                genre: 'Puzzle',
                status: 'completed',
                rating: 10,
                igdbId: 533
            }
        };

        const res = {
            status: (code) => ({
                json: (data) => {
                    console.log(`Status: ${code}`);
                    console.log(data);
                }
            }),
            json: (data) => console.log(data)
        };

        // Simulating the exact route logic
        const { title, genre, status, rating, hours, platforms, steamId, notes, cover, summary, igdbId } = req.body;
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const searchId = igdbId ? Number(igdbId) : null;
            let query = { userId: req.user._id };
            if (searchId) {
                query.igdbId = searchId;
            } else {
                query.title = { $regex: new RegExp(`^${title.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}$`, 'i') };
            }

            const existing = await Game.findOne(query).session(session);
            const isNew = !existing;

            const updateData = {
                userId: req.user._id,
                title, genre, status, rating, hours, platforms, steamId, notes, cover, summary, igdbId: searchId
            };

            const savedGame = await Game.findOneAndUpdate(
                query,
                { $set: updateData },
                { upsert: true, returnDocument: 'after', session }
            );

            console.log('Saved game OK!');
            // skipping rest to avoid duplicate counts...
            await session.abortTransaction();
            console.log('Done');
        } catch (e) {
            console.log('Error:', e);
            await session.abortTransaction();
        } finally {
            session.endSession();
        }

        process.exit(0);
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
};

testPostServerSide();
