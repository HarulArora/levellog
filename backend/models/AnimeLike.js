import mongoose from 'mongoose';

const animeLikeSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    externalId: { type: Number, required: true },
    type: { type: String, enum: ['anime', 'manga'], required: true },
    title: { type: String, required: true },
    cover: { type: String, default: '' },
    genre: { type: String, default: '' }
}, { timestamps: true });

animeLikeSchema.index({ userId: 1, externalId: 1, type: 1 }, { unique: true });

export default mongoose.model('AnimeLike', animeLikeSchema);
