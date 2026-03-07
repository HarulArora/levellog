import express from 'express'
import Notification from '../models/Notification.js'
import FollowRequest from '../models/FollowRequest.js'
import User from '../models/User.js'
import { protect } from '../middleware/auth.js'

const router = express.Router()

// ── GET /api/notifications ──
router.get('/', protect, async (req, res) => {
    try {
        const notifications = await Notification.find({
            recipient: req.user._id
        })
            .populate('sender', 'username')
            .sort({ createdAt: -1 })
            .limit(50)

        res.json({ success: true, notifications })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch notifications',
            error: error.message
        })
    }
})

// ── GET /api/notifications/unread-count ──
router.get('/unread-count', protect, async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user._id,
            read: false
        })
        res.json({ success: true, count })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch unread count',
            error: error.message
        })
    }
})

// ── PATCH /api/notifications/mark-read ──
// Mark ALL notifications as read
router.patch('/mark-read', protect, async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.user._id, read: false },
            { read: true }
        )
        res.json({ success: true, message: 'All marked as read' })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to mark as read',
            error: error.message
        })
    }
})

// ── PATCH /api/notifications/mark-read/:id ──
// Mark ONE notification as read
router.patch('/mark-read/:id', protect, async (req, res) => {
    try {
        await Notification.findOneAndUpdate(
            { _id: req.params.id, recipient: req.user._id },
            { read: true }
        )
        res.json({ success: true, message: 'Marked as read' })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to mark as read',
            error: error.message
        })
    }
})

// ── DELETE /api/notifications/delete-selected ──
// Delete selected notifications by ids
router.delete('/delete-selected', protect, async (req, res) => {
    try {
        const { ids } = req.body
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No ids provided'
            })
        }
        await Notification.deleteMany({
            _id: { $in: ids },
            recipient: req.user._id
        })
        res.json({ success: true, message: 'Deleted selected notifications' })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete selected',
            error: error.message
        })
    }
})

// ── DELETE /api/notifications/delete-all ──
// Delete ALL notifications for user
router.delete('/delete-all', protect, async (req, res) => {
    try {
        await Notification.deleteMany({ recipient: req.user._id })
        res.json({ success: true, message: 'All notifications deleted' })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to delete all',
            error: error.message
        })
    }
})

// ── GET /api/notifications/requests ──
router.get('/requests', protect, async (req, res) => {
    try {
        const requests = await FollowRequest.find({
            recipient: req.user._id,
            status: 'pending'
        }).populate('sender', 'username')

        res.json({ success: true, requests })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to fetch requests',
            error: error.message
        })
    }
})

// ── POST /api/notifications/requests/:id/accept ──
router.post('/requests/:id/accept', protect, async (req, res) => {
    try {
        const request = await FollowRequest.findById(req.params.id)
            .populate('sender', 'username')

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Request not found'
            })
        }

        // Update request status
        request.status = 'accepted'
        await request.save()

        // Add to followers/following
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { followers: request.sender._id }
        })
        await User.findByIdAndUpdate(request.sender._id, {
            $addToSet: { following: req.user._id }
        })

        // Notify the sender
        await Notification.create({
            recipient: request.sender._id,
            sender: req.user._id,
            type: 'request_accepted'
        })

        res.json({ success: true, message: 'Request accepted' })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to accept request',
            error: error.message
        })
    }
})

// ── POST /api/notifications/requests/:id/decline ──
router.post('/requests/:id/decline', protect, async (req, res) => {
    try {
        const request = await FollowRequest.findById(req.params.id)

        if (!request) {
            return res.status(404).json({
                success: false,
                message: 'Request not found'
            })
        }

        request.status = 'declined'
        await request.save()

        res.json({ success: true, message: 'Request declined' })
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Failed to decline request',
            error: error.message
        })
    }
})

export default router
