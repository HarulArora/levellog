import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
    {
        recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        type: {
            type: String,
            enum: ['follow', 'follow_request', 'request_accepted', 'comment_reply'],
            required: true
        },
        meta: {
            igdbId: { type: Number, default: null },
            gameTitle: { type: String, default: '' },
            commentId: { type: mongoose.Schema.Types.ObjectId, default: null },
            parentId: { type: mongoose.Schema.Types.ObjectId, default: null },
            preview: { type: String, default: '' },
        },
        read: { type: Boolean, default: false },
    },
    { timestamps: true }
)

// TTL — auto-delete notifications after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 })
notificationSchema.index({ recipient: 1, read: 1 })
notificationSchema.index({ recipient: 1, createdAt: -1 })

export default mongoose.model('Notification', notificationSchema)