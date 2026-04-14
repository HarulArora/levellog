import mongoose from 'mongoose'

const globalStatsSchema = new mongoose.Schema(
    {
        igdbId: {
            type: Number,
            required: true,
            unique: true,
            index: true
        },
        loggedCount: {
            type: Number,
            default: 0,
            min: 0
        },
        wishlistCount: {
            type: Number,
            default: 0,
            min: 0
        },
        likeCount: {
            type: Number,
            default: 0,
            min: 0
        },
        ratingCount: {
            type: Number,
            default: 0,
            min: 0
        },
        totalRatingSum: {
            type: Number,
            default: 0
        },
        avgRating: {
            type: Number,
            default: 0,
            min: 0
        }
    },
    { timestamps: true }
)

const GlobalStats = mongoose.model('GlobalStats', globalStatsSchema)
export default GlobalStats
