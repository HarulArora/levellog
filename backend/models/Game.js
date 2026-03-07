import mongoose from 'mongoose'

const gameSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: false,
            index: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        genre: {
            type: String,
            default: 'Unknown',
            trim: true
        },
        status: {
            type: String,
            enum: ['playing', 'completed', 'planned', 'paused', 'dropped'],
            default: 'planned'
        },
        rating: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        hours: {
            type: Number,
            default: 0,
            min: 0
        },
        platforms: {
            type: [String],
            default: []
        },
        steamId: {
            type: String,
            default: ''
        },
        notes: {
            type: String,
            default: ''
        },
        cover: {
            type: String,
            default: ''
        },
        summary: {
            type: String,
            default: ''
        },
        igdbId: {
            type: Number,
            default: null
        }
    },
    {
        timestamps: true
    }
)

const Game = mongoose.model('Game', gameSchema)

export default Game