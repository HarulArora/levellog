import mongoose from 'mongoose';

const movieCommentSchema = new mongoose.Schema({
    externalId: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'MovieComment', default: null },
    edited: { type: Boolean, default: false },
    likeCount: { type: Number, default: 0 },
    dislikeCount: { type: Number, default: 0 },
    type: { type: String, enum: ['movie', 'tv'], required: true }
}, { timestamps: true });

movieCommentSchema.index({ externalId: 1, type: 1 });
movieCommentSchema.index({ userId: 1 });
movieCommentSchema.index({ parentId: 1 });

export default mongoose.model('MovieComment', movieCommentSchema);
