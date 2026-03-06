import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cors from 'cors'
import gamesRouter from './routes/games.js'
import authRouter from './routes/auth.js'   // ← ADD THIS

dotenv.config()

const app = express()

app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}))
app.use(express.json())

// ── ROUTES ──
app.use('/api/auth', authRouter)     // ← ADD THIS
app.use('/api/games', gamesRouter)

app.get('/', (req, res) => {
    res.json({ message: '🎮 LevelLog API is running!' })
})

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        console.log('✅ Connected to MongoDB')
        const PORT = process.env.PORT || 5000
        app.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`)
        })
    })
    .catch((error) => {
        console.error('❌ MongoDB connection failed:', error.message)
    })