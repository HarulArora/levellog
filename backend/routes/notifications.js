import express from 'express'
import Notification from '../models/Notification.js'
import FollowRequest from '../models/FollowRequest.js'
import Follow from '../models/Follow.js'
import User from '../models/User.js'
import { protect } from '../middleware/auth.js'
import { awardXP, deductXP } from '../utils/xp.js'

const router = express.Router()

router.get('/', protect, async (req, res) => {
    try {
        const notifications = await Notification.find({ recipient: req.user._id })
            .populate('sender', 'username')
            .sort({ createdAt: -1 }).limit(50)
        res.json({ success: true, notifications })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

router.get('/unread-count', protect, async (req, res) => {
    try {
        const count = await Notification.countDocuments({ recipient: req.user._id, read: false })
        res.json({ success: true, count })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

router.patch('/mark-read', protect, async (req, res) => {
    try {
        await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true })
        res.json({ success: true, message: 'All marked as read' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

router.patch('/mark-read/:id', protect, async (req, res) => {
    try {
        await Notification.findOneAndUpdate({ _id: req.params.id, recipient: req.user._id }, { read: true })
        res.json({ success: true })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

router.delete('/delete-selected', protect, async (req, res) => {
    try {
        const { ids } = req.body
        if (!ids?.length) return res.status(400).json({ success: false, message: 'No ids provided' })
        await Notification.deleteMany({ _id: { $in: ids }, recipient: req.user._id })
        res.json({ success: true, message: 'Deleted selected notifications' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

router.delete('/delete-all', protect, async (req, res) => {
    try {
        await Notification.deleteMany({ recipient: req.user._id })
        res.json({ success: true, message: 'All notifications deleted' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

router.get('/requests', protect, async (req, res) => {
    try {
        const requests = await FollowRequest.find({ recipient: req.user._id, status: 'pending' })
            .populate('sender', 'username avatar badge level')
        res.json({ success: true, requests })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

// ── POST /api/notifications/requests/:id/accept ───────────────────────────────
router.post('/requests/:id/accept', protect, async (req, res) => {
    try {
        const result = await withRetryTransaction(async (session) => {
            const request = await FollowRequest.findById(req.params.id).session(session)
            if (!request) throw new Error('Request not found')

            // create Follow doc + update counts + award XP
            await Follow.create([{ followerId: request.sender, followingId: req.user._id }], { session })
            await FollowRequest.findByIdAndDelete(request._id, { session })
            await User.findByIdAndUpdate(req.user._id, { $inc: { followerCount: 1 } }, { session })
            await User.findByIdAndUpdate(request.sender, { $inc: { followingCount: 1 } }, { session })
            await awardXP(request.sender, 1, session)
            await awardXP(req.user._id, 1, session)
            await Notification.create([{ recipient: request.sender, sender: req.user._id, type: 'request_accepted' }], { session })
            
            return { message: 'Request accepted' }
        })

        res.json({ success: true, ...result })
    } catch (error) {
        if (error.code === 11000) {
            // Follow already exists — clean up the request anyway
            await FollowRequest.findByIdAndDelete(req.params.id)
            return res.json({ success: true, message: 'Already following' })
        }
        res.status(error.message === 'Request not found' ? 404 : 500).json({ success: false, message: error.message })
    }
})

// ── POST /api/notifications/requests/:id/decline ─────────────────────────────
router.post('/requests/:id/decline', protect, async (req, res) => {
    try {
        await FollowRequest.findByIdAndDelete(req.params.id)
        res.json({ success: true, message: 'Request declined' })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

// ── POST /api/notifications/follow ────────────────────────────────────────────
router.post('/follow', protect, async (req, res) => {
    try {
        const { targetUserId } = req.body
        if (!targetUserId) return res.status(400).json({ success: false, message: 'targetUserId required' })

        const targetUser = await User.findById(targetUserId)
        if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' })

        const result = await withRetryTransaction(async (session) => {
            const alreadyFollowing = await Follow.findOne({ followerId: req.user._id, followingId: targetUserId }).session(session)

            if (alreadyFollowing) {
                await Follow.findByIdAndDelete(alreadyFollowing._id, { session })
                await User.findByIdAndUpdate(targetUserId, { $inc: { followerCount: -1 } }, { session })
                await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } }, { session })
                await deductXP(req.user._id, 1, session)
                await deductXP(targetUserId, 1, session)
                return { following: false, message: 'Unfollowed · -1 XP' }
            }

            await Follow.create([{ followerId: req.user._id, followingId: targetUserId }], { session })
            await User.findByIdAndUpdate(targetUserId, { $inc: { followerCount: 1 } }, { session })
            await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } }, { session })
            await awardXP(req.user._id, 1, session)
            await awardXP(targetUserId, 1, session)
            await Notification.create([{ recipient: targetUserId, sender: req.user._id, type: 'follow' }], { session })
            
            return { following: true, message: 'Following · +1 XP' }
        })

        res.json({ success: true, ...result })
    } catch (error) {
        res.status(500).json({ success: false, message: error.message })
    }
})

export default router