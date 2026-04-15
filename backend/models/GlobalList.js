import mongoose from 'mongoose'

const globalListSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        unique: true,
        enum: ['trending', 'top-rated', 'coming-soon']
    },
    games: [{
        id: Number,
        title: String,
        cover: String,
        genre: String,
        rating: String,
        ratingCount: Number,
        releaseDate: String,
        hypes: Number
    }],
    lastUpdated: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true })

const GlobalList = mongoose.model('GlobalList', globalListSchema)

export default GlobalList
