import express from 'express'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import mongoSanitize from 'express-mongo-sanitize'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import dns from 'node:dns'
import * as Sentry from "@sentry/node"

// 🛡️ Global DNS Override to prevent intermittent ETIMEDOUT/ENOTFOUND errors from unreliable local ISPs
dns.setServers(['8.8.8.8', '1.1.1.1'])

import logger from './utils/logger.js'
import gamesRouter from './routes/games.js'
import authRouter from './routes/auth.js'
import igdbRouter from './routes/igdb.js'
import notificationsRouter from './routes/notifications.js'
import commentsRouter from './routes/comments.js'
import dealsRouter from './routes/deals.js'
import leaderboardRouter from './routes/leaderboard.js'
import animeRouter from './routes/anime.js'
import moviesRouter from './routes/movies.js'
import rankingsRouter from './routes/rankings.js'
import listsRouter from './routes/lists.js'

import { initXPCron } from './tasks/xpSync.js'
import { initRankingCrons } from './tasks/rankingsSync.js'

dotenv.config()

const app = express()

// 🛡️ Trust proxy for Render's load balancer (Fixes rate-limit warnings)
app.set('trust proxy', 1)

// ── Sentry Initialization ──────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        integrations: [
            ...Sentry.autoDiscoverNodeJSIntegrations(),
        ],
        tracesSampleRate: 0.1,
    })
    app.use(Sentry.Handlers.requestHandler())
    app.use(Sentry.Handlers.tracingHandler())
}

app.use(cors({
    origin: [
        'http://localhost:5173',
        'https://questduck.com',
        'https://www.questduck.com',
        'https://questduck.onrender.com',
        'https://levellog-b3tf.onrender.com',
        process.env.CLIENT_URL?.replace(/\/$/, '')
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Cookie']
}))

app.use(express.json({ limit: '10mb' }))
app.use(cookieParser())
app.use(compression()) // 🚀 Rocket fuel for payload speed

// 🛡️ Express 5 Fix: Manually allow Mutation for Sanitization
app.use((req, res, next) => {
    if (req.query) {
        Object.defineProperty(req, 'query', { value: { ...req.query }, writable: true, configurable: true, enumerable: true })
    }
    if (req.params) {
        Object.defineProperty(req, 'params', { value: { ...req.params }, writable: true, configurable: true, enumerable: true })
    }
    next()
})
app.use(mongoSanitize())
app.use(helmet({ 
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "script-src": ["'self'", "'unsafe-inline'", "https://accounts.google.com"],
            "connect-src": ["'self'", "http://localhost:5000", "https://questduck.com", "https://*.onrender.com", "https://*.googleapis.com"],
            "img-src": ["'self'", "data:", "https://images.igdb.com", "https://www.cheapshark.com", "https://*.googleusercontent.com", "https://cdn.myanimelist.net", "https://image.tmdb.org", "https://*.tmdb.org"],
            "frame-src": ["'self'", "https://accounts.google.com", "https://www.youtube.com", "https://youtube.com"],
            "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            "font-src": ["'self'", "https://fonts.gstatic.com"],
        },
    }
}))


const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: 'Too many attempts, please try again later' }
})

const appLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 1000,
})

app.use('/api/', appLimiter)
app.use('/api/auth/login', authLimiter)
app.use('/api/auth/signup', authLimiter)

app.use('/api/auth', authRouter)
app.use('/api/games', gamesRouter)
app.use('/api/igdb', igdbRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/comments', commentsRouter)
app.use('/api/deals', dealsRouter)
app.use('/api/leaderboard', leaderboardRouter)
app.use('/api/anime', animeRouter)
app.use('/api/movies', moviesRouter)
app.use('/api/rankings', rankingsRouter)
app.use('/api/lists', listsRouter)


app.get('/', (req, res) => res.json({ 
    success: true, 
    message: 'LevelLog API is running',
    docs: 'https://github.com/HarulArora/levellog' 
}))

app.get('/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }))

// ── Sentry Error Handler ──────────────────────────────────────────────
if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler())
}

// Global error handler
app.use((err, req, res, next) => {
    logger.error(`[Server Error] ${req.method} ${req.url}:`, err)
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message
    })
})


mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => {
        logger.info('✅ Connected to MongoDB')
        const PORT = process.env.PORT || 5000
        app.listen(PORT, () => {
            logger.info(`🚀 Server running on port ${PORT}`)
            initXPCron()   // 🛡️ Start weekly XP maintenance
            initRankingCrons() // 📊 Start rankings engine
        })
    })
    .catch((error) => {
        logger.error('❌ MongoDB connection failed:', error)
    })
