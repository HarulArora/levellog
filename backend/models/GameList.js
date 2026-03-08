import mongoose from 'mongoose'

const gameListSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100
        },
        description: {
            type: String,
            default: '',
            maxlength: 500
        },
        isPublic: {
            type: Boolean,
            default: true
        },
        games: [
            {
                igdbId: { type: Number, required: true },
                gameTitle: { type: String, required: true },
                gameCover: { type: String, default: '' },
                genre: { type: String, default: '' },
                addedAt: { type: Date, default: Date.now }
            }
        ]
    },
    { timestamps: true }
)

const GameList = mongoose.model('GameList', gameListSchema)

export default GameList