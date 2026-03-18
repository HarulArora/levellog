import mongoose from 'mongoose'

const commentLikeSchema = new mongoose.Schema({
    commentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['like', 'dislike'], required: true },
}, { timestamps: true })

commentLikeSchema.index({ commentId: 1, userId: 1 }, { unique: true })
commentLikeSchema.index({ commentId: 1, type: 1 })

export default mongoose.model('CommentLike', commentLikeSchema)