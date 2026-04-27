import { useState, useEffect, useRef, useCallback } from 'react'
import api from '../api/axios'
import { getCache, setCache } from '../utils/cache'

/**
 * useCachedFetch — stale-while-revalidate data fetching hook.
 *
 * Behaviour:
 *  • If cache is FRESH  → return data instantly, no request made.
 *  • If cache is STALE  → return cached data instantly AND revalidate in background.
 *  • If cache is EMPTY  → loading=true until first response, then cache it.
 *
 * @param {string}   cacheKey   Unique key for this data in the module-level cache
 * @param {string}   url        API endpoint to fetch (supports null to disable)
 * @param {object}   options
 *   @param {number}   ttl        Cache lifetime in ms (default 5 min)
 *   @param {boolean}  enabled    Set false to skip fetch (e.g. user not logged in)
 *   @param {*}        deps       Extra dependency array items that should re-trigger fetch
 */
export default function useCachedFetch(cacheKey, url, options = {}) {
    const { ttl, enabled = true, deps = [] } = options

    const { data: cachedData, isStale } = getCache(cacheKey)

    const [data, setData] = useState(cachedData)
    // Only show loading spinner when there's NOTHING cached yet
    const [loading, setLoading] = useState(enabled && !cachedData)
    const [error, setError] = useState(null)

    // Prevent duplicate in-flight requests
    const fetchingRef = useRef(false)

    const fetchFn = useCallback(async (silent = false) => {
        if (!url || !enabled) return
        if (fetchingRef.current) return
        fetchingRef.current = true

        if (!silent && !data) setLoading(true)

        try {
            const res = await api.get(url)
            const result = res.data
            setData(result)
            setCache(cacheKey, result, ttl)
            setError(null)
        } catch (err) {
            console.error(`[cache] fetch error for ${cacheKey}:`, err)
            setError(err)
        } finally {
            setLoading(false)
            fetchingRef.current = false
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cacheKey, url, enabled, ttl, ...deps])

    useEffect(() => {
        if (cachedData) {
            setData(cachedData)
            setLoading(false)
            setError(null)
        } else {
            setData(null)
            setLoading(enabled)
            setError(null)
        }
    }, [cacheKey, cachedData, enabled])

    useEffect(() => {
        if (!enabled) {
            setLoading(false)
            return
        }

        if (!cachedData) {
            // Nothing cached — full fetch with loading spinner
            fetchFn(false)
        } else if (isStale) {
            // Stale data — show cached immediately, refresh silently in background
            fetchFn(true)
        }
        // Fresh cache → do nothing, data already set from useState initializer
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, cacheKey, ...deps])

    return { data, loading, error, refetch: (silent = false) => fetchFn(silent), setData }
}
