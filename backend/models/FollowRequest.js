import mongoose from 'mongoose'

const followRequestSchema = new mongoose.Schema(
    {
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        status: { type: String, enum: ['pending', 'declined'], default: 'pending' },
        // removed 'accepted' — accepted requests get deleted and moved to Follow collection
    },
    { timestamps: true }
)

followRequestSchema.index({ sender: 1, recipient: 1 }, { unique: true })
followRequestSchema.index({ recipient: 1, status: 1 })

export default mongoose.model('FollowRequest', followRequestSchema)