import mongoose from 'mongoose'
const commentSchema = new mongoose.Schema({
    igdbId: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    edited: { type: Boolean, default: false },
}, { timestamps: true })

commentSchema.index({ igdbId: 1 })           // fetch all comments for a game
commentSchema.index({ userId: 1 })           // fetch all comments by a user
commentSchema.index({ parentId: 1 })         // fetch replies to a comment

export default mongoose.model('Comment', commentSchema)