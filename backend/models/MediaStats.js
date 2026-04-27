import mongoose from 'mongoose';

const mediaStatsSchema = new mongoose.Schema({
    externalId: { type: Number, required: true },
    type: { type: String, required: true, enum: ['movie', 'tv', 'anime', 'manga'] },
    avgRating: { type: Number, default: null },
    ratingCount: { type: Number, default: 0, min: 0 },
    totalRatingSum: { type: Number, default: 0 },
    loggedCount: { type: Number, default: 0, min: 0 },
    likeCount: { type: Number, default: 0, min: 0 },
    wishlistCount: { type: Number, default: 0, min: 0 },
    updatedAt: { type: Date, default: Date.now }
});

// Compound index for O(1)-like lookups
mediaStatsSchema.index({ externalId: 1, type: 1 }, { unique: true });

const MediaStats = mongoose.model('MediaStats', mediaStatsSchema);
export default MediaStats;
