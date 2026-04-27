import mongoose from 'mongoose'

const animeCommentLikeSchema = new mongoose.Schema({
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnimeComment', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'dislike'], required: true },
}, { timestamps: true })

animeCommentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true })
animeCommentLikeSchema.index({ commentId: 1, type: 1 })

export default mongoose.model('AnimeCommentLike', animeCommentLikeSchema)
