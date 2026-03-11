import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        type: {
            type: String,
            // ✅ added comment_reply
            enum: ['follow', 'follow_request', 'request_accepted', 'comment_reply'],
            required: true
        },
        // ✅ stores igdbId + text preview for reply notifications
        meta: {
            type: mongoose.Schema.Types.Mixed,
            default: {}
        },
        read: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
)

const Notification = mongoose.model('Notification', notificationSchema)
export default Notification