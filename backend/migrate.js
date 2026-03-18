import 'dotenv/config'
import mongoose from 'mongoose'

const MONGO_URI = process.env.MONGODB_URI

await mongoose.connect(MONGO_URI)
console.log('Connected to Atlas')

const db = mongoose.connection.db

// ── 1. Migrate followers/following → follows collection ────────────────────────
console.log('\n[1/4] Migrating followers/following arrays → follows collection...')

const users = await db.collection('users').find({}).toArray()
let followsInserted = 0
let followsSkipped = 0

for (const user of users) {
    const followingList = user.following || []
    for (const targetId of followingList) {
        try {
            await db.collection('follows').updateOne(
                { followerId: user._id, followingId: new mongoose.Types.ObjectId(targetId) },
                { $setOnInsert: { followerId: user._id, followingId: new mongoose.Types.ObjectId(targetId), createdAt: new Date(), updatedAt: new Date() } },
                { upsert: true }
            )
            followsInserted++
        } catch {
            followsSkipped++
        }
    }
}
console.log(`  Follows created: ${followsInserted}, skipped: ${followsSkipped}`)

// Update cached counters on each user
for (const user of users) {
    const followerCount = await db.collection('follows').countDocuments({ followingId: user._id })
    const followingCount = await db.collection('follows').countDocuments({ followerId: user._id })
    await db.collection('users').updateOne(
        { _id: user._id },
        { $set: { followerCount, followingCount } }
    )
}
console.log('  Cached counters updated on all users')

// ── 2. Migrate comment likes/dislikes → commentlikes collection ───────────────
console.log('\n[2/4] Migrating comment likes/dislikes → commentlikes collection...')

const comments = await db.collection('comments').find({}).toArray()
let likesInserted = 0

for (const comment of comments) {
    const likeList    = comment.likes    || []
    const dislikeList = comment.dislikes || []

    for (const userId of likeList) {
        try {
            await db.collection('commentlikes').updateOne(
                { commentId: comment._id, userId: new mongoose.Types.ObjectId(userId) },
                { $setOnInsert: { commentId: comment._id, userId: new mongoose.Types.ObjectId(userId), type: 'like', createdAt: new Date(), updatedAt: new Date() } },
                { upsert: true }
            )
            likesInserted++
        } catch { /* duplicate — skip */ }
    }

    for (const userId of dislikeList) {
        try {
            await db.collection('commentlikes').updateOne(
                { commentId: comment._id, userId: new mongoose.Types.ObjectId(userId) },
                { $setOnInsert: { commentId: comment._id, userId: new mongoose.Types.ObjectId(userId), type: 'dislike', createdAt: new Date(), updatedAt: new Date() } },
                { upsert: true }
            )
            likesInserted++
        } catch { /* duplicate — skip */ }
    }

    // set cached counters on the comment
    await db.collection('comments').updateOne(
        { _id: comment._id },
        { $set: { likeCount: likeList.length, dislikeCount: dislikeList.length } }
    )
}
console.log(`  CommentLikes inserted: ${likesInserted}`)

// ── 3. Migrate GameList embedded games → gamelistentries collection ────────────
console.log('\n[3/4] Migrating GameList embedded games → gamelistentries collection...')

const lists = await db.collection('gamelists').find({}).toArray()
let entriesInserted = 0

for (const list of lists) {
    const games = list.games || []
    for (const game of games) {
        try {
            await db.collection('gamelistentries').updateOne(
                { listId: list._id, igdbId: game.igdbId },
                { $setOnInsert: {
                    listId: list._id,
                    igdbId: game.igdbId,
                    gameTitle: game.gameTitle,
                    gameCover: game.gameCover || '',
                    genre: game.genre || '',
                    createdAt: game.addedAt || new Date(),
                    updatedAt: new Date(),
                }},
                { upsert: true }
            )
            entriesInserted++
        } catch { /* duplicate — skip */ }
    }

    // set cached gameCount
    await db.collection('gamelists').updateOne(
        { _id: list._id },
        { $set: { gameCount: games.length } }
    )
}
console.log(`  GameListEntries inserted: ${entriesInserted}`)

// ── 4. Accept + migrate any 'accepted' FollowRequests ─────────────────────────
console.log('\n[4/4] Cleaning up accepted FollowRequests...')

const acceptedRequests = await db.collection('followrequests').find({ status: 'accepted' }).toArray()
let requestsMigrated = 0

for (const req of acceptedRequests) {
    try {
        await db.collection('follows').updateOne(
            { followerId: req.sender, followingId: req.recipient },
            { $setOnInsert: { followerId: req.sender, followingId: req.recipient, createdAt: req.updatedAt || new Date(), updatedAt: new Date() } },
            { upsert: true }
        )
        await db.collection('followrequests').deleteOne({ _id: req._id })
        requestsMigrated++
    } catch { /* duplicate follow already exists */ }
}
console.log(`  Accepted requests migrated and deleted: ${requestsMigrated}`)

console.log('\nMigration complete. Safe to deploy new code.')
await mongoose.disconnect()
process.exit(0)
