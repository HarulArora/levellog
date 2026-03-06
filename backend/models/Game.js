// Game.js — the blueprint for game data in MongoDB
// Mongoose uses this schema to validate data before saving
// Think of it like a form with required fields

import mongoose from 'mongoose'

// Schema = the shape/structure of a game document in MongoDB
const gameSchema = new mongoose.Schema(
    {
        // Which user this game belongs to
        // We'll fill this properly when we add auth
        // For now it's optional
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',    // references the User model
            required: false
        },

        title: {
            type: String,
            required: true,   // title is mandatory
            trim: true        // removes extra spaces automatically
        },

        genre: {
            type: String,
            default: 'Unknown',
            trim: true
        },

        // status must be one of these exact values
        status: {
            type: String,
            enum: ['playing', 'completed', 'planned', 'paused', 'dropped'],
            default: 'planned'
        },

        rating: {
            type: Number,
            min: 0,     // minimum value
            max: 10,    // maximum value
            default: 0
        },

        hours: {
            type: Number,
            default: 0,
            min: 0
        },

        platforms: {
            type: [String],   // array of strings
            default: []
        },

        steamId: {
            type: String,
            default: ''
        },

        notes: {
            type: String,
            default: ''
        }
    },
    {
        // timestamps: true automatically adds createdAt and updatedAt fields
        timestamps: true
    }
)

// Create the model from the schema
// 'Game' → MongoDB will create a collection called 'games' (lowercase + plural)
const Game = mongoose.model('Game', gameSchema)

export default Game