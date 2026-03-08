import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cors from 'cors'
import gamesRouter from './routes/games.js'
import authRouter from './routes/auth.js'
import igdbRouter from './routes/igdb.js'
import notificationsRouter from './routes/notifications.js'
import listsRouter from './routes/lists.js'

dotenv.config()

const app = express()

app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://levellog-frontend.onrender.com'
    ],
    credentials: true
}))

app.use(express.json())

app.use('/api/auth', authRouter)
app.use('/api/games', gamesRouter)
app.use('/api/igdb', igdbRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/lists', listsRouter)

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