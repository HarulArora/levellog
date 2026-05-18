import mongoose from 'mongoose';

const engagementEventSchema = new mongoose.Schema({
    contentId: { type: String, required: true },
    contentType: { type: String, required: true, enum: ['game', 'movie', 'tv', 'anime', 'manga'] },
    date: { type: Date, required: true }, // Set to the start of the day
    dailyScore: { type: Number, default: 0 }
});

// Index for finding today's bucket quickly
engagementEventSchema.index({ contentId: 1, contentType: 1, date: 1 }, { unique: true });
// Index for fast trending calculation filtering by type and date
engagementEventSchema.index({ contentType: 1, date: -1 });
// Expiry after 30 days to automatically drop old data
engagementEventSchema.index({ date: 1 }, { expireAfterSeconds: 2592000 }); // 30 days

const EngagementEvent = mongoose.model('EngagementEvent', engagementEventSchema);
export default EngagementEvent;
