// auth.js — authentication middleware
// This function protects routes that require login
// Add it to any route that should only work for logged in users

import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const protect = async (req, res, next) => {
    // next() → moves to the next function (the actual route handler)

    try {
        let token

        // Check if token exists in request headers
        // Frontend sends: Authorization: Bearer eyJhbG...
        if (
            req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer ')
        ) {
            // Extract just the token part (remove "Bearer ")
            token = req.headers.authorization.split(' ')[1]
        }

        // No token found — not logged in
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Not authorized — please login'
            })
        }

        // Verify the token using our secret key
        // If token was tampered with — this throws an error
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        // decoded = { userId: 'abc123', iat: ..., exp: ... }

        // Find the user from the token's userId
        // select('-password') → don't include password in result
        const user = await User.findById(decoded.userId).select('-password')

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User no longer exists'
            })
        }

        // Attach user to request object
        // Now every protected route can access req.user
        req.user = user

        // Move to the actual route handler
        next()

    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Token is invalid or expired'
        })
    }
}

export default protect