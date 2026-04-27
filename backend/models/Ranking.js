import mongoose from 'mongoose';

const rankingSchema = new mongoose.Schema({
    contentId: { type: String, required: true }, // IGDB ID or TMDB ID or Jikan ID
    contentType: { type: String, required: true, enum: ['game', 'movie', 'tv', 'anime', 'manga'] },
    rankType: { type: String, required: true, enum: ['top_rated', 'trending', 'coming_soon'] },
    score: { type: Number, required: true },
    rankPosition: { type: Number, required: true },
    computedAt: { type: Date, default: Date.now },
    // Metadata for fast frontend rendering without extra joins if possible
    title: String,
    cover: String,
    year: Number,
    genres: [String],
    avgRating: Number
});

// Primary index for super-fast retrieval
rankingSchema.index({ rankType: 1, contentType: 1, rankPosition: 1 });
// Expiry index to keep things clean (optional, but good for stale data)
rankingSchema.index({ computedAt: 1 });

const Ranking = mongoose.model('Ranking', rankingSchema);
export default Ranking;
