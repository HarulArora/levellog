import jwt from 'jsonwebtoken'
import User from '../models/User.js'

const protect = async (req, res, next) => {
    try {
        let token = req.cookies?.questdeck_token || req.headers.authorization?.split(' ')[1]

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            })
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(decoded.userId).select('-password')

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

export { protect }
export default protect