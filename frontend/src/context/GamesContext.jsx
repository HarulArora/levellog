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
    const { user, updateUser } = useAuth()

    // Seed state from cache so the UI is instant on return visits
    const { data: cachedGames, isStale } = getCache(CACHE_KEY)
    const [games, setGames] = useState(cachedGames ?? [])
    const [loading, setLoading] = useState(!!user && !cachedGames)
    const [error, setError] = useState(null)

    const doFetch = useCallback(async (silent = false) => {
        if (!user) return
        if (!silent) setLoading(true)
        try {
            const token = localStorage.getItem('questduck_token')
            const res = await api.get('/games', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const fetched = res.data.games || []
            
            // 🛡️ Final Deduplication Safety Layer
            const uniqueMap = new Map()
            fetched.forEach(g => {
                const type = g.type || g.mediaType || 'game'
                const key = g.igdbId ? `${type}_ext_${g.igdbId}` : `${type}_title_${g.title?.toLowerCase()}`
                const existing = uniqueMap.get(key)
                if (!existing || (!existing.rating && g.rating) || (new Date(g.updatedAt) > new Date(existing.updatedAt))) {
                    uniqueMap.set(key, g)
                }
            })
            const finalGames = Array.from(uniqueMap.values())

            setGames(finalGames)
            setCache(CACHE_KEY, finalGames, CACHE_TTL)
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
    const updateGame = useCallback(async (id, updates) => {
        const token = localStorage.getItem('questduck_token')
        const previousGames = [...games]
        
        try {
            // OPTIMISTIC UPDATE
            const next = games.map(g => g._id === id ? { ...g, ...updates } : g)
            setGames(next)

            const res = await api.put(`/games/${id}`, updates, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            // Sync with final server state
            const final = games.map(g => g._id === id ? res.data.game : g)
            setGames(final)
            setCache(CACHE_KEY, final, CACHE_TTL)

            // Background invalidations
            invalidateCache('home_data')
            invalidatePrefix('discover_')
            invalidatePrefix('game_stats_')
            invalidateCache(`activity_${user?.id || user?._id}`)
            invalidateCache(`feed_${user?.id || user?._id}`)
            if (res.data.game?.igdbId) {
                invalidateCache(`game_stats_v2_${res.data.game.igdbId}`)
            }

            if (res.data.xp) {
                updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
            }

            return { success: true, game: res.data.game }
        } catch (err) {
            console.error('[GamesContext] updateGame error:', err)
            setGames(previousGames) // Rollback
            return { success: false, error: err.message }
        }
    }, [games, user])

    const addGame = useCallback(async (gameData) => {
        const token = localStorage.getItem('questduck_token')
        const previousGames = [...games]
        
        // Check if updating existing instead of adding new
        const existing = games.find(g => {
            const searchId = Number(gameData.igdbId)
            const entryId = Number(g.igdbId)
            if (searchId && entryId) return searchId === entryId
            if (searchId || entryId) return false
            return g.title?.toLowerCase() === gameData.title?.toLowerCase()
        })

        if (existing) {
            return updateGame(existing._id, gameData)
        }

        // OPTIMISTIC ADD
        const tempId = `temp_${Date.now()}`
        const optimisticGame = {
            ...gameData,
            _id: tempId,
            createdAt: new Date().toISOString(),
            status: gameData.status || 'planned'
        }
        
        const next = [optimisticGame, ...games]
        setGames(next)

        try {
            const res = await api.post('/games', gameData, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            // Replace temp with REAL data
            const final = next.map(g => g._id === tempId ? res.data.game : g)
            setGames(final)
            setCache(CACHE_KEY, final, CACHE_TTL)

            // Background invalidations
            invalidateCache('home_data')
            invalidatePrefix('discover_')
            invalidatePrefix('game_stats_')
            invalidateCache(`activity_${user?.id || user?._id}`)
            invalidateCache(`feed_${user?.id || user?._id}`)
            if (res.data.game?.igdbId) {
                invalidateCache(`game_stats_v2_${res.data.game.igdbId}`)
            }

            if (res.data.xp) {
                updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
            }

            return { success: true, game: res.data.game }
        } catch (err) {
            console.error('[GamesContext] addGame error:', err)
            setGames(previousGames) // Rollback
            return { success: false, error: err.message }
        }
    }, [games, updateGame, user])

    const deleteGame = useCallback(async (id) => {
        const token = localStorage.getItem('questduck_token')
        const previousGames = [...games] // Backup for rollback
        try {
            // Optimistic update
            const next = games.filter(g => g._id !== id)
            setGames(next)

            // Asynchronous backend call
            api.delete(`/games/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            }).then((res) => {
                setCache(CACHE_KEY, next, CACHE_TTL)
                // Invalidate community stats caches
                invalidateCache('home_data')
                invalidatePrefix('discover_')
                invalidatePrefix('game_stats_')
                
                if (res.data.xp) {
                    updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
                }
            }).catch(err => {
                console.error('[GamesContext] lazy delete error:', err)
                setGames(previousGames) // Rollback on failure
            })

            return { success: true }
        } catch (err) {
            console.error('[GamesContext] deleteGame error:', err)
            setGames(previousGames) // Rollback on error
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
