import mongoose from 'mongoose';

const movieListSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        description: { type: String, default: '', maxlength: 500 },
        isPublic: { type: Boolean, default: true },
        type: { type: String, enum: ['movie', 'tv'], default: 'movie' },
        entryCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

movieListSchema.index({ userId: 1 });
movieListSchema.index({ userId: 1, type: 1 });
movieListSchema.index({ userId: 1, isPublic: 1 });

const MovieList = mongoose.model('MovieList', movieListSchema);
export default MovieList;
