/**
 * AnimeContext — Global anime and manga library state.
 *
 * Problem it solves:
 *   Every page (Home, Detail, Search, Discover, Library) that showed Anime/Manga 
 *   independently fetched the library (/anime/library) on mount to show the user's
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

const AnimeContext = createContext(null)

const CACHE_KEY = 'user_anime'
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export function AnimeProvider({ children }) {
    const { user, updateUser } = useAuth()

    // Seed state from cache so the UI is instant on return visits
    const { data: cachedAnime, isStale } = getCache(CACHE_KEY)
    const [animeList, setAnimeList] = useState(cachedAnime ?? [])
    const [loading, setLoading] = useState(!!user && !cachedAnime)
    const [error, setError] = useState(null)

    const doFetch = useCallback(async (silent = false) => {
        if (!user) return
        if (!silent) setLoading(true)
        try {
            const token = localStorage.getItem('questduck_token')
            const res = await api.get('/anime/library', {
                headers: { Authorization: `Bearer ${token}` }
            })
            const fetched = res.data.library || []
            
            // Deduplicate items safely
            const uniqueMap = new Map()
            fetched.forEach(item => {
                const type = item.type || item.mediaType || 'anime'
                const key = item.externalId ? `${type}_ext_${item.externalId}` : `${type}_title_${item.title?.toLowerCase()}`
                const existing = uniqueMap.get(key)
                if (!existing || (!existing.rating && item.rating) || (new Date(item.updatedAt) > new Date(existing.updatedAt))) {
                    uniqueMap.set(key, item)
                }
            })
            const finalAnimeList = Array.from(uniqueMap.values())

            setAnimeList(finalAnimeList)
            setCache(CACHE_KEY, finalAnimeList, CACHE_TTL)
            setError(null)
        } catch (err) {
            console.error('[AnimeContext] fetch error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => {
        if (!user) {
            setAnimeList([])
            setLoading(false)
            invalidateCache(CACHE_KEY)
            return
        }

        const { data: cached, isStale: stale } = getCache(CACHE_KEY)
        if (cached) {
            setAnimeList(cached)
            setLoading(false)
            if (stale) doFetch(true) // Background revalidation
        } else {
            doFetch(false)
        }
    }, [user, doFetch])

    // CRUD — optimistic updates
    const logAnime = useCallback(async (animeData) => {
        const token = localStorage.getItem('questduck_token')
        const previousList = [...animeList]
        
        // Find if already exists in state
        const type = animeData.type || animeData.mediaType || 'anime'
        const existing = animeList.find(a => 
            String(a.externalId) === String(animeData.externalId) && 
            (a.type === type || a.mediaType === type)
        )

        // Optimistic state update
        let nextList;
        const tempId = existing ? existing._id : `temp_${Date.now()}`
        const optimisticEntry = {
            ...animeData,
            _id: tempId,
            type,
            updatedAt: new Date().toISOString(),
            createdAt: existing ? existing.createdAt : new Date().toISOString()
        }

        if (existing) {
            nextList = animeList.map(a => a._id === existing._id ? { ...a, ...optimisticEntry } : a)
        } else {
            nextList = [optimisticEntry, ...animeList]
        }
        
        setAnimeList(nextList)

        try {
            const res = await api.post('/anime/log', animeData, {
                headers: { Authorization: `Bearer ${token}` }
            })

            const realEntry = res.data.entry
            const final = nextList.map(a => a._id === tempId ? realEntry : a)
            
            setAnimeList(final)
            setCache(CACHE_KEY, final, CACHE_TTL)

            // Background invalidations
            invalidateCache('anime_stats')
            invalidatePrefix('discover_')

            if (res.data.xp) {
                updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
            }

            return { success: true, entry: realEntry }
        } catch (err) {
            console.error('[AnimeContext] logAnime error:', err)
            setAnimeList(previousList) // Rollback
            return { success: false, error: err.message }
        }
    }, [animeList, updateUser])

    const deleteAnime = useCallback(async (id, title) => {
        const token = localStorage.getItem('questduck_token')
        const previousList = [...animeList]
        
        // Optimistic delete
        const nextList = animeList.filter(a => a._id !== id)
        setAnimeList(nextList)

        try {
            const res = await api.delete(`/anime/log/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            setCache(CACHE_KEY, nextList, CACHE_TTL)
            invalidateCache('anime_stats')
            invalidatePrefix('discover_')

            if (res.data.xp !== undefined) {
                updateUser({ xp: res.data.xp, level: res.data.level, badge: res.data.badge })
            }

            return { success: true }
        } catch (err) {
            console.error('[AnimeContext] deleteAnime error:', err)
            setAnimeList(previousList) // Rollback
            return { success: false, error: err.message }
        }
    }, [animeList, updateUser])

    const value = useMemo(() => ({
        animeList,
        loading,
        error,
        fetchAnime: doFetch,
        logAnime,
        deleteAnime
    }), [animeList, loading, error, doFetch, logAnime, deleteAnime])

    return (
        <AnimeContext.Provider value={value}>
            {children}
        </AnimeContext.Provider>
    )
}

export function useAnimeContext() {
    const ctx = useContext(AnimeContext)
    if (!ctx) throw new Error('useAnimeContext must be used inside AnimeProvider')
    return ctx
}

export default AnimeContext
