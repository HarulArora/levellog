import { useState, useEffect, useCallback } from 'react'
import api from '../api/axios.js'

function useGames() {

    const [games, setGames] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)

    const fetchGames = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const response = await api.get('/games')
            setGames(response.data.games)
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to fetch games')
        } finally {
            setLoading(false)
        }
    }, [])

    const addGame = async (gameData) => {
        try {
            // Get userId from JWT token stored in localStorage
            const token = localStorage.getItem('levellog_token')
            let userId = null

            if (token) {
                // Decode JWT payload to get userId
                // JWT = header.payload.signature
                // We only need the payload (middle part)
                const payload = JSON.parse(atob(token.split('.')[1]))
                userId = payload.userId
            }

            const response = await api.post('/games', {
                ...gameData,
                userId
            })

            setGames(prev => [response.data.game, ...prev])
            return { success: true, game: response.data.game }

        } catch (err) {
            const message = err.response?.data?.message || 'Failed to add game'
            return { success: false, message }
        }
    }

    const updateGame = async (id, updateData) => {
        try {
            const response = await api.put(`/games/${id}`, updateData)
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

    const deleteGame = async (id) => {
        try {
            await api.delete(`/games/${id}`)
            setGames(prev => prev.filter(game => game._id !== id))
            return { success: true }
        } catch (err) {
            const message = err.response?.data?.message || 'Failed to delete game'
            return { success: false, message }
        }
    }

    useEffect(() => {
        fetchGames()
    }, [fetchGames])

    return {
        games,
        loading,
        error,
        fetchGames,
        addGame,
        updateGame,
        deleteGame,
    }
}

export default useGames