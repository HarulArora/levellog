// auth.js — signup and login endpoints

import express from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import protect from '../middleware/auth.js'

const router = express.Router()


// ── Helper: Create JWT Token ──
// We use this in both signup and login
const createToken = (userId) => {
    return jwt.sign(
        { userId },                   // payload — data stored in token
        process.env.JWT_SECRET,       // secret key to sign with
        { expiresIn: '30d' }          // token expires in 30 days
    )
}


// ── POST /api/auth/signup ──
// Create a new account
router.post('/signup', async (req, res) => {
    try {
        const { username, email, password } = req.body

        // Validate all fields exist
        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide username, email and password'
            })
        }

        // Check if email already exists
        const emailExists = await User.findOne({ email })
        if (emailExists) {
            return res.status(400).json({
                success: false,
                message: 'Email already registered'
            })
        }

        // Check if username already exists
        const usernameExists = await User.findOne({ username })
        if (usernameExists) {
            return res.status(400).json({
                success: false,
                message: 'Username already taken'
            })
        }

        // Create new user
        // Password gets hashed automatically by our pre-save middleware
        const user = await User.create({ username, email, password })

        // Create JWT token for this user
        const token = createToken(user._id)

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            }
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Signup failed',
            error: error.message
        })
    }
})


// ── POST /api/auth/login ──
// Login with existing account
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body

        // Validate fields exist
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide email and password'
            })
        }

        // Find user by email
        const user = await User.findOne({ email })
        if (!user) {
            return res.status(401).json({
                success: false,
                // Don't say "email not found" — security risk
                // Always say generic message
                message: 'Invalid email or password'
            })
        }

        // Check if password is correct using our custom method
        const isPasswordCorrect = await user.comparePassword(password)
        if (!isPasswordCorrect) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            })
        }

        // Create token
        const token = createToken(user._id)

        res.json({
            success: true,
            message: 'Logged in successfully',
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
            }
        })

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Login failed',
            error: error.message
        })
    }
})


// ── GET /api/auth/me ──
// Get currently logged in user's data
// Protected route — requires valid token
router.get('/me', protect, async (req, res) => {
    // protect middleware already attached req.user
    res.json({
        success: true,
        user: req.user
    })
})


export default router