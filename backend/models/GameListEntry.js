import mongoose from 'mongoose'

const gameListEntrySchema = new mongoose.Schema({
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'GameList', required: true },
    igdbId: { type: Number, required: true },
    gameTitle: { type: String, required: true },
    gameCover: { type: String, default: '' },
    genre: { type: String, default: '' },
}, { timestamps: true })

gameListEntrySchema.index({ listId: 1, igdbId: 1 }, { unique: true })
gameListEntrySchema.index({ listId: 1 })

export default mongoose.model('GameListEntry', gameListEntrySchema)