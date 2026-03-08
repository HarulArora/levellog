import express from 'express'
import Comment from '../models/Comment.js'
import { protect } from '../middleware/auth.js'

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

// ── POST /api/comments/:igdbId ──
router.post('/:igdbId', protect, async (req, res) => {
    try {
        const { text, parentId } = req.body
        if (!text?.trim()) {
            return res.status(400).json({ success: false, message: 'Comment text is required' })
        }

        const comment = await Comment.create({
            igdbId: Number(req.params.igdbId),
            userId: req.user._id,
            text: text.trim(),
            parentId: parentId || null
        })

        const populated = await Comment.findById(comment._id)
            .populate('userId', 'username avatar badge level')

        res.status(201).json({ success: true, comment: populated })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── PUT /api/comments/:id ── sets edited: true
router.put('/:id', protect, async (req, res) => {
    try {
        const { text } = req.body
        if (!text?.trim()) {
            return res.status(400).json({ success: false, message: 'Comment text is required' })
        }

        const comment = await Comment.findOne({ _id: req.params.id, userId: req.user._id })
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found or not authorized' })
        }

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

// ── DELETE /api/comments/:id ──
router.delete('/:id', protect, async (req, res) => {
    try {
        const comment = await Comment.findOne({ _id: req.params.id, userId: req.user._id })
        if (!comment) {
            return res.status(404).json({ success: false, message: 'Comment not found or not authorized' })
        }

        if (!comment.parentId) {
            await Comment.deleteMany({ parentId: comment._id })
        }
        await comment.deleteOne()

        res.json({ success: true, message: 'Comment deleted' })
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
