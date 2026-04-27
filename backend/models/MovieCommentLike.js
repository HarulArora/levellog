import mongoose from 'mongoose'

const movieCommentLikeSchema = new mongoose.Schema({
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'MovieComment', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'dislike'], required: true },
}, { timestamps: true })

movieCommentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true })
movieCommentLikeSchema.index({ commentId: 1, type: 1 })

export default mongoose.model('MovieCommentLike', movieCommentLikeSchema)
