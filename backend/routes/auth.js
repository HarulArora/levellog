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
const BLOOCKED_WORDS = ['admin', 'moderator', 'support', 'questduck', 'levellog', 'staff', 'offensive', 'slur', 'nazi', 'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy']

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
        .cookie('questduck_token', token, cookieOptions)
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

        const usernameRegex = username.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        const existing = await User.findOne({ 
            username: { $regex: new RegExp(`^${usernameRegex}$`, 'i') } 
        })
        
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

        // Optimize: Check for both email and username in one parallel query or single $or if preferred.
        // But separate checks with indexes are actually very fast. 
        // Let's optimize by checking both concurrently.
        const usernameRegex = username.trim().replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
        const [emailExists, usernameExists] = await Promise.all([
            User.findOne({ email: email.toLowerCase().trim() }),
            User.findOne({ 
                username: { $regex: new RegExp(`^${usernameRegex}$`, 'i') } 
            })
        ])

        if (emailExists) {
            if (!emailExists.isEmailVerified) {
                await User.findByIdAndDelete(emailExists._id)
            } else {
                return res.status(400).json({ success: false, message: 'An account with this email already exists.', field: 'email' })
            }
        }

        if (usernameExists) {
            if (!usernameExists.isEmailVerified) {
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

        // Send verification email entirely outside the response thread
        setTimeout(() => {
            sendVerificationEmail(user.email, user.username, verificationCode)
                .then(emailResult => {
                    if (!emailResult.success) {
                        logger.warn(`Verification email failed for ${user.email}, but account was created.`)
                    }
                })
                .catch(emailErr => {
                    logger.error('SMTP Timeout or error during signup:', emailErr)
                })
        }, 0)

        return res.status(201).json({
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
            return res.status(400).json({ success: false, message: 'Please provide email/username and password' })

        // Accept email or username (case-insensitive)
        const identifier = email.trim()
        let user;

        if (identifier.includes('@')) {
            // 🚀 FAST: Email lookup (Fully indexed, no regex)
            user = await User.findOne({ email: identifier.toLowerCase() })
        } else {
            // 🚀 OPTIMIZED: Username lookup (Case-insensitive via anchored regex or collation)
            const identifierRegex = identifier.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
            user = await User.findOne({ 
                username: { $regex: new RegExp(`^${identifierRegex}$`, 'i') } 
            })
        }

        if (!user)
            return res.status(401).json({ success: false, message: 'Invalid email/username or password' })

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
    res.cookie('questduck_token', '', {
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

        // Send verification email entirely outside the response thread
        setTimeout(() => {
            sendVerificationEmail(user.email, user.username, verificationCode)
                .then(emailResult => {
                    if (!emailResult.success) {
                        logger.warn(`Verification email resend failed for ${user.email}`)
                    }
                })
                .catch(emailErr => {
                    logger.error('SMTP Timeout during resend-verification:', emailErr)
                })
        }, 0)

        return res.status(200).json({ 
            success: true, 
            message: 'Verification code generated and sent to your email.' 
        })
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
        
        // Loophole fix: Always say code sent (if account exists)
        if (!user) {
            return res.json({ success: true, message: 'If an account exists, a reset code has been sent.' })
        }

        if (!user.isEmailVerified) {
            return res.status(400).json({ 
                success: false, 
                message: 'Your account is not verified yet. Please verify your email first.',
                requiresVerification: true,
                email: user.email
            })
        }

        const resetCode = generateVerificationCode()
        user.resetPasswordToken = resetCode
        user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000)
        await user.save()

        // Send reset email entirely outside the response thread
        setTimeout(() => {
            sendResetPasswordEmail(user.email, user.username, resetCode)
                .then(emailResult => {
                    if (!emailResult.success) {
                        logger.warn(`Password reset email failed for ${user.email}`)
                    }
                })
                .catch(emailErr => {
                    logger.error('SMTP Timeout during forgot-password:', emailErr)
                })
        }, 0)

        res.status(200).json({ success: true, message: 'Password reset code sent to your email.' })
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

        // Send reset success email in background
        setTimeout(() => {
            sendPasswordResetSuccessEmail(user.email, user.username)
                .catch(err => logger.error('Failed to send reset success email:', err))
        }, 0)

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

        // 1. Get user info from Google
        let googleData;
        try {
            const response = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: 8000
            })
            googleData = response.data
        } catch (axiosErr) {
            logger.error('Google userInfo fetch failed:', axiosErr.response?.data || axiosErr.message)
            return res.status(401).json({ 
                success: false, 
                message: 'Failed to verify Google account. Please try again.',
                error: axiosErr.message 
            })
        }
        
        const { sub: googleId, email, name, picture } = googleData
        if (!email)
            return res.status(401).json({ success: false, message: 'Your Google account must have an email address' })

        // 2. Find user by googleId or email
        let user = await User.findOne({ $or: [{ googleId }, { email: email.toLowerCase() }] })

        if (user) {
            let userChanged = false
            
            // Link googleId if missing
            if (!user.googleId) {
                user.googleId = googleId
                userChanged = true
            }
            
            // Sync avatar if missing
            if (!user.avatar && picture) {
                user.avatar = picture
                userChanged = true
            }

            // ENFORCE 12-CHAR LIMIT for existing users (fixes validation errors for legacy accounts)
            if (user.username.length > 12) {
                const base = user.username.slice(0, 9) // keep some prefix
                user.username = base + Math.floor(100 + Math.random() * 899) // make it unique but short
                userChanged = true
            }

            // AUTO-VERIFY: Google login confirms the email identity
            if (!user.isEmailVerified) {
                user.isEmailVerified = true
                user.emailVerifyToken = null
                user.emailVerifyExpires = null
                userChanged = true
                logger.info(`User ${user.email} auto-verified via Google Login`)
            }

            if (userChanged) await user.save()
        } else {
            // 3. Create new user
            let baseUsername = (name || 'user').replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '').slice(0, 12)
            if (!baseUsername || baseUsername.length < 3) baseUsername = 'user_' + Math.floor(100+Math.random()*900)
            
            let username = baseUsername
            let counter = 1
            
            // Robust unique username search
            while (await User.findOne({ username: { $regex: new RegExp(`^${username}$`, 'i') } })) {
                let suffix = counter.toString()
                let availableSpace = 12 - suffix.length
                username = baseUsername.slice(0, availableSpace) + suffix
                counter++
            }

            user = await User.create({ 
                username, 
                email: email.toLowerCase(), 
                password: null, 
                googleId, 
                avatar: picture || '',
                isEmailVerified: true 
            })
            logger.info(`New user created via Google: ${user.email} (@${user.username})`)
        }

        sendTokenResponse(user, 200, res)
    } catch (error) {
        console.error('DEBUG GOOGLE ERROR:', error)
        logger.error('CRITICAL Google login error:', error.stack || error)
        res.status(500).json({ 
            success: false, 
            message: 'Google sign-in failed due to a server error. Please try again later.',
            error: error.message 
        })
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
        
        // AUTO-VERIFY: Linking a Google account confirms identity
        user.isEmailVerified = true
        user.emailVerifyToken = null
        user.emailVerifyExpires = null
        
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
        // Use findByIdAndUpdate to bypass the pre('save') hook which triggers bcrypt logic
        const user = await User.findByIdAndUpdate(
            req.user._id, 
            { $set: { googleId: null } },
            { returnDocument: 'after' }
        )

        if (!user) return res.status(404).json({ success: false, message: 'User not found' })

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
        const user = await User.findOne({ 
            username: { $regex: new RegExp(`^${req.params.username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        })
            .select('-password -email -emailVerifyToken -resetPasswordToken')
            .lean()
        if (!user) return res.status(404).json({ success: false, message: 'User not found' })

        const [followerCount, followingCount] = await Promise.all([
            Follow.countDocuments({ followingId: user._id }),
            Follow.countDocuments({ followerId: user._id }),
        ])

        // check if the logged-in user follows this profile or has a pending request
        let isFollowedByMe = false
        let isRequestedByMe = false
        let followsMe = false
        const token = req.cookies?.questduck_token || req.headers.authorization?.split(' ')[1]
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

        const userObj = { ...user }
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
        const following = await Follow.find({ followerId: req.user._id })
            .select('followingId')
            .lean()
        const followingIds = following.map(f => f.followingId)

        if (followingIds.length === 0)
            return res.json({ success: true, games: [], message: 'Follow some users to see their games here' })

        const Game = (await import('../models/Game.js')).default
        const games = await Game.find({ userId: { $in: followingIds } })
            .sort({ createdAt: -1 })
            .limit(20)
            .populate('userId', 'username avatar badge level')
            .select('title cover status rating igdbId createdAt userId')
            .lean()

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
        const users = await User.find({ 
            username: { $regex: escapedQuery, $options: 'i' },
            isEmailVerified: true 
        })
            .select('-password -email').limit(10).lean()

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
            const uObj = u
            if (loggedInId) {
                const [follow, sentReq, followedBy] = await Promise.all([
                    Follow.findOne({ followerId: loggedInId, followingId: u._id }).lean(),
                    FollowRequest.findOne({ sender: loggedInId, recipient: u._id, status: 'pending' }).lean(),
                    Follow.findOne({ followerId: u._id, followingId: loggedInId }).lean()
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

        // ── Priority Sorting ──
        const queryLower = query.trim().toLowerCase()
        enriched.sort((a, b) => {
            const aName = a.username.toLowerCase()
            const bName = b.username.toLowerCase()

            // 1. Exact match
            if (aName === queryLower && bName !== queryLower) return -1
            if (bName === queryLower && aName !== queryLower) return 1

            // 2. Starts with
            const aStarts = aName.startsWith(queryLower)
            const bStarts = bName.startsWith(queryLower)
            if (aStarts && !bStarts) return -1
            if (bStarts && !aStarts) return 1

            // 3. Alphabetical fallback
            return aName.localeCompare(bName)
        })

        res.json({ success: true, users: enriched, query })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Search failed', error: error.message })
    }
})

// ── GET /api/auth/followers/:userId ──────────────────────────────────────────
router.get('/followers/:userId', async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId).select('isPrivate').lean()
        if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' })

        // 🛡️ Privacy Wall
        if (targetUser.isPrivate) {
            let isAuthorized = false
            const authHeader = req.headers.authorization
            
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1]
                    const decoded = jwt.verify(token, process.env.JWT_SECRET)
                    const requesterId = decoded.id

                    if (requesterId === req.params.userId) {
                        isAuthorized = true // Owner
                    } else {
                        const isFollowing = await Follow.findOne({ followerId: requesterId, followingId: req.params.userId }).lean()
                        if (isFollowing) isAuthorized = true // Approved Follower
                    }
                } catch (err) {
                    // Invalid token, treat as guest
                }
            }

            if (!isAuthorized) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'This profile is private. Follow them to see their followers.',
                    isRestricted: true 
                })
            }
        }

        const follows = await Follow.find({ followingId: req.params.userId })
            .populate('followerId', 'username avatar bio isPrivate followerCount badge level')
            .lean()
        res.json({ success: true, users: follows.map(f => f.followerId) })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch followers', error: error.message })
    }
})

// ── GET /api/auth/following/:userId ──────────────────────────────────────────
router.get('/following/:userId', async (req, res) => {
    try {
        const targetUser = await User.findById(req.params.userId).select('isPrivate').lean()
        if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' })

        // 🛡️ Privacy Wall
        if (targetUser.isPrivate) {
            let isAuthorized = false
            const authHeader = req.headers.authorization
            
            if (authHeader && authHeader.startsWith('Bearer ')) {
                try {
                    const token = authHeader.split(' ')[1]
                    const decoded = jwt.verify(token, process.env.JWT_SECRET)
                    const requesterId = decoded.id

                    if (requesterId === req.params.userId) {
                        isAuthorized = true // Owner
                    } else {
                        const isFollowing = await Follow.findOne({ followerId: requesterId, followingId: req.params.userId }).lean()
                        if (isFollowing) isAuthorized = true // Approved Follower
                    }
                } catch (err) {
                    // Invalid token, treat as guest
                }
            }

            if (!isAuthorized) {
                return res.status(403).json({ 
                    success: false, 
                    message: 'This profile is private. Follow them to see who they follow.',
                    isRestricted: true 
                })
            }
        }

        const follows = await Follow.find({ followerId: req.params.userId })
            .populate('followingId', 'username avatar bio isPrivate followerCount badge level')
            .lean()
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
            const existing = await User.findOne({ 
                username: { $regex: new RegExp(`^${trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }, 
                _id: { $ne: req.user._id } 
            }).lean()
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
        const following = await Follow.find({ followerId: req.user._id })
            .select('followingId')
            .lean()
        const myFollowingIds = following.map(f => f.followingId)
        const excludeIds = [req.user._id, ...myFollowingIds]

        // Find users strictly followed by my following (mutual context)
        // 🚀 OPTIMIZATION: Limit scan to 1000 relationships to keep it snappy
        const mutualFollows = await Follow.find({
            followerId: { $in: myFollowingIds },
            followingId: { $nin: excludeIds }
        })
        .limit(1000)
        .sort({ createdAt: -1 })
        .lean()

        const mutualCounts = {}
        mutualFollows.forEach(f => {
            const id = f.followingId.toString()
            mutualCounts[id] = (mutualCounts[id] || 0) + 1
        })

        let suggestedIds = Object.keys(mutualCounts).sort((a, b) => mutualCounts[b] - mutualCounts[a])

        // Fallback to non-followed users if needed
        if (suggestedIds.length < 20) {
            const randomUsers = await User.find({ 
                _id: { $nin: [...excludeIds, ...suggestedIds] },
                isEmailVerified: true 
            })
                .limit(20 - suggestedIds.length)
                .select('_id')
                .lean()
            randomUsers.forEach(u => suggestedIds.push(u._id.toString()))
        }

        suggestedIds = suggestedIds.slice(0, 20)

        // Bulk fetch all relevant users (Must be verified)
        const users = await User.find({ 
            _id: { $in: suggestedIds },
            isEmailVerified: true 
        })
            .select('username avatar bio level badge isPrivate followerCount')
            .lean()

        // Bulk fetch all relationships for the current user and these suggested IDs
        const [myFollows, myRequests, whoFollowsMe] = await Promise.all([
            Follow.find({ followerId: req.user._id, followingId: { $in: suggestedIds } }).select('followingId').lean(),
            FollowRequest.find({ sender: req.user._id, recipient: { $in: suggestedIds }, status: 'pending' }).select('recipient').lean(),
            Follow.find({ followerId: { $in: suggestedIds }, followingId: req.user._id }).select('followerId').lean()
        ])

        const myFollowSet = new Set(myFollows.map(f => f.followingId.toString()))
        const myRequestSet = new Set(myRequests.map(r => r.recipient.toString()))
        const focusedSet = new Set(whoFollowsMe.map(f => f.followerId.toString()))

        const enriched = users.map(u => {
            const uObj = u
            const idStr = u._id.toString()
            uObj.mutualCount = mutualCounts[idStr] || 0
            uObj.isFollowedByMe = myFollowSet.has(idStr)
            uObj.isRequestedByMe = myRequestSet.has(idStr)
            uObj.followsMe = focusedSet.has(idStr)
            return uObj
        })

        // Sort: Mutual Count (High to low), then followsMe (true first), then followerCount (High to low)
        enriched.sort((a, b) => {
            if (b.mutualCount !== a.mutualCount) return b.mutualCount - a.mutualCount
            if (b.followsMe !== a.followsMe) return b.followsMe ? 1 : -1
            return (b.followerCount || 0) - (a.followerCount || 0)
        })

        res.json({ success: true, users: enriched })
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch suggestions', error: error.message })
    }
})

export default router
