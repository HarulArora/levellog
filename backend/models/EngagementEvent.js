import mongoose from 'mongoose';

const engagementEventSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
    contentId: { type: String, required: true },
    contentType: { type: String, required: true, enum: ['game', 'movie', 'tv', 'anime', 'manga'] },
    eventType: { 
        type: String, 
        required: true, 
        enum: ['like', 'comment', 'wishlist', 'rating', 'view'] 
    },
    weight: { type: Number, default: 1 },
    timestamp: { type: Date, default: Date.now }
});

// Index for trending calculation (last 30 days)
engagementEventSchema.index({ contentType: 1, timestamp: -1 });
// Expiry after 30 days to keep the collection small and fast
engagementEventSchema.index({ timestamp: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

const EngagementEvent = mongoose.model('EngagementEvent', engagementEventSchema);
export default EngagementEvent;
