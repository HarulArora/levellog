import mongoose from 'mongoose'

const gameListSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        description: { type: String, default: '', maxlength: 500 },
        isPublic: { type: Boolean, default: true },
        gameCount: { type: Number, default: 0 },
    },
    { timestamps: true }
)

gameListSchema.index({ userId: 1 })
gameListSchema.index({ userId: 1, isPublic: 1 })

export default mongoose.model('GameList', gameListSchema)