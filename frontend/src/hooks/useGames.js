import { useState, useEffect } from 'react'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

const useGames = () => {

  const { user } = useAuth()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchGames = async () => {
    // If not logged in — clear games and stop
    if (!user) {
      setGames([])
      return
    }

    try {
      setLoading(true)
      setError(null)

      const token = localStorage.getItem('levellog_token')
      const res = await api.get('/games', {
        headers: { Authorization: `Bearer ${token}` }
      })

      setGames(res.data.games || [])
    } catch (err) {
      console.error('Fetch games error:', err)
      setError(err.message)
      setGames([])
    } finally {
      setLoading(false)
    }
  }

  // Fetch games whenever user changes (login/logout)
  useEffect(() => {
    if (user) {
      fetchGames()
    } else {
      // User logged out — immediately clear games
      setGames([])
    }
  }, [user])

  const addGame = async (gameData) => {
    try {
      const token = localStorage.getItem('levellog_token')
      const res = await api.post('/games', gameData, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setGames(prev => [res.data.game, ...prev])
      return { success: true, game: res.data.game }
    } catch (err) {
      console.error('Add game error:', err)
      return { success: false, error: err.message }
    }
  }

  const updateGame = async (id, updates) => {
    try {
      const token = localStorage.getItem('levellog_token')
      const res = await api.put(`/games/${id}`, updates, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setGames(prev =>
        prev.map(g => g._id === id ? res.data.game : g)
      )
      return { success: true, game: res.data.game }
    } catch (err) {
      console.error('Update game error:', err)
      return { success: false, error: err.message }
    }
  }

  const deleteGame = async (id) => {
    try {
      const token = localStorage.getItem('levellog_token')
      await api.delete(`/games/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      setGames(prev => prev.filter(g => g._id !== id))
      return { success: true }
    } catch (err) {
      console.error('Delete game error:', err)
      return { success: false, error: err.message }
    }
  }

  return { games, loading, error, fetchGames, addGame, updateGame, deleteGame }
}

export default useGames
