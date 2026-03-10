import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            minlength: 3,
            maxlength: 20,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            lowercase: true,
        },
        password: {
            type: String,
            minlength: 6,
            // Not required — Google OAuth users have no password
        },
        bio: {
            type: String,
            default: '',
            maxlength: 200,
        },
        avatar: {
            type: String,
            default: '',
        },
        isPrivate: {
            type: Boolean,
            default: false
        },
        followers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        following: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        gamesCount: {
            type: Number,
            default: 0,
        },
        xp: {
            type: Number,
            default: 0
        },
        level: {
            type: Number,
            default: 1
        },
        badge: {
            type: String,
            default: '🎮'
        },
        isPro: {
            type: Boolean,
            default: false
        },

        // ── Google OAuth ──────────────────────────────────────────
        googleId: {
            type: String,
            default: null,
            sparse: true,   // allows multiple null values with unique index
        },

        // ── Email Verification ────────────────────────────────────
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        emailVerifyToken: {
            type: String,
            default: null,
        },
        emailVerifyExpires: {
            type: Date,
            default: null,
        },

        // ── Password Reset ────────────────────────────────────────
        resetPasswordToken: {
            type: String,
            default: null,
        },
        resetPasswordExpires: {
            type: Date,
            default: null,
        },
    },
    { timestamps: true }
)

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return
    if (!this.password) return   // Google users have no password
    this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false
    return await bcrypt.compare(candidatePassword, this.password)
}

const User = mongoose.model('User', userSchema)
export default User
