import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cors from 'cors'
import gamesRouter from './routes/games.js'
import authRouter from './routes/auth.js'
import igdbRouter from './routes/igdb.js'
import notificationsRouter from './routes/notifications.js'
import listsRouter from './routes/lists.js'
import commentsRouter from './routes/comments.js'
import dealsRouter from './routes/deals.js'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoSanitize from 'express-mongo-sanitize'

// import paymentRouter from './routes/payment.js'
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
app.use(helmet({ 
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    contentSecurityPolicy: false
}))

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    message: { success: false, message: 'Too many attempts, please try again later' }
})

const appLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000, // high limit for standard API calls
})
app.use('/api/', appLimiter)

app.use('/api/auth/login', authLimiter)
app.use('/api/auth/signup', authLimiter)

app.use('/api/auth', authRouter)
app.use('/api/games', gamesRouter)
app.use('/api/igdb', igdbRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/lists', listsRouter)
app.use('/api/comments', commentsRouter)
app.use('/api/deals', dealsRouter)
// app.use('/api/payment', paymentRouter)
app.get('/health', (req, res) => res.send('OK'))


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
