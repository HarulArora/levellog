import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const protect = async (req, res, next) => {
    try {
        let token = req.cookies?.questduck_token || req.headers.authorization?.split(' ')[1]

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        // 🚀 Optimization: Only fetch essential fields for validation
        const user = await User.findById(decoded.userId).select('username isEmailVerified email badge level xp')

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            })
        }

        if (!user.isEmailVerified) {
            return res.status(403).json({
                success: false,
                message: 'Your account is not verified yet. Please verify your email.',
                requiresVerification: true,
                email: user.email
            })
        }

        req.user = user
        next()

    } catch (error) {
        res.status(401).json({
            success: false,
            message: 'Invalid token',
            error: error.message
        })
    }
}

const protectOptional = async (req, res, next) => {
    try {
        let token = req.cookies?.questduck_token || req.headers.authorization?.split(' ')[1]
        if (!token) {
            return next()
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(decoded.userId).select('username isEmailVerified email badge level xp')
        
        if (user && user.isEmailVerified) {
            req.user = user
        }
        next()
    } catch (error) {
        // Just proceed without user if token is invalid
        next()
    }
}

export { protect, protectOptional }
export default protect