import mongoose from 'mongoose'

const commentSchema = new mongoose.Schema({
    igdbId: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    edited: { type: Boolean, default: false },

    // ── Cached counters (replaces arrays) ──────────────────────────
    likeCount: { type: Number, default: 0 },
    dislikeCount: { type: Number, default: 0 },
}, { timestamps: true })

commentSchema.index({ igdbId: 1 })
commentSchema.index({ userId: 1 })
commentSchema.index({ parentId: 1 })

export default mongoose.model('Comment', commentSchema)