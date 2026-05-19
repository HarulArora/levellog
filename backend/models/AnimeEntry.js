import mongoose from 'mongoose';

const animeEntrySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true
        },
        type: {
            type: String,
            enum: ['anime', 'manga'],
            required: true,
            index: true
        },
        mediaType: {
            type: String,
            enum: ['anime', 'manga'],
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
            enum: ['playing', 'watching', 'reading', 'completed', 'planned', 'dropped', 'paused'],
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
        chaptersRead: {
            type: Number,
            default: 0,
            min: 0
        },
        volumesRead: {
            type: Number,
            default: 0,
            min: 0
        },
        totalEpisodes: {
            type: Number,
            default: 0
        },
        totalChapters: {
            type: Number,
            default: 0
        },
        totalVolumes: {
            type: Number,
            default: 0
        },
        airingStatus: {
            type: String,
            default: ''
        },
        notes: {
            type: String,
            default: ''
        },
        genre: {
            type: String,
            default: ''
        },
        year: {
            type: Number,
            default: null
        }
    },
    {
        timestamps: true
    }
);

// Indexes for performance
animeEntrySchema.index({ userId: 1, type: 1, status: 1 });
animeEntrySchema.index({ userId: 1, externalId: 1, type: 1 }, { unique: true });
animeEntrySchema.index({ userId: 1, createdAt: -1 });
animeEntrySchema.index({ externalId: 1, type: 1 });

// Auto-heal broken cdn.myanimelist.netimages cover URLs
animeEntrySchema.pre('save', function () {
    if (this.cover && this.cover.includes('cdn.myanimelist.netimages')) {
        this.cover = this.cover.replace('cdn.myanimelist.netimages', 'cdn.myanimelist.net/images');
    }
    if (this.coverImage && this.coverImage.includes('cdn.myanimelist.netimages')) {
        this.coverImage = this.coverImage.replace('cdn.myanimelist.netimages', 'cdn.myanimelist.net/images');
    }
});

animeEntrySchema.post('init', function (doc) {
    if (doc.cover && doc.cover.includes('cdn.myanimelist.netimages')) {
        doc.cover = doc.cover.replace('cdn.myanimelist.netimages', 'cdn.myanimelist.net/images');
    }
    if (doc.coverImage && doc.coverImage.includes('cdn.myanimelist.netimages')) {
        doc.coverImage = doc.coverImage.replace('cdn.myanimelist.netimages', 'cdn.myanimelist.net/images');
    }
});

const AnimeEntry = mongoose.model('AnimeEntry', animeEntrySchema);
export default AnimeEntry;

