import express from 'express'
import Comment from '../models/Comment.js'
import Notification from '../models/Notification.js'
import { protect } from '../middleware/auth.js'
import { awardXP, deductXP } from '../utils/xp.js'

const router = express.Router()

// ── GET /api/comments/:igdbId ──
router.get('/:igdbId', async (req, res) => {
    try {
        const igdbId = Number(req.params.igdbId)
        const topLevel = await Comment.find({ igdbId, parentId: null })
            .populate('userId', 'username avatar badge level')
            .sort({ createdAt: -1 })
        const replies = await Comment.find({ igdbId, parentId: { $ne: null } })
            .populate('userId', 'username avatar badge level')
            .sort({ createdAt: 1 })
        const comments = topLevel.map(comment => ({
            ...comment.toObject(),
            replies: replies.filter(r => r.parentId?.toString() === comment._id.toString())
        }))
        res.json({ success: true, comments })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/comments/:igdbId ── +1 XP for posting a comment
// Body: { text, parentId?, replyToUserId?, gameTitle? }
router.post('/:igdbId', protect, async (req, res) => {
    try {
        const { text, parentId, replyToUserId, gameTitle } = req.body
        if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text is required' })

        const comment = await Comment.create({
            igdbId: Number(req.params.igdbId),
            userId: req.user._id,
            text: text.trim(),
            parentId: parentId || null
        })

        const populated = await Comment.findById(comment._id)
            .populate('userId', 'username avatar badge level')

        const updatedUser = await awardXP(req.user._id, 1)

        // ── Notifications (only for replies) ──────────────────────────────────
        if (parentId) {
            const notifMeta = {
                igdbId: Number(req.params.igdbId),
                gameTitle: gameTitle || '',
                commentId: comment._id,
                parentId,
                preview: text.trim().slice(0, 80),
            }

            // Notify the specific person whose comment was replied to
            if (replyToUserId && replyToUserId.toString() !== req.user._id.toString()) {
                await Notification.create({
                    recipient: replyToUserId,
                    sender: req.user._id,
                    type: 'comment_reply',
                    meta: notifMeta,
                })
            }

            // Also notify the top-level comment author if they're a different person
            const parentComment = await Comment.findById(parentId).lean()
            if (
                parentComment &&
                parentComment.userId.toString() !== req.user._id.toString() &&
                parentComment.userId.toString() !== replyToUserId?.toString()
            ) {
                await Notification.create({
                    recipient: parentComment.userId,
                    sender: req.user._id,
                    type: 'comment_reply',
                    meta: notifMeta,
                })
            }
        }

        res.status(201).json({
            success: true,
            comment: populated,
            message: 'Comment posted · +1 XP',
            xp: updatedUser.xp,
            level: updatedUser.level,
            badge: updatedUser.badge
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── PUT /api/comments/:id ── edit, sets edited: true, no XP change
router.put('/:id', protect, async (req, res) => {
    try {
        const { text } = req.body
        if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text is required' })
        const comment = await Comment.findOne({ _id: req.params.id, userId: req.user._id })
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found or not authorized' })
        comment.text = text.trim()
        comment.edited = true
        await comment.save()
        const populated = await Comment.findById(comment._id)
            .populate('userId', 'username avatar badge level')
        res.json({ success: true, comment: populated })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── DELETE /api/comments/:id ── -1 XP for deleting own comment
router.delete('/:id', protect, async (req, res) => {
    try {
        const comment = await Comment.findOne({ _id: req.params.id, userId: req.user._id })
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found or not authorized' })
        if (!comment.parentId) {
            const replies = await Comment.find({ parentId: comment._id })
            for (const reply of replies) {
                await deductXP(reply.userId.toString(), 1)
            }
            await Comment.deleteMany({ parentId: comment._id })
        }
        await comment.deleteOne()
        const updatedUser = await deductXP(req.user._id, 1)
        res.json({
            success: true,
            message: 'Comment deleted · -1 XP',
            xp: updatedUser.xp,
            level: updatedUser.level,
            badge: updatedUser.badge
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/comments/:id/like ──
router.post('/:id/like', protect, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id)
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' })
        const userId = req.user._id.toString()
        const likedIndex = comment.likes.findIndex(id => id.toString() === userId)
        const dislikedIndex = comment.dislikes.findIndex(id => id.toString() === userId)
        if (dislikedIndex > -1) comment.dislikes.splice(dislikedIndex, 1)
        if (likedIndex > -1) {
            comment.likes.splice(likedIndex, 1)
        } else {
            comment.likes.push(req.user._id)
        }
        await comment.save()
        res.json({
            success: true,
            likes: comment.likes.length,
            dislikes: comment.dislikes.length,
            liked: likedIndex === -1,
            disliked: false
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/comments/:id/dislike ──
router.post('/:id/dislike', protect, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id)
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' })
        const userId = req.user._id.toString()
        const likedIndex = comment.likes.findIndex(id => id.toString() === userId)
        const dislikedIndex = comment.dislikes.findIndex(id => id.toString() === userId)
        if (likedIndex > -1) comment.likes.splice(likedIndex, 1)
        if (dislikedIndex > -1) {
            comment.dislikes.splice(dislikedIndex, 1)
        } else {
            comment.dislikes.push(req.user._id)
        }
        await comment.save()
        res.json({
            success: true,
            likes: comment.likes.length,
            dislikes: comment.dislikes.length,
            liked: false,
            disliked: dislikedIndex === -1
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

export default router