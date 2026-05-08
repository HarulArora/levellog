import express from 'express'
import mongoose from 'mongoose'
import Comment from '../models/Comment.js'
import CommentLike from '../models/CommentLike.js'
import Notification from '../models/Notification.js'
import { protect } from '../middleware/auth.js'
import { awardXP, deductXP } from '../utils/xp.js'
import { censorText } from '../utils/moderation.js'
import { logEngagement } from '../utils/engagement.js'
import { withRetryTransaction } from '../utils/transaction.js'

const router = express.Router()

// ── GET /api/comments/:igdbId ──────────────────────────────────────────────────
router.get('/:igdbId', async (req, res) => {
    try {
        const igdbId = Number(req.params.igdbId)
        const page = Math.max(1, parseInt(req.query.page) || 1)
        const limit = Math.min(50, parseInt(req.query.limit) || 15)
        const skip = (page - 1) * limit

        const [topLevel, total] = await Promise.all([
            Comment.find({ igdbId, parentId: null })
                .populate('userId', 'username avatar badge level')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Comment.countDocuments({ igdbId, parentId: null })
        ])

        const topLevelIds = topLevel.map(c => c._id)
        const replies = await Comment.find({ 
            igdbId, 
            parentId: { $in: topLevelIds } 
        })
        .populate('userId', 'username avatar badge level')
        .sort({ createdAt: 1 })
        .lean()

        const comments = topLevel.map(comment => ({
            ...comment,
            replies: replies.filter(r => r.parentId?.toString() === comment._id.toString())
        }))

        res.json({ 
            success: true, 
            comments,
            pagination: {
                total,
                page,
                limit,
                pages: Math.ceil(total / limit),
                hasMore: page * limit < total
            }
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/comments/:igdbId ────────────────────────────────────────────────
router.post('/:igdbId', protect, async (req, res) => {
    try {
        const { text, parentId, replyToUserId, gameTitle } = req.body
        if (!text?.trim()) {
            return res.status(400).json({ success: false, message: 'Comment text is required' })
        }

        const result = await withRetryTransaction(async (session) => {
            const commentArray = await Comment.create([{
                igdbId: Number(req.params.igdbId),
                userId: req.user._id,
                text: censorText(text.trim()),
                parentId: parentId || null
            }], { session })
            const comment = commentArray[0]

            // Log engagement
            await logEngagement(req.params.igdbId, 'game', 'comment', req.user._id, session)

            const updatedUser = await awardXP(req.user._id, 1, session)

            if (parentId) {
                const notifMeta = {
                    igdbId: Number(req.params.igdbId),
                    gameTitle: gameTitle || '',
                    commentId: comment._id,
                    parentId,
                    preview: text.trim().slice(0, 80),
                }
                if (replyToUserId && replyToUserId.toString() !== req.user._id.toString()) {
                    await Notification.create([{ recipient: replyToUserId, sender: req.user._id, type: 'comment_reply', meta: notifMeta }], { session })
                }
                const parentComment = await Comment.findById(parentId).session(session).lean()
                if (parentComment &&
                    parentComment.userId.toString() !== req.user._id.toString() &&
                    parentComment.userId.toString() !== replyToUserId?.toString()) {
                    await Notification.create([{ recipient: parentComment.userId, sender: req.user._id, type: 'comment_reply', meta: notifMeta }], { session })
                }
            }
            return { comment, updatedUser }
        })

        const populated = await Comment.findById(result.comment._id)
            .populate('userId', 'username avatar badge level')

        res.status(201).json({
            success: true, comment: populated,
            message: 'Comment posted · +1 XP',
            xp: result.updatedUser.xp, level: result.updatedUser.level, badge: result.updatedUser.badge
        })
    } catch (err) {
        console.error('Game Comment Post Error:', err)
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
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ success: false, message: 'Invalid comment ID format' })
        }

        const result = await withRetryTransaction(async (session) => {
            const comment = await Comment.findById(req.params.id).session(session)
            if (!comment) throw new Error('Comment not found')

            if (comment.userId.toString() !== req.user._id.toString()) {
                throw new Error('Not authorized to delete this comment')
            }

            if (!comment.parentId) {
                const replies = await Comment.find({ parentId: comment._id }).session(session)
                for (const reply of replies) {
                    await CommentLike.deleteMany({ commentId: reply._id }).session(session)
                    await deductXP(reply.userId.toString(), 1, session)
                }
                await Comment.deleteMany({ parentId: comment._id }).session(session)
            }

            await CommentLike.deleteMany({ commentId: comment._id }).session(session)
            await comment.deleteOne({ session })

            const updatedUser = await deductXP(req.user._id, 1, session)
            return { updatedUser }
        })

        res.json({
            success: true, message: 'Comment deleted · -1 XP',
            xp: result.updatedUser.xp, level: result.updatedUser.level, badge: result.updatedUser.badge
        })
    } catch (err) {
        console.error('Game Comment Delete Error:', err)
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/comments/:id/like ───────────────────────────────────────────────
router.post('/:id/like', protect, async (req, res) => {
    try {
        const commentId = req.params.id
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({ success: false, message: 'Invalid comment ID' })
        }
        const userId = req.user._id

        const existing = await CommentLike.findOne({ commentId, userId })

        let likeDiff = 0
        let dislikeDiff = 0
        let finalStatus = { liked: false, disliked: false }

        if (existing?.type === 'like') {
            await existing.deleteOne()
            likeDiff = -1
        } else if (existing?.type === 'dislike') {
            existing.type = 'like'
            await existing.save()
            likeDiff = 1
            dislikeDiff = -1
            finalStatus.liked = true
        } else {
            await CommentLike.create({ commentId, userId, type: 'like' })
            likeDiff = 1
            finalStatus.liked = true
        }

        const updatedComment = await Comment.findByIdAndUpdate(
            commentId,
            { $inc: { likeCount: likeDiff, dislikeCount: dislikeDiff } },
            { returnDocument: 'after' }
        )

        if (!updatedComment) return res.status(404).json({ success: false, message: 'Comment not found' })

        res.json({
            success: true,
            ...finalStatus,
            likes: updatedComment.likeCount,
            dislikes: updatedComment.dislikeCount
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})

// ── POST /api/comments/:id/dislike ───────────────────────────────────────────
router.post('/:id/dislike', protect, async (req, res) => {
    try {
        const commentId = req.params.id
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({ success: false, message: 'Invalid comment ID' })
        }
        const userId = req.user._id

        const existing = await CommentLike.findOne({ commentId, userId })

        let likeDiff = 0
        let dislikeDiff = 0
        let finalStatus = { liked: false, disliked: false }

        if (existing?.type === 'dislike') {
            await existing.deleteOne()
            dislikeDiff = -1
        } else if (existing?.type === 'like') {
            existing.type = 'dislike'
            await existing.save()
            likeDiff = -1
            dislikeDiff = 1
            finalStatus.disliked = true
        } else {
            await CommentLike.create({ commentId, userId, type: 'dislike' })
            dislikeDiff = 1
            finalStatus.disliked = true
        }

        const updatedComment = await Comment.findByIdAndUpdate(
            commentId,
            { $inc: { likeCount: likeDiff, dislikeCount: dislikeDiff } },
            { returnDocument: 'after' }
        )

        if (!updatedComment) return res.status(404).json({ success: false, message: 'Comment not found' })

        res.json({
            success: true,
            ...finalStatus,
            likes: updatedComment.likeCount,
            dislikes: updatedComment.dislikeCount
        })
    } catch (err) {
        res.status(500).json({ success: false, message: err.message })
    }
})


// ── GET /api/comments/:id/like-status ─────────────────────────────────────────
router.get('/:id/like-status', protect, async (req, res) => {
    try {
        const commentId = req.params.id
        if (!mongoose.Types.ObjectId.isValid(commentId)) {
            return res.status(400).json({ success: false, message: 'Invalid comment ID' })
        }
        const existing = await CommentLike.findOne({
            commentId,
            userId: req.user._id
        }).lean()
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