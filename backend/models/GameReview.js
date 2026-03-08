import mongoose from 'mongoose'

const gameReviewSchema = new mongoose.Schema(
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
        review: {
            type: String,
            required: true,
            maxlength: 2000
        },
        rating: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        }
    },
    { timestamps: true }
)

// One review per user per game
gameReviewSchema.index({ userId: 1, igdbId: 1 }, { unique: true })

const GameReview = mongoose.model('GameReview', gameReviewSchema)

export default GameReview