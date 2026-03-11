import express from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

import User from '../models/User.js'
import Notification from '../models/Notification.js'
import FollowRequest from '../models/FollowRequest.js'
import protect from '../middleware/auth.js'
import { awardXP, deductXP } from '../utils/xp.js'

const router = express.Router()

const createToken = (userId) =>
    jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '30d' })

const userPayload = (user) => ({
    id: user._id,
    _id: user._id,
    username: user.username,
    email: user.email,
    isPrivate: user.isPrivate,
    avatar: user.avatar || '',
    bio: user.bio || '',
    xp: user.xp || 0,
    level: user.level || 1,
    badge: user.badge || '🎮',
})


// ── GET /api/auth/check-username?username=xxx ─────────────────────────────────
router.get('/check-username', async (req, res) => {
    try {
        const { username } = req.query
        if (!username || username.trim().length < 3) {
            return res.json({ available: false, message: 'Min 3 characters' })
        }
        if (username.trim().length > 20) {
            return res.json({ available: false, message: 'Max 20 characters' })
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
            return res.json({ available: false, message: 'Letters, numbers, underscores only' })
        }
        const existing = await User.findOne({ username: username.trim() })
        if (existing) {
            return res.json({ available: false, message: 'Username already taken' })
        }
        return res.json({ available: true, message: 'Username is available' })
    } catch (err) {
        res.status(500).json({ available: false, message: 'Check failed' })
    }
})


// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body
        if (!username || !email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide username, email and password' })
        }

        const emailExists = await User.findOne({ email: email.toLowerCase() })
        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists. Try logging in instead.',
                field: 'email',
            })
        }

        const usernameExists = await User.findOne({ username: username.trim() })
        if (usernameExists) {
            return res.status(400).json({
                success: false,
                message: 'Username already taken',
                field: 'username',
            })
        }

        const user = await User.create({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            password,
        })

        const token = createToken(user._id)
        res.status(201).json({
            success: true,
            message: 'Account created successfully!',
            token,
            user: userPayload(user),
        })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Signup failed', error: error.message })
    }
})


// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Please provide email and password' })
        }

        const user = await User.findOne({ email: email.toLowerCase() })
        if (!user) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' })
        }

        if (user.googleId && !user.password) {
            return res.status(401).json({
                success: false,
                message: 'This account uses Google Sign-In. Please continue with Google.',
            })
        }

        const isPasswordCorrect = await user.comparePassword(password)
        if (!isPasswordCorrect) {
            return res.status(401).json({ success: false, message: 'Invalid email or password' })
        }

        const token = createToken(user._id)
        res.json({ success: true, message: 'Logged in successfully', token, user: userPayload(user) })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Login failed', error: error.message })
    }
})


// ── POST /api/auth/google ─────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
    try {
        const { accessToken } = req.body
        if (!accessToken) {
            return res.status(400).json({ success: false, message: 'No Google token provided' })
        }

        const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        })

        if (!googleRes.ok) {
            return res.status(401).json({ success: false, message: 'Invalid Google token' })
        }

        const { sub: googleId, email, name, picture } = await googleRes.json()

        if (!email) {
            return res.status(401).json({ success: false, message: 'Could not get email from Google' })
        }

        let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] })

        if (user) {
            if (!user.googleId) {
                user.googleId = googleId
                if (!user.avatar && picture) user.avatar = picture
                await user.save()
            }
        } else {
            let baseUsername = (name || 'user')
                .replace(/\s+/g, '_')
                .replace(/[^a-zA-Z0-9_]/g, '')
                .slice(0, 16)
            if (!baseUsername) baseUsername = 'user'
            let username = baseUsername
            let counter = 1
            while (await User.findOne({ username })) {
                username = `${baseUsername}${counter++}`
            }

            user = await User.create({
                username,
                email: email.toLowerCase(),
                password: crypto.randomBytes(32).toString('hex'),
                googleId,
                avatar: picture || '',
            })
        }

        const token = createToken(user._id)
        res.json({ success: true, message: 'Logged in with Google', token, user: userPayload(user) })
    } catch (error) {
        console.error('Google auth error:', error)
        res.status(500).json({ success: false, message: 'Google sign-in failed', error: error.message })
    }
})


// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password')
        if (!user) return res.status(404).json({ success: false, message: 'User not found' })
        res.json({ success: true, user })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})


// ── GET /api/auth/profile/:username ──────────────────────────────────────────
router.get('/profile/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username }).select('-password -email')
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' })
        }

        const validFollowerIds = await User.find({ _id: { $in: user.followers } }, '_id')
        const validFollowingIds = await User.find({ _id: { $in: user.following } }, '_id')
        const validFollowers = validFollowerIds.map(u => u._id)
        const validFollowing = validFollowingIds.map(u => u._id)

        if (validFollowers.length !== user.followers.length)
            await User.findByIdAndUpdate(user._id, { $set: { followers: validFollowers } })
        if (validFollowing.length !== user.following.length)
            await User.findByIdAndUpdate(user._id, { $set: { following: validFollowing } })

        const userObj = user.toObject()
        userObj.followers = validFollowers
        userObj.following = validFollowing
        res.json({ success: true, user: userObj })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message })
    }
})


// ── POST /api/auth/follow/:userId ─────────────────────────────────────────────
router.post('/follow/:userId', protect, async (req, res) => {
    try {
        if (req.params.userId === req.user._id.toString()) {
            return res.status(400).json({ success: false, message: 'You cannot follow yourself' })
        }
        const userToFollow = await User.findById(req.params.userId)
        if (!userToFollow) return res.status(404).json({ success: false, message: 'User not found' })

        const alreadyFollowing = userToFollow.followers.includes(req.user._id)
        if (alreadyFollowing) return res.status(400).json({ success: false, message: 'Already following this user' })

        if (userToFollow.isPrivate) {
            const existingRequest = await FollowRequest.findOne({ sender: req.user._id, recipient: req.params.userId, status: 'pending' })
            if (existingRequest) return res.status(400).json({ success: false, message: 'Follow request already sent' })
            await FollowRequest.create({ sender: req.user._id, recipient: req.params.userId })
            await Notification.create({ recipient: req.params.userId, sender: req.user._id, type: 'follow_request' })
            return res.json({ success: true, message: 'Follow request sent · XP awarded on accept', type: 'request_sent' })
        }

        await User.findByIdAndUpdate(req.params.userId, { $push: { followers: req.user._id } })
        await User.findByIdAndUpdate(req.user._id, { $push: { following: req.params.userId } })
        await Notification.create({ recipient: req.params.userId, sender: req.user._id, type: 'follow' })
        await Promise.all([awardXP(req.user._id, 1), awardXP(req.params.userId, 1)])
        res.json({ success: true, message: 'Following · +1 XP', type: 'followed' })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to follow user', error: error.message })
    }
})


// ── POST /api/auth/unfollow/:userId ───────────────────────────────────────────
router.post('/unfollow/:userId', protect, async (req, res) => {
    try {
        const userToUnfollow = await User.findById(req.params.userId)
        if (!userToUnfollow) return res.status(404).json({ success: false, message: 'User not found' })
        await FollowRequest.findOneAndDelete({ sender: req.user._id, recipient: req.params.userId, status: 'pending' })
        await User.findByIdAndUpdate(req.params.userId, { $pull: { followers: req.user._id } })
        await User.findByIdAndUpdate(req.user._id, { $pull: { following: req.params.userId } })
        await Promise.all([deductXP(req.user._id, 1), deductXP(req.params.userId, 1)])
        res.json({ success: true, message: 'Unfollowed · -1 XP' })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to unfollow user', error: error.message })
    }
})


// ── PATCH /api/auth/privacy ───────────────────────────────────────────────────
router.patch('/privacy', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        user.isPrivate = !user.isPrivate
        await user.save()
        res.json({ success: true, message: user.isPrivate ? 'Profile is now private' : 'Profile is now public', isPrivate: user.isPrivate })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update privacy', error: error.message })
    }
})


// ── GET /api/auth/feed ────────────────────────────────────────────────────────
router.get('/feed', protect, async (req, res) => {
    try {
        const currentUser = await User.findById(req.user._id)
        if (currentUser.following.length === 0) {
            return res.json({ success: true, games: [], message: 'Follow some users to see their games here' })
        }
        const Game = (await import('../models/Game.js')).default
        const games = await Game.find({ userId: { $in: currentUser.following } })
            .sort({ createdAt: -1 }).limit(20).populate('userId', 'username')
        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch feed', error: error.message })
    }
})


// ── GET /api/auth/search?q=username ──────────────────────────────────────────
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q
        if (!query || query.trim().length < 2) return res.json({ success: true, users: [] })
        const users = await User.find({ username: { $regex: query.trim(), $options: 'i' } })
            .select('-password -email').limit(10)
        res.json({ success: true, users })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Search failed', error: error.message })
    }
})


// ── GET /api/auth/followers/:userId ──────────────────────────────────────────
router.get('/followers/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate('followers', 'username bio isPrivate followers badge level')
        if (!user) return res.status(404).json({ success: false, message: 'User not found' })
        res.json({ success: true, users: user.followers })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch followers', error: error.message })
    }
})


// ── GET /api/auth/following/:userId ──────────────────────────────────────────
router.get('/following/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).populate('following', 'username bio isPrivate followers badge level')
        if (!user) return res.status(404).json({ success: false, message: 'User not found' })
        res.json({ success: true, users: user.following })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch following', error: error.message })
    }
})


// ── PUT /api/auth/profile ─────────────────────────────────────────────────────
router.put('/profile', protect, async (req, res) => {
    try {
        const { username, bio, avatar } = req.body
        const updates = {}

        if (username !== undefined) {
            const trimmed = username.trim()
            if (trimmed.length < 3 || trimmed.length > 20)
                return res.status(400).json({ success: false, message: 'Username must be 3–20 characters' })
            const existing = await User.findOne({ username: trimmed, _id: { $ne: req.user._id } })
            if (existing)
                return res.status(400).json({ success: false, message: 'Username already taken' })
            updates.username = trimmed
        }

        if (bio !== undefined) {
            if (bio.length > 200)
                return res.status(400).json({ success: false, message: 'Bio max 200 characters' })
            updates.bio = bio.trim()
        }

        if (avatar !== undefined) updates.avatar = avatar

        const updatedUser = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { new: true })
        res.json({
            success: true,
            user: {
                _id: updatedUser._id,
                username: updatedUser.username,
                email: updatedUser.email,
                bio: updatedUser.bio,
                avatar: updatedUser.avatar,
                isPrivate: updatedUser.isPrivate,
                xp: updatedUser.xp,
                level: updatedUser.level,
                badge: updatedUser.badge,
            }
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})


export default router
