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

        // ── PRIVACY ──
        // public  → anyone can see profile and games
        // private → only followers can see games
        isPrivate: {
            type: Boolean,
            default: false
        },

        // ── FOLLOWERS / FOLLOWING ──
        // Array of userIds who follow this user
        followers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],

        // Array of userIds this user follows
        following: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],

        gamesCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
)

// ── HASH PASSWORD ──
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return
    this.password = await bcrypt.hash(this.password, 12)
})

// ── COMPARE PASSWORD ──
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}

const User = mongoose.model('User', userSchema)

export default User