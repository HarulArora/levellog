/**
 * MoviesContext — Global movies and TV library state.
 *
 * Problem it solves:
 *   Every page (Home, Detail, Search, Discover, Library) that showed Movies/TV Shows 
 *   independently fetched the library (/movies/library) on mount to show the user's
 *   "ME" rating or current log status. This caused extreme lag on return visits.
 *
 * Solution:
 *   Single fetch, cached in-memory and shared across the entire app.
 *   Optimistic UI updates for add, update, delete for instant responses.
 */
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import api from '../api/axios'
import { useAuth } from './AuthContext'
import { getCache, setCache, invalidateCache, invalidatePrefix } from '../utils/cache'

const MoviesContext = createContext(null)

const CACHE_KEY = 'user_movies'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function MoviesProvider({ children }) {
    const { user, updateUser } = useAuth()

    // Seed state from cache so the UI is instant on return visits
    const { data: cachedMovies, isStale } = getCache(CACHE_KEY)
    const [moviesList, setMoviesList] = useState(cachedMovies ?? [])
    const [loading, setLoading] = useState(!!user && !cachedMovies)
    const [error, setError] = useState(null)

    const doFetch = useCallback(async (silent = false) => {
        if (!user) return
        if (!silent) setLoading(true)
        try {
            const token = localStorage.getItem('questduck_token')
            const res = await api.get('/movies/library', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const fetched = res.data.library || []
            
            // Deduplicate items safely
            const uniqueMap = new Map()
            fetched.forEach(item => {
                const type = item.type || item.mediaType || 'movie'
                const key = item.externalId ? `${type}_ext_${item.externalId}` : `${type}_title_${item.title?.toLowerCase()}`
                const existing = uniqueMap.get(key)
                if (!existing || (!existing.rating && item.rating) || (new Date(item.updatedAt) > new Date(existing.updatedAt))) {
                    uniqueMap.set(key, item)
                }
            })
            const finalMoviesList = Array.from(uniqueMap.values())

            setMoviesList(finalMoviesList)
            setCache(CACHE_KEY, finalMoviesList, CACHE_TTL)
            setError(null)
        } catch (err) {
            console.error('[MoviesContext] fetch error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        if (!user) {
            setMoviesList([])
            setLoading(false)
            invalidateCache(CACHE_KEY)
            return
        }

        const { data: cached, isStale: stale } = getCache(CACHE_KEY)
        if (cached) {
            setMoviesList(cached)
            setLoading(false)
            if (stale) doFetch(true) // Background revalidation
        } else {
            doFetch(false)
        }
    }, [user, doFetch])

    // CRUD — optimistic updates
    const logMovie = useCallback(async (movieData) => {
        const token = localStorage.getItem('questduck_token')
        const previousList = [...moviesList]
        
        // Find if already exists in state
        const type = movieData.type || movieData.mediaType || 'movie'
        const existing = moviesList.find(m => 
            String(m.externalId) === String(movieData.externalId) && 
            (m.type === type || m.mediaType === type)
        )

        // Optimistic state update
        let nextList;
        const tempId = existing ? existing._id : `temp_${Date.now()}`
        const optimisticEntry = {
            ...movieData,
            _id: tempId,
            type,
            updatedAt: new Date().toISOString(),
            createdAt: existing ? existing.createdAt : new Date().toISOString()
        }

        if (existing) {
            nextList = moviesList.map(m => m._id === existing._id ? { ...m, ...optimisticEntry } : m)
        } else {
            nextList = [optimisticEntry, ...moviesList]
        }
        
        setMoviesList(nextList)

        try {
            const res = await api.post('/movies/log', movieData, {
                headers: { Authorization: `Bearer ${token}` }
            })

            const realEntry = res.data.entry
            const final = nextList.map(m => m._id === tempId ? realEntry : m)
            
            setMoviesList(final)
            setCache(CACHE_KEY, final, CACHE_TTL)

            // Background invalidations
            invalidateCache('movie_stats')
            invalidatePrefix('discover_')

            if (res.data.xp) {
                updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
            }

            return { success: true, entry: realEntry }
        } catch (err) {
            console.error('[MoviesContext] logMovie error:', err)
            setMoviesList(previousList) // Rollback
            return { success: false, error: err.message }
        }
    }, [moviesList, updateUser])

    const deleteMovie = useCallback(async (id, title) => {
        const token = localStorage.getItem('questduck_token')
        const previousList = [...moviesList]
        
        // Optimistic delete
        const nextList = moviesList.filter(m => m._id !== id)
        setMoviesList(nextList)

        try {
            const res = await api.delete(`/movies/log/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            setCache(CACHE_KEY, nextList, CACHE_TTL)
            invalidateCache('movie_stats')
            invalidatePrefix('discover_')

            if (res.data.xp !== undefined) {
                updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
            }

            return { success: true }
        } catch (err) {
            console.error('[MoviesContext] deleteMovie error:', err)
            setMoviesList(previousList) // Rollback
            return { success: false, error: err.message }
        }
    }, [moviesList, updateUser])

    const value = useMemo(() => ({
        moviesList,
        loading,
        error,
        fetchMovies: doFetch,
        logMovie,
        deleteMovie
    }), [moviesList, loading, error, doFetch, logMovie, deleteMovie])

    return (
        <MoviesContext.Provider value={value}>
            {children}
        </MoviesContext.Provider>
    )
}

export function useMoviesContext() {
    const ctx = useContext(MoviesContext)
    if (!ctx) throw new Error('useMoviesContext must be used inside MoviesProvider')
    return ctx
}

export default MoviesContext
