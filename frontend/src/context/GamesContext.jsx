/**
 * GamesContext — Global game library state.
 *
 * Problem it solves:
 *   Previously, every page that called useGames() got its OWN copy of state
 *   and made its OWN API call to /games. So Library, Stats, Home, and Activity
 *   all independently fetched the same data on every visit.
 *
 * Solution:
 *   One fetch, shared everywhere. Cache persists for the tab lifetime.
 *   CRUD operations update local state + cache immediately (optimistic) so
 *   the UI feels instant — no refetch needed after add/update/delete.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'
import { getCache, setCache, invalidateCache, invalidatePrefix } from '../utils/cache'

const GamesContext = createContext(null)

const CACHE_KEY = 'user_games'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function GamesProvider({ children }) {
    const { user } = useAuth()

    // Seed state from cache so the UI is instant on return visits
    const { data: cachedGames, isStale } = getCache(CACHE_KEY)
    const [games, setGames] = useState(cachedGames ?? [])
    const [loading, setLoading] = useState(!!user && !cachedGames)
    const [error, setError] = useState(null)

    const doFetch = useCallback(async (silent = false) => {
        if (!user) return
        if (!silent) setLoading(true)
        try {
            const token = localStorage.getItem('questdeck_token')
            const res = await api.get('/games', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const fetched = res.data.games || []
            setGames(fetched)
            setCache(CACHE_KEY, fetched, CACHE_TTL)
            setError(null)
        } catch (err) {
            console.error('[GamesContext] fetch error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        if (!user) {
            // User logged out — clear everything
            setGames([])
            setLoading(false)
            invalidateCache(CACHE_KEY)
            return
        }

        const { data: cached, isStale: stale } = getCache(CACHE_KEY)
        if (cached) {
            setGames(cached)
            setLoading(false)
            if (stale) doFetch(true) // background revalidation
        } else {
            doFetch(false)
        }
    }, [user, doFetch])

    // ── CRUD — update local state + cache immediately ──────────────────────────
    const addGame = useCallback(async (gameData) => {
        const token = localStorage.getItem('questdeck_token')
        try {
            const existing = games.find(
                g => g.title.toLowerCase() === gameData.title.toLowerCase()
            )
            if (existing) {
                // Delegate to updateGame path
                const res = await api.put(`/games/${existing._id}`, gameData, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                const updated = games.map(g => g._id === existing._id ? res.data.game : g)
                setGames(updated)
                setCache(CACHE_KEY, updated, CACHE_TTL)
                return { success: true, game: res.data.game, updated: true }
            }
            const res = await api.post('/games', gameData, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const next = [res.data.game, ...games]
            setGames(next)
            setCache(CACHE_KEY, next, CACHE_TTL)

            // Invalidate community stats caches (ensures avg ratings sync)
            invalidateCache('home_data')
            invalidatePrefix('discover_')
            invalidatePrefix('game_stats_')
            invalidateCache(`activity_${user?.id || user?._id}`)
            invalidateCache(`feed_${user?.id || user?._id}`)
            if (res.data.game?.igdbId) {
                invalidateCache(`game_stats_v2_${res.data.game.igdbId}`)
            }

            return { success: true, game: res.data.game }
        } catch (err) {
            console.error('[GamesContext] addGame error:', err)
            return { success: false, error: err.message }
        }
    }, [games])

    const updateGame = useCallback(async (id, updates) => {
        const token = localStorage.getItem('questdeck_token')
        try {
            const res = await api.put(`/games/${id}`, updates, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const next = games.map(g => g._id === id ? res.data.game : g)
            setGames(next)
            setCache(CACHE_KEY, next, CACHE_TTL)

            // Invalidate community stats caches (ensures avg ratings sync)
            invalidateCache('home_data')
            invalidatePrefix('discover_')
            invalidatePrefix('game_stats_')
            invalidateCache(`activity_${user?.id || user?._id}`)
            invalidateCache(`feed_${user?.id || user?._id}`)
            if (res.data.game?.igdbId) {
                invalidateCache(`game_stats_v2_${res.data.game.igdbId}`)
            }

            return { success: true, game: res.data.game }
        } catch (err) {
            console.error('[GamesContext] updateGame error:', err)
            return { success: false, error: err.message }
        }
    }, [games])

    const deleteGame = useCallback(async (id) => {
        const token = localStorage.getItem('questdeck_token')
        try {
            await api.delete(`/games/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            const next = games.filter(g => g._id !== id)
            setGames(next)
            setCache(CACHE_KEY, next, CACHE_TTL)

            // Invalidate community stats caches (ensures avg ratings sync)
            invalidateCache('home_data')
            invalidatePrefix('discover_')
            invalidatePrefix('game_stats_')

            return { success: true }
        } catch (err) {
            console.error('[GamesContext] deleteGame error:', err)
            return { success: false, error: err.message }
        }
    }, [games])

    const value = useMemo(() => ({
        games,
        loading,
        error,
        fetchGames: doFetch,
        addGame,
        updateGame,
        deleteGame,
    }), [games, loading, error, doFetch, addGame, updateGame, deleteGame])

    return (
        <GamesContext.Provider value={value}>
            {children}
        </GamesContext.Provider>
    )
}

export function useGamesContext() {
    const ctx = useContext(GamesContext)
    if (!ctx) throw new Error('useGamesContext must be used inside GamesProvider')
    return ctx
}

export default GamesContext
