import express from 'express'

import Notification from '../models/Notification.js'

import FollowRequest from '../models/FollowRequest.js'

import User from '../models/User.js'

import { protect } from '../middleware/auth.js'

import { awardXP, deductXP } from '../utils/xp.js'


const router = express.Router()


// ── GET /api/notifications ──

router.get('/', protect, async (req, res) => {

    try {

        const notifications = await Notification.find({ recipient: req.user._id })

            .populate('sender', 'username')

            .sort({ createdAt: -1 })

            .limit(50)

        res.json({ success: true, notifications })

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: error.message })

    }

})


// ── GET /api/notifications/unread-count ──

router.get('/unread-count', protect, async (req, res) => {

    try {

        const count = await Notification.countDocuments({ recipient: req.user._id, read: false })

        res.json({ success: true, count })

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to fetch unread count', error: error.message })

    }

})


// ── PATCH /api/notifications/mark-read ──

router.patch('/mark-read', protect, async (req, res) => {

    try {

        await Notification.updateMany({ recipient: req.user._id, read: false }, { read: true })

        res.json({ success: true, message: 'All marked as read' })

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to mark as read', error: error.message })

    }

})


// ── PATCH /api/notifications/mark-read/:id ──

router.patch('/mark-read/:id', protect, async (req, res) => {

    try {

        await Notification.findOneAndUpdate(

            { _id: req.params.id, recipient: req.user._id },

            { read: true }

        )

        res.json({ success: true, message: 'Marked as read' })

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to mark as read', error: error.message })

    }

})


// ── DELETE /api/notifications/delete-selected ──

router.delete('/delete-selected', protect, async (req, res) => {

    try {

        const { ids } = req.body

        if (!ids || !Array.isArray(ids) || ids.length === 0) {

            return res.status(400).json({ success: false, message: 'No ids provided' })

        }

        await Notification.deleteMany({ _id: { $in: ids }, recipient: req.user._id })

        res.json({ success: true, message: 'Deleted selected notifications' })

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to delete selected', error: error.message })

    }

})


// ── DELETE /api/notifications/delete-all ──

router.delete('/delete-all', protect, async (req, res) => {

    try {

        await Notification.deleteMany({ recipient: req.user._id })

        res.json({ success: true, message: 'All notifications deleted' })

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to delete all', error: error.message })

    }

})


// ── GET /api/notifications/requests ──

router.get('/requests', protect, async (req, res) => {

    try {

        const requests = await FollowRequest.find({

            recipient: req.user._id, status: 'pending'

        }).populate('sender', 'username avatar badge level')

        res.json({ success: true, requests })

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to fetch requests', error: error.message })

    }

})


// ── POST /api/notifications/requests/:id/accept ──

// +1 XP for sender (followed someone) and recipient (got followed)

// Private profile: XP only given here on accept, NOT when request is sent

router.post('/requests/:id/accept', protect, async (req, res) => {

    try {

        const request = await FollowRequest.findById(req.params.id).populate('sender', 'username')

        if (!request) return res.status(404).json({ success: false, message: 'Request not found' })


        request.status = 'accepted'

        await request.save()


        await User.findByIdAndUpdate(req.user._id, { $addToSet: { followers: request.sender._id } })

        await User.findByIdAndUpdate(request.sender._id, { $addToSet: { following: req.user._id } })


        // +1 XP for sender (they followed someone)

        await awardXP(request.sender._id, 1)

        // +1 XP for recipient (they got followed)

        await awardXP(req.user._id, 1)


        await Notification.create({

            recipient: request.sender._id,

            sender: req.user._id,

            type: 'request_accepted'

        })


        res.json({ success: true, message: 'Request accepted' })

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to accept request', error: error.message })

    }

})


// ── POST /api/notifications/requests/:id/decline ──

router.post('/requests/:id/decline', protect, async (req, res) => {

    try {

        const request = await FollowRequest.findById(req.params.id)

        if (!request) return res.status(404).json({ success: false, message: 'Request not found' })

        request.status = 'declined'

        await request.save()

        res.json({ success: true, message: 'Request declined' })

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to decline request', error: error.message })

    }

})


// ── POST /api/notifications/follow ──

// Direct follow (public profile) — +1 XP for both sides on follow

// Unfollow — only the person who unfollows loses -1 XP

router.post('/follow', protect, async (req, res) => {

    try {

        const { targetUserId } = req.body

        if (!targetUserId) return res.status(400).json({ success: false, message: 'targetUserId required' })


        const targetUser = await User.findById(targetUserId)

        if (!targetUser) return res.status(404).json({ success: false, message: 'User not found' })


        const alreadyFollowing = targetUser.followers.includes(req.user._id)


        if (alreadyFollowing) {

            // Unfollow → only the person who unfollows loses XP

            await User.findByIdAndUpdate(targetUserId, { $pull: { followers: req.user._id } })

            await User.findByIdAndUpdate(req.user._id, { $pull: { following: targetUserId } })


            await deductXP(req.user._id, 1)      // follower loses XP
            await deductXP(targetUserId, 1)        // unfollowed person also loses XP


            return res.json({

                success: true,

                following: false,

                message: 'Unfollowed · -1 XP'

            })

        }


        // Follow → +1 XP for both sides

        await User.findByIdAndUpdate(targetUserId, { $addToSet: { followers: req.user._id } })

        await User.findByIdAndUpdate(req.user._id, { $addToSet: { following: targetUserId } })


        await awardXP(req.user._id, 1)      // follower earns XP

        await awardXP(targetUserId, 1)       // followed person earns XP


        await Notification.create({

            recipient: targetUserId,

            sender: req.user._id,

            type: 'follow'

        })


        res.json({

            success: true,

            following: true,

            message: 'Following · +1 XP'

        })

    } catch (error) {

        res.status(500).json({ success: false, message: 'Failed to follow', error: error.message })

    }

})


export default router
