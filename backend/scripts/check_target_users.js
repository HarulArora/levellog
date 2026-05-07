import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

import User from '../models/User.js';

async function checkUsers() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const u1 = await User.findById('69ee6e5372184f4cc0cd7214').lean();
        const u2 = await User.findById('69b1ddec7d5b6919ae1336a1').lean();
        const u3 = await User.findById('69b1e3fa74cd2b752fe83419').lean();

        console.log('User 1:', u1 ? u1.username : 'Not found');
        console.log('User 2:', u2 ? u2.username : 'Not found');
        console.log('User 3:', u3 ? u3.username : 'Not found');
        
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkUsers();
