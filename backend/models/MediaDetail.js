import mongoose from 'mongoose';

const mediaDetailSchema = new mongoose.Schema(
    {
        externalId: {
            type: String,
            required: true,
            trim: true
        },
        type: {
            type: String,
            required: true,
            enum: ['anime', 'manga', 'movie', 'tv', 'game']
        },
        data: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        lastFetchedAt: {
            type: Date,
            default: Date.now
        },
        lastAccessedAt: {
            type: Date,
            default: Date.now
        }
    },
    {
        timestamps: true
    }
);

// Unique compound index for fast O(1) indexed lookups
mediaDetailSchema.index({ externalId: 1, type: 1 }, { unique: true });

// Auto-delete entries that have not been accessed/updated in the last 45 days (45 * 24 * 60 * 60 seconds)
mediaDetailSchema.index({ lastAccessedAt: 1 }, { expireAfterSeconds: 45 * 24 * 60 * 60 });

const MediaDetail = mongoose.model('MediaDetail', mediaDetailSchema);
export default MediaDetail;
