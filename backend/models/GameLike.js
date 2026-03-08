import mongoose from 'mongoose'

const gameLikeSchema = new mongoose.Schema(
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
        }
    },
    { timestamps: true }
)

// One like per user per game
gameLikeSchema.index({ userId: 1, igdbId: 1 }, { unique: true })

const GameLike = mongoose.model('GameLike', gameLikeSchema)

export default GameLike