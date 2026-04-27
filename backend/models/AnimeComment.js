import mongoose from 'mongoose';

const animeCommentSchema = new mongoose.Schema({
    externalId: { type: Number, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true, maxlength: 1000 },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnimeComment', default: null },
    edited: { type: Boolean, default: false },
    likeCount: { type: Number, default: 0 },
    dislikeCount: { type: Number, default: 0 },
    type: { type: String, enum: ['anime', 'manga'], required: true }
}, { timestamps: true });

animeCommentSchema.index({ externalId: 1, type: 1 });
animeCommentSchema.index({ userId: 1 });
animeCommentSchema.index({ parentId: 1 });

export default mongoose.model('AnimeComment', animeCommentSchema);
