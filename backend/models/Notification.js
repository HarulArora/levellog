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
            enum: ['follow', 'follow_request', 'request_accepted', 'comment_reply'],
            required: true
        },
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

notificationSchema.index({ recipient: 1, read: 1 })   // unread count badge
notificationSchema.index({ recipient: 1, createdAt: -1 }) // fetch latest notifications

const Notification = mongoose.model('Notification', notificationSchema)
export default Notification