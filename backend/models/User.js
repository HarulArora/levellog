import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema(
    {
        username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 12 },
        email: { type: String, required: true, unique: true, trim: true, lowercase: true },
        password: { type: String, minlength: 6 },
        bio: { type: String, default: '', maxlength: 150 },
        avatar: { type: String, default: '' },
        isPrivate: { type: Boolean, default: false },

        // ── Cached counters (replaces arrays) ──────────────────────
        followerCount: { type: Number, default: 0 },
        followingCount: { type: Number, default: 0 },

        // ── High Performance Stats (Denormalized) ──────────────────
        gameStats: {
            total: { type: Number, default: 0 },
            completed: { type: Number, default: 0 },
            playing: { type: Number, default: 0 },
            planned: { type: Number, default: 0 },
            paused: { type: Number, default: 0 },
            dropped: { type: Number, default: 0 },
            totalHours: { type: Number, default: 0 },
            ratingCount: { type: Number, default: 0 },
            totalRatingSum: { type: Number, default: 0 },
            avgRating: { type: Number, default: 0 },
        },

        xp: { type: Number, default: 0 },
        level: { type: Number, default: 1 },
        badge: { type: String, default: '🎮' },
        isPro: { type: Boolean, default: false },

        googleId: { type: String, default: null, sparse: true },

        isEmailVerified: { type: Boolean, default: false },
        emailVerifyToken: { type: String, default: null },
        emailVerifyExpires: { type: Date, default: null },

        resetPasswordToken: { type: String, default: null },
        resetPasswordExpires: { type: Date, default: null },
    },
    { timestamps: true }
)

// Add case-insensitive index for fast username search
userSchema.index({ username: 1 }, { collation: { locale: 'en', strength: 2 } });

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return
    if (!this.password) return
    this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = async function (candidatePassword) {
    if (!this.password) return false
    return await bcrypt.compare(candidatePassword, this.password)
}

export default mongoose.model('User', userSchema)