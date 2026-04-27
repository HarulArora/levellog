import mongoose from 'mongoose';

const animeListSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true, trim: true, maxlength: 100 },
        description: { type: String, default: '', maxlength: 500 },
        isPublic: { type: Boolean, default: true },
        type: { type: String, enum: ['anime', 'manga'], default: 'anime' },
        entryCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

animeListSchema.index({ userId: 1 });
animeListSchema.index({ userId: 1, type: 1 });
animeListSchema.index({ userId: 1, isPublic: 1 });

const AnimeList = mongoose.model('AnimeList', animeListSchema);
export default AnimeList;
