import express from 'express'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import axios from 'axios'
import { z } from 'zod'

import User from '../models/User.js'
import Follow from '../models/Follow.js'
import Notification from '../models/Notification.js'
import FollowRequest from '../models/FollowRequest.js'
import protect from '../middleware/auth.js'
import { awardXP, deductXP } from '../utils/xp.js'
import { 
    sendVerificationEmail, 
    sendResetPasswordEmail, 
    sendWelcomeEmail, 
    sendPasswordResetSuccessEmail,
    sendAccountLinkedEmail,
    sendAccountUnlinkedEmail
} from '../utils/email.js'
import { optimizeAvatar } from '../utils/image.js'
import logger from '../utils/logger.js'

const router = express.Router()

// Simple profanity list for common offensive terms
const BLOOCKED_WORDS = ['admin', 'moderator', 'support', 'questdeck', 'levellog', 'staff', 'offensive', 'slur', 'nazi', 'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy']

const isProfane = (str) => {
    const s = str.toLowerCase()
    return BLOOCKED_WORDS.some(word => s.includes(word))
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,6}$/

const sendTokenResponse = (user, statusCode, res) => {
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
        expiresIn: '7d',
    })

    const cookieOptions = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    }

    res.status(statusCode)
        .cookie('questdeck_token', token, cookieOptions)
        .json({
            success: true,
            token, // still sending for mobile compatibility if needed
            user: userPayload(user),
        })
}

const generateVerificationCode = () => {
    return Math.floor(100000 + Math.random() * 900000).toString()
}

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
    googleId: user.googleId || null,
    hasPassword: !!user.password,
})

// ── GET /api/auth/check-username ─────────────────────────────────────────────
router.get('/check-username', async (req, res) => {
    try {
        const { username } = req.query
        if (!username || username.trim().length < 3)
            return res.json({ available: false, message: 'Min 3 characters' })
        if (username.trim().length > 12)
            return res.json({ available: false, message: 'Max 12 characters' })
        if (!/^[a-zA-Z0-9_]+$/.test(username.trim()))
            return res.json({ available: false, message: 'Letters, numbers, underscores only' })
        if (isProfane(username))
            return res.json({ available: false, message: 'Username is not allowed' })

        const existing = await User.findOne({ username: username.trim() })
        
        if (existing) {
            // Unverified and Expired = Available for recapture
            if (!existing.isEmailVerified && existing.emailVerifyExpires < Date.now()) {
                 return res.json({ available: true, message: 'Available (old record expired)' })
            }
            // Unverified but NOT expired = Temporarily blocked
            if (!existing.isEmailVerified) {
                return res.json({ available: false, message: 'Reserved for 10 min for verification' })
            }
            // Fully verified = Taken
            return res.json({ available: false, message: 'Username already taken' })
        }
        
        return res.json({ available: true, message: 'Username is available' })
    } catch {
        res.status(500).json({ available: false, message: 'Check failed' })
    }
})

// ── POST /api/auth/signup ─────────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body
        if (!username || !email || !password)
            return res.status(400).json({ success: false, message: 'Please provide username, email and password' })

        if (!EMAIL_REGEX.test(email))
            return res.status(400).json({ success: false, message: 'Please provide a valid email address' })

        if (isProfane(username))
            return res.status(400).json({ success: false, message: 'Username contains restricted words', field: 'username' })

        const emailExists = await User.findOne({ email: email.toLowerCase().trim() })
        if (emailExists) {
            if (!emailExists.isEmailVerified && emailExists.emailVerifyExpires < Date.now()) {
                await User.findByIdAndDelete(emailExists._id)
            } else {
                return res.status(400).json({ success: false, message: 'An account with this email already exists.', field: 'email' })
            }
        }

        const usernameExists = await User.findOne({ username: username.trim() })
        if (usernameExists) {
            if (!usernameExists.isEmailVerified && usernameExists.emailVerifyExpires < Date.now()) {
                await User.findByIdAndDelete(usernameExists._id)
            } else {
                return res.status(400).json({ success: false, message: 'Username already taken', field: 'username' })
            }
        }

        const verificationCode = generateVerificationCode()
        const verificationExpires = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

        const user = await User.create({
            username: username.trim(),
            email: email.toLowerCase().trim(),
            password,
            isEmailVerified: false,
            emailVerifyToken: verificationCode,
            emailVerifyExpires: verificationExpires
        })

        // Send verification email
        const emailResult = await sendVerificationEmail(user.email, user.username, verificationCode)
        
        if (!emailResult.success) {
            // If email fails, we might want to inform the user but the account is created.
            // However, usually it's better to fail the request so they can try again.
            await User.findByIdAndDelete(user._id)
            return res.status(500).json({ success: false, message: 'Failed to send verification email. Please check your SMTP settings.' })
        }

        res.status(201).json({
            success: true,
            message: 'Account created! Please verify your email.',
            email: user.email,
            requiresVerification: true
        })
    } catch (error) {
        logger.error('Signup error:', error)
        res.status(500).json({ success: false, message: 'Signup failed. Please try again.' })
    }
})

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body
        if (!email || !password)
            return res.status(400).json({ success: false, message: 'Please provide email and password' })

        const user = await User.findOne({ email: email.toLowerCase().trim() })
        if (!user)
            return res.status(401).json({ success: false, message: 'Invalid email or password' })

        if (user.googleId && !user.password)
            return res.status(401).json({ success: false, message: 'This account uses Google Sign-In.' })

        const isPasswordCorrect = await user.comparePassword(password)
        if (!isPasswordCorrect)
            return res.status(401).json({ success: false, message: 'Invalid email or password' })

        if (!user.isEmailVerified) {
            return res.status(403).json({
                success: false,
                message: 'Please verify your email to log in.',
                requiresVerification: true,
                email: user.email
            })
        }

        sendTokenResponse(user, 200, res)
    } catch (error) {
        logger.error('Login error:', error)
        res.status(500).json({ success: false, message: 'Login failed. Please try again.' })
    }
})

// ── POST /api/auth/logout ─────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
    res.cookie('questdeck_token', '', {
        expires: new Date(0),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    })
    res.json({ success: true, message: 'Logged out successfully' })
})

// ── POST /api/auth/verify-email ────────────────────────────────────────────────
router.post('/verify-email', async (req, res) => {
    try {
        const { email, code } = req.body
        if (!email || !code)
            return res.status(400).json({ success: false, message: 'Email and code are required' })

        const user = await User.findOne({
            email: email.toLowerCase(),
            emailVerifyToken: code,
            emailVerifyExpires: { $gt: Date.now() }
        })

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired verification code' })
        }

        user.isEmailVerified = true
        user.emailVerifyToken = null
        user.emailVerifyExpires = null
        await user.save()

        // Send Welcome email
        await sendWelcomeEmail(user.email, user.username)

        sendTokenResponse(user, 200, res)
    } catch (error) {
        logger.error('Verification error:', error)
        res.status(500).json({ success: false, message: 'Verification failed' })
    }
})

// ── POST /api/auth/resend-verification ─────────────────────────────────────────
router.post('/resend-verification', async (req, res) => {
    try {
        const { email } = req.body
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' })

        const user = await User.findOne({ email: email.toLowerCase() })
        if (!user) return res.status(404).json({ success: false, message: 'User not found' })

        if (user.isEmailVerified)
            return res.status(400).json({ success: false, message: 'Email is already verified' })

        const verificationCode = generateVerificationCode()
        user.emailVerifyToken = verificationCode
        user.emailVerifyExpires = new Date(Date.now() + 10 * 60 * 1000)
        await user.save()

        const emailResult = await sendVerificationEmail(user.email, user.username, verificationCode)
        if (!emailResult.success) {
            return res.status(500).json({ success: false, message: 'Failed to send verification code. Please try again later.' })
        }
        res.json({ success: true, message: 'Verification code resent!' })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to resend code' })
    }
})

// ── POST /api/auth/forgot-password ─────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' })

        const user = await User.findOne({ email: email.toLowerCase() })
        if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' })

        const resetCode = generateVerificationCode()
        user.resetPasswordToken = resetCode
        user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000)
        await user.save()

        const emailResult = await sendResetPasswordEmail(user.email, user.username, resetCode)
        if (!emailResult.success) {
            return res.status(500).json({ success: false, message: 'Failed to send reset code. Please try again later.' })
        }
        res.json({ success: true, message: 'Password reset code sent to your email' })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to process forgot password' })
    }
})

// ── POST /api/auth/reset-password ──────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
    try {
        const { email, code, newPassword } = req.body
        if (!email || !code || !newPassword)
            return res.status(400).json({ success: false, message: 'All fields are required' })

        if (newPassword.length < 6)
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' })

        const user = await User.findOne({
            email: email.toLowerCase(),
            resetPasswordToken: code,
            resetPasswordExpires: { $gt: Date.now() }
        })

        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset code' })
        }

        // Check if new password is same as old
        const isSamePassword = await user.comparePassword(newPassword)
        if (isSamePassword) {
            return res.status(400).json({ success: false, message: 'New password cannot be the same as the old password' })
        }

        user.password = newPassword
        user.resetPasswordToken = null
        user.resetPasswordExpires = null
        // Also verify email if it wasn't
        user.isEmailVerified = true 
        await user.save()

        // Send reset success email
        await sendPasswordResetSuccessEmail(user.email, user.username)

        res.json({ success: true, message: 'Password reset successfully! You can now log in.' })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to reset password' })
    }
})

// ── POST /api/auth/google ─────────────────────────────────────────────────────
router.post('/google', async (req, res) => {
    try {
        const { accessToken } = req.body
        if (!accessToken)
            return res.status(400).json({ success: false, message: 'No Google token provided' })

        const { data: googleData } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        })
        
        const { sub: googleId, email, name, picture } = googleData
        if (!email)
            return res.status(401).json({ success: false, message: 'Could not get email from Google' })

        let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] })
        if (user) {
            if (!user.googleId) {
                user.googleId = googleId
                if (!user.avatar && picture) user.avatar = picture
                await user.save()
            }
        } else {
            let baseUsername = (name || 'user').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 12)
            if (!baseUsername) baseUsername = 'user'
            let username = baseUsername
            let counter = 1
            
            // Loop until we find a unique username that is <= 12 characters
            while (await User.findOne({ username })) {
                // If adding the counter makes it too long, trim the base further
                let suffix = counter.toString()
                let availableSpace = 12 - suffix.length
                username = baseUsername.slice(0, availableSpace) + suffix
                counter++
            }
            user = await User.create({ 
                username, 
                email: email.toLowerCase(), 
                password: null, // No password set yet
                googleId, 
                avatar: picture || '',
                isEmailVerified: true // Google accounts are pre-verified
            })
        }

        sendTokenResponse(user, 200, res)
    } catch (error) {
        logger.error('Google login error:', error)
        res.status(500).json({ success: false, message: 'Google sign-in failed', error: error.message })
    }
})

// ── POST /api/auth/link-google ──────────────────────────────────────────────
router.post('/link-google', protect, async (req, res) => {
    try {
        const { accessToken } = req.body
        if (!accessToken) return res.status(400).json({ success: false, message: 'No Google token provided' })

        const { data: googleData } = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` }
        })

        const { sub: googleId, email, picture } = googleData
        
        // 1. Check if this google account is already linked to SOME OTHER user
        const alreadyLinked = await User.findOne({ googleId })
        if (alreadyLinked) {
            if (alreadyLinked._id.toString() === req.user._id.toString()) {
                return res.status(400).json({ success: false, message: 'Google account already linked to this profile' })
            }
            return res.status(400).json({ success: false, message: 'This Google account is already linked to another user' })
        }

        const user = await User.findById(req.user._id)
        user.googleId = googleId
        if (!user.avatar && picture) user.avatar = picture
        await user.save()

        // Send confirmation email
        sendAccountLinkedEmail(user.email, user.username, 'Google').catch(err => logger.error('Email error:', err))

        res.json({ success: true, message: 'Google account linked successfully', user: userPayload(user) })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to link Google account' })
    }
})

// ── POST /api/auth/unlink-google ──────────────────────────────────────────────
router.post('/unlink-google', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        
        if (!user.password) {
            return res.status(400).json({ success: false, message: 'Cannot unlink Google account without a set password. Please set a password first.' })
        }

        user.googleId = null
        await user.save()

        // Send confirmation email
        sendAccountUnlinkedEmail(user.email, user.username, 'Google').catch(err => logger.error('Email error:', err))

        res.json({ success: true, message: 'Google account unlinked successfully', user: userPayload(user) })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to unlink Google account' })
    }
})

router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        if (!user) return res.status(404).json({ success: false, message: 'User not found' })
        res.json({ success: true, user: userPayload(user) })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── PATCH /api/auth/set-password ──────────────────────────────────────────────
router.patch('/set-password', protect, async (req, res) => {
    try {
        const { password } = req.body
        if (!password || password.length < 6) 
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' })
        
        const user = await User.findById(req.user._id)
        if (user.password) 
            return res.status(400).json({ success: false, message: 'Password already exists. Use change password instead.' })
        
        user.password = password
        await user.save()
        
        res.json({ success: true, message: 'Password set successfully!', user: userPayload(user) })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── PATCH /api/auth/change-password ──────────────────────────────────────────
router.patch('/change-password', protect, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body
        if (!currentPassword || !newPassword || newPassword.length < 6)
            return res.status(400).json({ success: false, message: 'Invalid inputs' })

        const user = await User.findById(req.user._id)
        const isMatch = await user.comparePassword(currentPassword)
        if (!isMatch) return res.status(400).json({ success: false, message: 'Incorrect current password' })

        if (currentPassword === newPassword)
            return res.status(400).json({ success: false, message: 'New password cannot be same as current' })

        user.password = newPassword
        await user.save()

        // Send confirmation email
        sendPasswordResetSuccessEmail(user.email, user.username).catch(err => logger.error('Email error:', err))

        res.json({ success: true, message: 'Password updated successfully!' })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/auth/profile/:username ──────────────────────────────────────────
router.get('/profile/:username', async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username })
            .select('-password -email -emailVerifyToken -resetPasswordToken')
        if (!user) return res.status(404).json({ success: false, message: 'User not found' })

        const [followerCount, followingCount] = await Promise.all([
            Follow.countDocuments({ followingId: user._id }),
            Follow.countDocuments({ followerId: user._id }),
        ])

        // check if the logged-in user follows this profile or has a pending request
        let isFollowedByMe = false
        let isRequestedByMe = false
        let followsMe = false
        const token = req.cookies?.questdeck_token || req.headers.authorization?.split(' ')[1]
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET)
                const [followDoc, requestDoc, followsMeDoc] = await Promise.all([
                    Follow.findOne({ followerId: decoded.userId, followingId: user._id }),
                    FollowRequest.findOne({ sender: decoded.userId, recipient: user._id, status: 'pending' }),
                    Follow.findOne({ followerId: user._id, followingId: req.user?._id || decoded.userId })
                ])
                isFollowedByMe = !!followDoc
                isRequestedByMe = !!requestDoc
                followsMe = !!followsMeDoc
            } catch { /* not logged in or bad token */ }
        }

        const userObj = user.toObject()
        userObj.followerCount = followerCount
        userObj.followingCount = followingCount
        userObj.isFollowedByMe = isFollowedByMe
        userObj.isRequestedByMe = isRequestedByMe
        userObj.followsMe = followsMe

        res.json({ success: true, user: userObj })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch profile', error: error.message })
    }
})

// ── POST /api/auth/follow/:userId ─────────────────────────────────────────────
router.post('/follow/:userId', protect, async (req, res) => {
    try {
        const targetId = req.params.userId
        if (targetId === req.user._id.toString())
            return res.status(400).json({ success: false, message: 'You cannot follow yourself' })

        const userToFollow = await User.findById(targetId)
        if (!userToFollow) return res.status(404).json({ success: false, message: 'User not found' })

        const alreadyFollowing = await Follow.findOne({ followerId: req.user._id, followingId: targetId })
        if (alreadyFollowing) return res.status(400).json({ success: false, message: 'Already following this user' })

        if (userToFollow.isPrivate) {
            const existingRequest = await FollowRequest.findOne({ sender: req.user._id, recipient: targetId })
            if (existingRequest) return res.status(400).json({ success: false, message: 'Follow request already sent' })
            await FollowRequest.create({ sender: req.user._id, recipient: targetId })
            await Notification.create({ recipient: targetId, sender: req.user._id, type: 'follow_request' })
            return res.json({ success: true, message: 'Follow request sent', type: 'request_sent' })
        }

        await Follow.create({ followerId: req.user._id, followingId: targetId })
        await Promise.all([
            User.findByIdAndUpdate(targetId, { $inc: { followerCount: 1 } }),
            User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } }),
            Notification.create({ recipient: targetId, sender: req.user._id, type: 'follow' }),
            awardXP(req.user._id, 1),
            awardXP(targetId, 1),
        ])

        res.json({ success: true, message: 'Following · +1 XP', type: 'followed' })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to follow user', error: error.message })
    }
})

// ── POST /api/auth/unfollow/:userId ───────────────────────────────────────────
router.post('/unfollow/:userId', protect, async (req, res) => {
    try {
        const targetId = req.params.userId
        const deleted = await Follow.findOneAndDelete({ followerId: req.user._id, followingId: targetId })
        if (!deleted) return res.status(400).json({ success: false, message: 'You are not following this user' })

        await Promise.all([
            User.findByIdAndUpdate(targetId, { $inc: { followerCount: -1 } }),
            User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } }),
            FollowRequest.findOneAndDelete({ sender: req.user._id, recipient: targetId }),
            deductXP(req.user._id, 1),
            deductXP(targetId, 1),
        ])

        res.json({ success: true, message: 'Unfollowed · -1 XP' })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to unfollow user', error: error.message })
    }
})

// ── DELETE /api/auth/follow-request/cancel/:userId ───────────────────
router.delete('/follow-request/cancel/:userId', protect, async (req, res) => {
    try {
        const targetId = req.params.userId
        const deletedRequest = await FollowRequest.findOneAndDelete({
            sender: req.user._id,
            recipient: targetId,
            status: 'pending'
        })
        if (!deletedRequest) return res.status(404).json({ success: false, message: 'No pending follow request found' })

        await Notification.findOneAndDelete({ recipient: targetId, sender: req.user._id, type: 'follow_request' })
        res.json({ success: true, message: 'Follow request cancelled' })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to cancel request', error: error.message })
    }
})

// ── PATCH /api/auth/privacy ───────────────────────────────────────────────────
router.patch('/privacy', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        user.isPrivate = !user.isPrivate
        await user.save()
        res.json({ success: true, isPrivate: user.isPrivate })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to update privacy', error: error.message })
    }
})

// ── GET /api/auth/feed ────────────────────────────────────────────────────────
router.get('/feed', protect, async (req, res) => {
    try {
        const following = await Follow.find({ followerId: req.user._id }).select('followingId')
        const followingIds = following.map(f => f.followingId)

        if (followingIds.length === 0)
            return res.json({ success: true, games: [], message: 'Follow some users to see their games here' })

        const Game = (await import('../models/Game.js')).default
        const games = await Game.find({ userId: { $in: followingIds } })
            .sort({ createdAt: -1 }).limit(20).populate('userId', 'username')

        res.json({ success: true, games })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch feed', error: error.message })
    }
})

// ── GET /api/auth/search ──────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q
        if (!query || query.trim().length < 2) return res.json({ success: true, users: [] })
        const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const users = await User.find({ username: { $regex: escapedQuery, $options: 'i' } })
            .select('-password -email').limit(10)

        // check followsMe for each user if logged in
        let loggedInId = null
        const authHeader = req.headers.authorization
        if (authHeader?.startsWith('Bearer ')) {
            try {
                const token = authHeader.split(' ')[1]
                const decoded = jwt.verify(token, process.env.JWT_SECRET)
                loggedInId = decoded.userId
            } catch { }
        }

        const enriched = await Promise.all(users.map(async u => {
            const uObj = u.toObject()
            if (loggedInId) {
                const [follow, sentReq, followedBy] = await Promise.all([
                    Follow.findOne({ followerId: loggedInId, followingId: u._id }),
                    FollowRequest.findOne({ sender: loggedInId, recipient: u._id, status: 'pending' }),
                    Follow.findOne({ followerId: u._id, followingId: loggedInId })
                ])
                uObj.isFollowedByMe = !!follow
                uObj.isRequestedByMe = !!sentReq
                uObj.followsMe = !!followedBy
            } else {
                uObj.isFollowedByMe = false
                uObj.isRequestedByMe = false
                uObj.followsMe = false
            }
            return uObj
        }))

        res.json({ success: true, users: enriched })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Search failed', error: error.message })
    }
})

// ── GET /api/auth/followers/:userId ──────────────────────────────────────────
router.get('/followers/:userId', async (req, res) => {
    try {
        const follows = await Follow.find({ followingId: req.params.userId })
            .populate('followerId', 'username avatar bio isPrivate followerCount badge level')
        res.json({ success: true, users: follows.map(f => f.followerId) })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch followers', error: error.message })
    }
})

// ── GET /api/auth/following/:userId ──────────────────────────────────────────
router.get('/following/:userId', async (req, res) => {
    try {
        const follows = await Follow.find({ followerId: req.params.userId })
            .populate('followingId', 'username avatar bio isPrivate followerCount badge level')
        res.json({ success: true, users: follows.map(f => f.followingId) })
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
            if (trimmed.length < 3 || trimmed.length > 12)
                return res.status(400).json({ success: false, message: 'Username must be 3–12 characters' })
            const existing = await User.findOne({ username: trimmed, _id: { $ne: req.user._id } })
            if (existing)
                return res.status(400).json({ success: false, message: 'Username already taken' })
            updates.username = trimmed
        }
        if (bio !== undefined) {
            if (bio.length > 150)
                return res.status(400).json({ success: false, message: 'Bio max 150 characters' })
            updates.bio = bio.trim()
        }
        if (avatar !== undefined) {
            // High-performance image processing using Sharp
            updates.avatar = await optimizeAvatar(avatar)
        }

        const updatedUser = await User.findByIdAndUpdate(req.user._id, { $set: updates }, { returnDocument: 'after' })
        res.json({
            success: true,
            user: userPayload(updatedUser)
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── GET /api/auth/suggestions ─────────────────────────────────────────────────
router.get('/suggestions', protect, async (req, res) => {
    try {
        const following = await Follow.find({ followerId: req.user._id }).select('followingId')
        const myFollowingIds = following.map(f => f.followingId)
        const excludeIds = [req.user._id, ...myFollowingIds]

        // Find users strictly followed by my following (mutual context)
        const mutualFollows = await Follow.find({
            followerId: { $in: myFollowingIds },
            followingId: { $nin: excludeIds }
        })

        const mutualCounts = {}
        mutualFollows.forEach(f => {
            const id = f.followingId.toString()
            mutualCounts[id] = (mutualCounts[id] || 0) + 1
        })

        let suggestedIds = Object.keys(mutualCounts).sort((a, b) => mutualCounts[b] - mutualCounts[a])

        // Fallback to non-followed users if needed
        if (suggestedIds.length < 20) {
            const randomUsers = await User.find({ _id: { $nin: [...excludeIds, ...suggestedIds] } })
                .limit(20 - suggestedIds.length)
                .select('_id')
            randomUsers.forEach(u => suggestedIds.push(u._id.toString()))
        }

        suggestedIds = suggestedIds.slice(0, 20)

        const users = await User.find({ _id: { $in: suggestedIds } })
            .select('username avatar bio level badge isPrivate followerCount followingCount')

        const enriched = await Promise.all(users.map(async u => {
            const uObj = u.toObject()
            const idStr = u._id.toString()
            uObj.mutualCount = mutualCounts[idStr] || 0

            const [follow, sentReq, followsMe] = await Promise.all([
                Follow.findOne({ followerId: req.user._id, followingId: u._id }),
                FollowRequest.findOne({ sender: req.user._id, recipient: u._id, status: 'pending' }),
                Follow.findOne({ followerId: u._id, followingId: req.user._id })
            ])

            uObj.isFollowedByMe = !!follow
            uObj.isRequestedByMe = !!sentReq
            uObj.followsMe = !!followsMe
            
            return uObj
        }))

        // Sort by mutual first, then global follower count
        enriched.sort((a, b) => {
            if (b.mutualCount !== a.mutualCount) return b.mutualCount - a.mutualCount
            return (b.followerCount || 0) - (a.followerCount || 0)
        })

        res.json({ success: true, users: enriched })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch suggestions', error: error.message })
    }
})

export default router
