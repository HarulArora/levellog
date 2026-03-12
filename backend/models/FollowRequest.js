import mongoose from 'mongoose'
const followRequestSchema = new mongoose.Schema(
    {
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        status: {
            type: String,
            enum: ['pending', 'accepted', 'declined'],
            default: 'pending'
        }
    },
    {
        timestamps: true
    }
)

followRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true })  // prevent duplicate requests
followRequestSchema.index({ recipient: 1, status: 1 })                    // fetch pending requests for a user

const FollowRequest = mongoose.model('FollowRequest', followRequestSchema)
export default FollowRequest