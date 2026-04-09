import express from 'express'
import Comment from '../models/Comment.js'
import CommentLike from '../models/CommentLike.js'
import Notification from '../models/Notification.js'
import { protect } from '../middleware/auth.js'
import { awardXP, deductXP } from '../utils/xp.js'
import { censorText } from '../utils/moderation.js'

const router = express.Router()

// ── GET /api/comments/:igdbId ──────────────────────────────────────────────────
router.get('/:igdbId', async (req, res) => {
    try {
        const igdbId = Number(req.params.igdbId)
        const [topLevel, replies] = await Promise.all([
            Comment.find({ igdbId, parentId: null })
                .populate('userId', 'username avatar badge level')
                .sort({ createdAt: -1 }),
            Comment.find({ igdbId, parentId: { $ne: null } })
                .populate('userId', 'username avatar badge level')
                .sort({ createdAt: 1 }),
        ])
        const comments = topLevel.map(comment => ({
            ...comment.toObject(),
            replies: replies.filter(r => r.parentId?.toString() === comment._id.toString())
        }))
        res.json({ success: true, comments })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/comments/:igdbId ────────────────────────────────────────────────
router.post('/:igdbId', protect, async (req, res) => {
    try {
        const { text, parentId, replyToUserId, gameTitle } = req.body
        if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text is required' })

        const comment = await Comment.create({
            igdbId: Number(req.params.igdbId),
            userId: req.user._id,
            text: censorText(text.trim()),
            parentId: parentId || null
        })

        const populated = await Comment.findById(comment._id)
            .populate('userId', 'username avatar badge level')

        const updatedUser = await awardXP(req.user._id, 1)

        if (parentId) {
            const notifMeta = {
                igdbId: Number(req.params.igdbId),
                gameTitle: gameTitle || '',
                commentId: comment._id,
                parentId,
                preview: text.trim().slice(0, 80),
            }
            if (replyToUserId && replyToUserId.toString() !== req.user._id.toString()) {
                await Notification.create({ recipient: replyToUserId, sender: req.user._id, type: 'comment_reply', meta: notifMeta })
            }
            const parentComment = await Comment.findById(parentId).lean()
            if (parentComment &&
                parentComment.userId.toString() !== req.user._id.toString() &&
                parentComment.userId.toString() !== replyToUserId?.toString()) {
                await Notification.create({ recipient: parentComment.userId, sender: req.user._id, type: 'comment_reply', meta: notifMeta })
            }
        }

        res.status(201).json({
            success: true, comment: populated,
            message: 'Comment posted · +1 XP',
            xp: updatedUser.xp, level: updatedUser.level, badge: updatedUser.badge
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── PUT /api/comments/:id ─────────────────────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
    try {
        const { text } = req.body
        if (!text?.trim()) return res.status(400).json({ success: false, message: 'Comment text is required' })
        const comment = await Comment.findOne({ _id: req.params.id, userId: req.user._id })
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found or not authorized' })
        comment.text = censorText(text.trim())
        comment.edited = true
        await comment.save()
        const populated = await Comment.findById(comment._id).populate('userId', 'username avatar badge level')
        res.json({ success: true, comment: populated })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── DELETE /api/comments/:id ──────────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
    try {
        const comment = await Comment.findOne({ _id: req.params.id, userId: req.user._id })
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found or not authorized' })

        if (!comment.parentId) {
            const replies = await Comment.find({ parentId: comment._id })
            for (const reply of replies) {
                await Promise.all([
                    CommentLike.deleteMany({ commentId: reply._id }),
                    deductXP(reply.userId.toString(), 1),
                ])
            }
            await Comment.deleteMany({ parentId: comment._id })
        }

        await Promise.all([
            comment.deleteOne(),
            CommentLike.deleteMany({ commentId: comment._id }),
        ])

        const updatedUser = await deductXP(req.user._id, 1)
        res.json({
            success: true, message: 'Comment deleted · -1 XP',
            xp: updatedUser.xp, level: updatedUser.level, badge: updatedUser.badge
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/comments/:id/like ───────────────────────────────────────────────
router.post('/:id/like', protect, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id)
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' })

        const existing = await CommentLike.findOne({ commentId: req.params.id, userId: req.user._id })

        if (existing?.type === 'like') {
            // toggle off
            await existing.deleteOne()
            await Comment.findByIdAndUpdate(req.params.id, { $inc: { likeCount: -1 } })
            return res.json({
                success: true, liked: false, disliked: false,
                likes: comment.likeCount - 1, dislikes: comment.dislikeCount
            })
        }

        if (existing?.type === 'dislike') {
            // switch dislike → like
            existing.type = 'like'
            await existing.save()
            await Comment.findByIdAndUpdate(req.params.id, { $inc: { likeCount: 1, dislikeCount: -1 } })
            return res.json({
                success: true, liked: true, disliked: false,
                likes: comment.likeCount + 1, dislikes: comment.dislikeCount - 1
            })
        }

        // new like
        await CommentLike.create({ commentId: req.params.id, userId: req.user._id, type: 'like' })
        await Comment.findByIdAndUpdate(req.params.id, { $inc: { likeCount: 1 } })
        res.json({
            success: true, liked: true, disliked: false,
            likes: comment.likeCount + 1, dislikes: comment.dislikeCount
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/comments/:id/dislike ───────────────────────────────────────────
router.post('/:id/dislike', protect, async (req, res) => {
    try {
        const comment = await Comment.findById(req.params.id)
        if (!comment) return res.status(404).json({ success: false, message: 'Comment not found' })

        const existing = await CommentLike.findOne({ commentId: req.params.id, userId: req.user._id })

        if (existing?.type === 'dislike') {
            await existing.deleteOne()
            await Comment.findByIdAndUpdate(req.params.id, { $inc: { dislikeCount: -1 } })
            return res.json({
                success: true, liked: false, disliked: false,
                likes: comment.likeCount, dislikes: comment.dislikeCount - 1
            })
        }

        if (existing?.type === 'like') {
            existing.type = 'dislike'
            await existing.save()
            await Comment.findByIdAndUpdate(req.params.id, { $inc: { likeCount: -1, dislikeCount: 1 } })
            return res.json({
                success: true, liked: false, disliked: true,
                likes: comment.likeCount - 1, dislikes: comment.dislikeCount + 1
            })
        }

        await CommentLike.create({ commentId: req.params.id, userId: req.user._id, type: 'dislike' })
        await Comment.findByIdAndUpdate(req.params.id, { $inc: { dislikeCount: 1 } })
        res.json({
            success: true, liked: false, disliked: true,
            likes: comment.likeCount, dislikes: comment.dislikeCount + 1
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})


// ── GET /api/comments/:id/like-status ─────────────────────────────────────────
router.get('/:id/like-status', protect, async (req, res) => {
    try {
        const existing = await CommentLike.findOne({
            commentId: req.params.id,
            userId: req.user._id
        })
        res.json({
            success: true,
            liked: existing?.type === 'like',
            disliked: existing?.type === 'dislike',
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

export default router