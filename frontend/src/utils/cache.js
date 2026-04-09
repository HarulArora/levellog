/**
 * Module-level in-memory cache.
 * Because this is a plain JS module (not React state), it SURVIVES component
 * unmounts. Data fetched on page A is still here when the user comes back to
 * page A — zero refetch, zero loading spinner after the first visit.
 *
 * Strategy: stale-while-revalidate
 *   • First visit  → fetch, show skeleton, populate cache
 *   • Return visit → serve cache instantly, revalidate in background if stale
 */

const store = new Map()

// How long until a cache entry is considered stale (background refresh kicks in)
const DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

export function getCache(key) {
    const entry = store.get(key)
    if (!entry) return { data: null, isStale: true }
    const isStale = Date.now() - entry.ts > (entry.ttl ?? DEFAULT_TTL)
    return { data: entry.data, isStale }
}

export function setCache(key, data, ttl = DEFAULT_TTL) {
    store.set(key, { data, ts: Date.now(), ttl })
}

export function invalidateCache(key) {
    store.delete(key)
}

export function invalidatePrefix(prefix) {
    for (const key of store.keys()) {
        if (key.startsWith(prefix)) store.delete(key)
    }
}
