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
        gamesCount: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
)


// ── HASH PASSWORD BEFORE SAVING ──
// No "next" parameter needed in modern Mongoose
// async/await handles the flow automatically
userSchema.pre('save', async function () {
    if (!this.isModified('password')) return
    this.password = await bcrypt.hash(this.password, 12)
})


// ── COMPARE PASSWORD ON LOGIN ──
userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password)
}


const User = mongoose.model('User', userSchema)

export default User