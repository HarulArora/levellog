// useGames.js — custom hook for all game operations
// This keeps all game logic in ONE place
// Any component that needs games just calls useGames()
// 
// Think of it as a remote control for your games data
// It has buttons: fetchGames, addGame, deleteGame, updateGame

import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios.js'

function useGames() {

    // ── STATE ──
    // games → the array of games from database
    const [games, setGames] = useState([])

    // loading → true while waiting for API response
    // We show a spinner/skeleton when this is true
    const [loading, setLoading] = useState(false)

    // error → stores error message if API call fails
    const [error, setError] = useState(null)


    // ── FETCH ALL GAMES ──
    // useCallback → prevents function from being recreated on every render
    // This is a performance optimization
    const fetchGames = useCallback(async () => {
        setLoading(true)   // show loading spinner
        setError(null)     // clear any previous errors

        try {
            // Call GET /api/games on your backend
            const response = await api.get('/games')

            // response.data is what your backend sent back
            // { success: true, games: [...] }
            setGames(response.data.games)

        } catch (err) {
            // If something went wrong — store the error message
            setError(err.response?.data?.message || 'Failed to fetch games')
            console.error('Fetch games error:', err)

        } finally {
            // finally runs whether success or error
            setLoading(false)  // always hide loading spinner
        }
    }, [])


    // ── ADD GAME ──
    const addGame = async (gameData) => {
        try {
            // Call POST /api/games with the new game data
            const response = await api.post('/games', gameData)

            // Add the new game to the START of our local state
            // This way the new game appears at the top instantly
            // without needing to refetch all games
            setGames(prev => [response.data.game, ...prev])

            return { success: true, game: response.data.game }

        } catch (err) {
            const message = err.response?.data?.message || 'Failed to add game'
            return { success: false, message }
        }
    }


    // ── UPDATE GAME ──
    const updateGame = async (id, updateData) => {
        try {
            const response = await api.put(`/games/${id}`, updateData)

            // Update just this one game in local state
            // map() goes through every game and replaces the matching one
            setGames(prev =>
                prev.map(game =>
                    game._id === id ? response.data.game : game
                )
            )

            return { success: true, game: response.data.game }

        } catch (err) {
            const message = err.response?.data?.message || 'Failed to update game'
            return { success: false, message }
        }
    }


    // ── DELETE GAME ──
    const deleteGame = async (id) => {
        try {
            await api.delete(`/games/${id}`)

            // Remove this game from local state immediately
            // filter() keeps all games EXCEPT the deleted one
            setGames(prev => prev.filter(game => game._id !== id))

            return { success: true }

        } catch (err) {
            const message = err.response?.data?.message || 'Failed to delete game'
            return { success: false, message }
        }
    }


    // ── FETCH ON MOUNT ──
    // useEffect with empty [] runs ONCE when component first loads
    // This automatically fetches games when Library page opens
    useEffect(() => {
        fetchGames()
    }, [fetchGames])


    // Return everything the component needs
    return {
        games,        // the array of games
        loading,      // true/false — is data loading?
        error,        // error message or null
        fetchGames,   // function to manually refetch
        addGame,      // function to add a game
        updateGame,   // function to update a game
        deleteGame,   // function to delete a game
    }
}

export default useGames