import mongoose from 'mongoose'

const wishlistSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        igdbId: {
            type: Number,
            required: true
        },
        gameTitle: {
            type: String,
            required: true
        },
        gameCover: {
            type: String,
            default: ''
        },
        genre: {
            type: String,
            default: ''
        },
        releaseYear: {
            type: String,
            default: ''
        }
    },
    { timestamps: true }
)

// One wishlist entry per user per game
wishlistSchema.index({ userId: 1, igdbId: 1 }, { unique: true })

const Wishlist = mongoose.model('Wishlist', wishlistSchema)

export default Wishlist