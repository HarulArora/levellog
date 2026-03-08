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
            required: true,
            minlength: 6,
        },
        bio: {
            type: String,
            default: '',
            maxlength: 200,
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

        // ── XP & LEVELING ──
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

        // ── SUBSCRIPTION ──
        isPro: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true,
    }
)

userSchema.pre('save', async function () {
    if (!this.isModified('password')) return
    this.password = await bcrypt.hash(this.password, 12)
})

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}

const User = mongoose.model('User', userSchema)

export default User