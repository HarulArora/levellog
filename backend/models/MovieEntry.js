import mongoose from 'mongoose';

const movieEntrySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: ['movie', 'tv'],
            required: true,
            index: true
        },
        mediaType: {
            type: String,
            enum: ['movie', 'tv'],
            index: true
        },
        externalId: {
            type: Number,
            required: true,
            index: true
        },
        title: {
            type: String,
            required: true,
            trim: true
        },
        cover: {
            type: String,
            default: ''
        },
        coverImage: {
            type: String,
            default: ''
        },
        status: {
            type: String,
            enum: [
                'watched', 'completed', 'plan_to_watch', 'dropped', // movies
                'watching', 'on_hold' // TV additions
            ],
            required: true
        },
        rating: {
            type: Number,
            min: 0,
            max: 10,
            default: 0
        },
        episodesWatched: {
            type: Number,
            default: 0,
            min: 0
        },
        seasonsWatched: {
            type: Number,
            default: 0,
            min: 0
        },
        totalEpisodes: {
            type: Number,
            default: 0
        },
        totalSeasons: {
            type: Number,
            default: 0
        },
        notes: {
            type: String,
            default: ''
        },
        genre: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

movieEntrySchema.index({ userId: 1, type: 1, status: 1 });
movieEntrySchema.index({ userId: 1, externalId: 1 });
movieEntrySchema.index({ userId: 1, createdAt: -1 });
movieEntrySchema.index({ externalId: 1, type: 1 });

const MovieEntry = mongoose.model('MovieEntry', movieEntrySchema);
export default MovieEntry;
