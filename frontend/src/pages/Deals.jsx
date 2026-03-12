import { useState, useEffect, useRef, useCallback } from 'react'

const AFF = {
    gog: '',
    fanatical: '',
    epic: '',
    gmg: '',
    awin: '',
}

function buildStoreUrl(storeID, steamAppID, title) {
    const id = String(storeID)
    const q = encodeURIComponent(title)
    switch (id) {
        case '1': {
            const base = steamAppID
                ? `https://store.steampowered.com/app/${steamAppID}/`
                : `https://store.steampowered.com/search/?term=${q}`
            return AFF.awin
                ? `https://www.awin1.com/cread.php?awinmid=7025&awinaffid=${AFF.awin}&ued=${encodeURIComponent(base)}`
                : base
        }
        case '7': {
            const base = `https://www.gog.com/en/games?search=${q}`
            return AFF.gog ? `${base}&pp=${AFF.gog}` : base
        }
        case '11': return `https://www.humblebundle.com/store/search?search=${q}`
        case '15': {
            const base = `https://www.fanatical.com/en/search?search=${q}`
            return AFF.fanatical ? `${base}&aff_id=${AFF.fanatical}` : base
        }
        case '3': {
            const base = `https://www.greenmangaming.com/search/?query=${q}`
            return AFF.gmg ? `${base}&affil=${AFF.gmg}` : base
        }
        case '25': {
            const base = `https://store.epicgames.com/en-US/browse?q=${q}`
            return AFF.epic ? `${base}&epic_creator_id=${AFF.epic}` : base
        }
        case '35': return `https://store.indiegala.com/search#${q}`
        case '21': return `https://www.wingamestore.com/search/?SearchQuery=${q}`
        default: return `https://store.steampowered.com/search/?term=${q}`
    }
}

const STORE_META = {
    '1': { name: 'Steam', color: '#1b9fe0', icon: '🟦' },
    '7': { name: 'GOG', color: '#a855f7', icon: '🟣' },
    '11': { name: 'Humble', color: '#e05c1b', icon: '🔴' },
    '15': { name: 'Fanatical', color: '#e01b1b', icon: '🔴' },
    '3': { name: 'GMG', color: '#00c06e', icon: '🟢' },
    '25': { name: 'Epic', color: '#9ca3af', icon: '⬛' },
    '35': { name: 'IndieGala', color: '#f5a623', icon: '🟡' },
    '21': { name: 'WinGameStore', color: '#5c9fff', icon: '🔵' },
    '13': { name: 'IGS', color: '#888', icon: '⬜' },
    '6': { name: 'GamersGate', color: '#c8a0ff', icon: '🟣' },
    '8': { name: 'GameBillet', color: '#5c9fff', icon: '🔵' },
}

const FILTER_STORES = [
    { key: 'all', label: 'All Stores' },
    { key: '1', label: '🟦 Steam' },
    { key: '25', label: '⬛ Epic' },
    { key: '7', label: '🟣 GOG' },
    { key: '11', label: '🔴 Humble' },
    { key: '15', label: '🔴 Fanatical' },
    { key: '3', label: '🟢 GMG' },
    { key: '35', label: '🟡 IndieGala' },
    { key: '21', label: '🔵 WinGameStore' },
    { key: '6', label: '🟣 GamersGate' },
    { key: '8', label: '🔵 GameBillet' },
    { key: '13', label: '⬜ IGS' },
]

const DEALS_PER_PAGE = 30
const ALL_STORE_IDS = ['1', '7', '11', '15', '3', '25', '35', '21', '6', '8', '13']

const PROXY_LIST = [
    (url) => fetch(`https://corsproxy.io/?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(7000) }),
    async (url) => {
        const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(7000) })
        if (!res.ok) throw new Error(`allorigins ${res.status}`)
        const { contents } = await res.json()
        return new Response(contents, { headers: { 'Content-Type': 'application/json' } })
    },
    (url) => fetch(`https://thingproxy.freeboard.io/fetch/${url}`, { signal: AbortSignal.timeout(7000) }),
    (url) => fetch(`https://cors-proxy.htmldriven.com/?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(7000) }),
    (url) => fetch(url, { signal: AbortSignal.timeout(8000) }),
]

async function fetchWithProxies(targetUrl) {
    let lastErr
    for (const proxyFn of PROXY_LIST) {
        try {
            const res = await proxyFn(targetUrl)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const json = await res.json()
            return json
        } catch (e) {
            lastErr = e
        }
    }
    throw lastErr || new Error('All proxies failed')
}

async function fetchWithDelay(urls, delayMs = 300) {
    const results = []
    for (const url of urls) {
        try {
            let json
            try {
                const res = await fetch(url.replace(/^https:\/\/corsproxy\.io\/\?url=/, '').replace(/^[^?]*\?url=/, ''), { signal: AbortSignal.timeout(6000) })
                if (!res.ok) throw new Error(`direct ${res.status}`)
                json = await res.json()
            } catch {
                const target = (() => {
                    try { return decodeURIComponent(url.split('?url=')[1] || url) } catch { return url }
                })()
                json = await fetchWithProxies(target)
            }
            results.push(json)
        } catch {
            results.push(null)
        }
        if (delayMs) await new Promise(r => setTimeout(r, delayMs))
    }
    return results
}

function mcColor(n) {
    if (n >= 75) return '#c8ff57'
    if (n >= 50) return '#5c9fff'
    return '#ff5c5c'
}

function DealSkeleton() {
    return (
        <div style={{
            display: 'flex', background: '#111118',
            border: '1px solid #2a2a35', borderRadius: 8,
            overflow: 'hidden', height: 92, animation: 'pulse 1.5s ease-in-out infinite',
        }}>
            <div style={{ width: 100, background: '#18181f', flexShrink: 0 }} />
            <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ height: 9, background: '#18181f', borderRadius: 3, width: '35%' }} />
                <div style={{ height: 12, background: '#18181f', borderRadius: 3, width: '65%' }} />
                <div style={{ height: 18, background: '#18181f', borderRadius: 3, width: '22%' }} />
            </div>
        </div>
    )
}

function DealCard({ deal }) {
    const store = STORE_META[deal.storeID] || { name: 'Store', color: '#888', icon: '🛒' }
    const normal = parseFloat(deal.normalPrice)
    const sale = parseFloat(deal.salePrice)
    const isFree = sale === 0
    const savings = Math.trunc(parseFloat(deal.savings))
    const mc = parseInt(deal.metacriticScore)
    const url = buildStoreUrl(deal.storeID, deal.steamAppID, deal.title)
    const hasDiscount = savings > 0 && normal > sale

    return (
        <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', textDecoration: 'none', color: 'inherit', background: '#111118', border: `1px solid ${isFree ? 'rgba(200,255,87,0.25)' : '#2a2a35'}`, borderRadius: 8, overflow: 'hidden', transition: 'all 0.18s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.transform = 'translateX(3px)'; e.currentTarget.style.background = '#13131c' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = isFree ? 'rgba(200,255,87,0.25)' : '#2a2a35'; e.currentTarget.style.transform = 'translateX(0)'; e.currentTarget.style.background = '#111118' }}
        >
            <div style={{ width: 100, flexShrink: 0, background: '#18181f', position: 'relative', overflow: 'hidden' }}>
                {deal.thumb
                    ? <img src={deal.thumb} alt={deal.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, color: '#2a2a35' }}>🎮</div>
                }
                {(hasDiscount || isFree) && (
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: isFree ? '#c8ff57' : 'rgba(255,50,50,0.93)', color: isFree ? '#000' : '#fff', fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 11, textAlign: 'center', padding: '3px 0' }}>
                        {isFree ? 'FREE' : `-${savings}%`}
                    </div>
                )}
            </div>
            <div style={{ padding: '9px 12px', flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: store.color, letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>{store.icon} {store.name}</div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, color: '#e8e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>{deal.title}</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    {hasDiscount && !isFree && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#7a7a90', textDecoration: 'line-through' }}>${normal.toFixed(2)}</span>}
                    <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, letterSpacing: 1, lineHeight: 1, color: isFree ? '#c8ff57' : '#3dffb0' }}>
                        {isFree ? 'FREE' : `$${sale.toFixed(2)}`}
                    </span>
                    {!hasDiscount && !isFree && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#3a3a4a' }}>no discount</span>}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    {mc > 0 && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: mcColor(mc), border: `1px solid ${mcColor(mc)}44`, padding: '1px 5px', borderRadius: 2 }}>MC {mc}</span>}
                    {deal.steamRatingText && deal.steamRatingText !== 'Na' && deal.steamRatingText !== 'N/A' && (
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: '#7a7a90' }}>{deal.steamRatingText} ({deal.steamRatingPercent}%)</span>
                    )}
                </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingRight: 10, color: '#3a3a4a', fontSize: 14, flexShrink: 0 }}>→</div>
        </a>
    )
}

function NewDealsBanner({ deals, onDismiss }) {
    if (!deals.length) return null
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(61,255,176,0.05)', border: '1px solid rgba(61,255,176,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#3dffb0', flexShrink: 0, boxShadow: '0 0 8px #3dffb0' }} />
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#3dffb0', fontWeight: 700 }}>🎉 {deals.length} NEW DEAL{deals.length > 1 ? 'S' : ''} DETECTED</span>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#7a7a90' }}>
                {deals.slice(0, 3).map(d => d.title).join(' · ')}{deals.length > 3 ? ` +${deals.length - 3} more` : ''}
            </span>
            <button onClick={onDismiss} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#7a7a90', cursor: 'pointer', fontSize: 14 }}>✕</button>
        </div>
    )
}

function Pagination({ page, totalPages, onPage }) {
    if (totalPages <= 1) return null
    const visible = []
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) visible.push(i)
    }
    const btnBase = { padding: '6px 14px', borderRadius: 4, background: 'transparent', fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: 'pointer', transition: 'all 0.15s' }
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 36, flexWrap: 'wrap' }}>
            <button onClick={() => onPage(page - 1)} disabled={page === 1}
                style={{ ...btnBase, border: '1px solid #2a2a35', color: page === 1 ? '#3a3a4a' : '#7a7a90', cursor: page === 1 ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (page !== 1) { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.color = '#c8ff57' } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.color = page === 1 ? '#3a3a4a' : '#7a7a90' }}
            >← Prev</button>
            {visible.map((n, i) => {
                const gap = visible[i - 1] && n - visible[i - 1] > 1
                return (
                    <span key={n} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {gap && <span style={{ color: '#3a3a4a', fontSize: 13 }}>…</span>}
                        <button onClick={() => onPage(n)}
                            style={{ width: 34, height: 34, borderRadius: 4, cursor: 'pointer', transition: 'all 0.15s', border: `1px solid ${n === page ? '#c8ff57' : '#2a2a35'}`, background: n === page ? 'rgba(200,255,87,0.08)' : 'transparent', color: n === page ? '#c8ff57' : '#7a7a90', fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: n === page ? 700 : 400 }}
                            onMouseEnter={e => { if (n !== page) { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.color = '#c8ff57' } }}
                            onMouseLeave={e => { if (n !== page) { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.color = '#7a7a90' } }}
                        >{n}</button>
                    </span>
                )
            })}
            <button onClick={() => onPage(page + 1)} disabled={page === totalPages}
                style={{ ...btnBase, border: '1px solid #2a2a35', color: page === totalPages ? '#3a3a4a' : '#7a7a90', cursor: page === totalPages ? 'not-allowed' : 'pointer' }}
                onMouseEnter={e => { if (page !== totalPages) { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.color = '#c8ff57' } }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.color = page === totalPages ? '#3a3a4a' : '#7a7a90' }}
            >Next →</button>
        </div>
    )
}

export default function Deals() {
    const [deals, setDeals] = useState([])
    const [dealsLoading, setDealsLoading] = useState(true)
    const [storeFilter, setStoreFilter] = useState('all')
    const [freeOnly, setFreeOnly] = useState(false)
    const [search, setSearch] = useState('')
    const [page, setPage] = useState(1)
    const [lastUpdated, setLastUpdated] = useState(null)
    const [newDeals, setNewDeals] = useState([])
    const [fetchStatus, setFetchStatus] = useState('')
    const prevIds = useRef(new Set())

    const fetchDeals = useCallback(async () => {
        try {
            setDealsLoading(true)
            setFetchStatus('Fetching deals...')
            let data = []

            if (storeFilter === 'all') {
                const urls = ALL_STORE_IDS.map(id => {
                    const p = new URLSearchParams({ pageSize: 60, sortBy: 'Savings', desc: 1, onSale: 1, storeID: id, pageNumber: 0 })
                    if (freeOnly) p.append('upperPrice', '0')
                    return `https://www.cheapshark.com/api/1.0/deals?${p}`
                })

                setFetchStatus('Loading deals from all stores...')
                const results = await fetchWithDelay(urls, 150)
                for (const r of results) {
                    if (Array.isArray(r)) data = data.concat(r)
                }
            } else {
                const urls = [0, 1].map(pageNum => {
                    const p = new URLSearchParams({ pageSize: 60, sortBy: 'Savings', desc: 1, onSale: 1, storeID: storeFilter, pageNumber: pageNum })
                    if (freeOnly) p.append('upperPrice', '0')
                    return `https://www.cheapshark.com/api/1.0/deals?${p}`
                })

                setFetchStatus('Loading deals...')
                const results = await fetchWithDelay(urls, 200)
                for (const r of results) {
                    if (Array.isArray(r)) data = data.concat(r)
                }
            }

            const seen = new Set()
            data = data.filter(d => {
                if (!d?.dealID || seen.has(d.dealID)) return false
                seen.add(d.dealID)
                return true
            })

            data.sort((a, b) => parseFloat(b.savings) - parseFloat(a.savings))

            const cleaned = data.filter(d => {
                const sale = parseFloat(d.salePrice)
                const normal = parseFloat(d.normalPrice)
                const pct = Math.trunc(parseFloat(d.savings))
                return sale === 0 || (pct > 0 && normal > sale)
            })

            const fresh = cleaned.filter(d => prevIds.current.size > 0 && !prevIds.current.has(d.dealID))
            prevIds.current = new Set(cleaned.map(d => d.dealID))

            if (fresh.length > 0) {
                setNewDeals(fresh.slice(0, 10))
                window.dispatchEvent(new CustomEvent('levellog:new-deals', { detail: { count: fresh.length } }))
                if (Notification?.permission === 'granted') {
                    new Notification('🎮 New LevelLog Deals!', {
                        body: `${fresh.length} new deal${fresh.length > 1 ? 's' : ''}: ${fresh.slice(0, 2).map(d => d.title).join(', ')}`,
                        icon: '/favicon.ico',
                    })
                }
            }

            setDeals(cleaned)
            setLastUpdated(new Date())
            setFetchStatus('')
        } catch (err) {
            setFetchStatus('Failed to load deals')
            console.error(err)
        } finally {
            setDealsLoading(false)
        }
    }, [storeFilter, freeOnly])

    useEffect(() => {
        setPage(1)
        fetchDeals()
    }, [fetchDeals])

    useEffect(() => {
        const t = setInterval(() => { fetchDeals() }, 5 * 60 * 1000)
        return () => clearInterval(t)
    }, [fetchDeals])

    useEffect(() => {
        if ('Notification' in window && Notification.permission === 'default')
            Notification.requestPermission()
    }, [])

    const filtered = deals.filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()))
    const totalPages = Math.ceil(filtered.length / DEALS_PER_PAGE)
    const paginated = filtered.slice((page - 1) * DEALS_PER_PAGE, page * DEALS_PER_PAGE)

    const handlePage = (n) => { setPage(n) }
    const handleStoreFilter = (k) => { setStoreFilter(k); setPage(1) }
    const handleFreeOnly = () => { setFreeOnly(f => !f); setPage(1) }

    return (
        <div style={{ color: '#e8e8f0', minHeight: '100vh' }}>
            <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        .deals-wrap { max-width: 1200px; margin: 0 auto; padding: 40px 40px 60px; }
        @media (max-width: 768px) { .deals-wrap { padding: 20px 16px 40px; } }
        .deals-grid { display: grid; gap: 10px; grid-template-columns: 1fr; }
        @media (min-width: 640px)  { .deals-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; } }
        @media (min-width: 1024px) { .deals-grid { grid-template-columns: repeat(3, 1fr); gap: 14px; } }
        .filter-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .sec-title { font-family: 'Bebas Neue', sans-serif; font-size: 26px; letter-spacing: 3px; margin: 0; color: #e8e8f0; }
        .sec-head { display: flex; align-items: baseline; gap: 14px; margin-bottom: 20px; padding-bottom: 14px; border-bottom: 1px solid #2a2a35; flex-wrap: wrap; }
        .pill { padding: 5px 13px; border-radius: 4px; cursor: pointer; font-family: 'DM Mono', monospace; font-size: 11px; transition: all 0.15s; background: transparent; line-height: 1.4; }
      `}</style>

            <div className="deals-wrap">

                <div className="sec-head" style={{ marginBottom: 24 }}>
                    <h1 className="sec-title">🔥 GAME DEALS</h1>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#7a7a90' }}>
                        {dealsLoading ? (fetchStatus || 'Loading...') : `${filtered.length} deals found`}
                    </span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
                        {lastUpdated && (
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#7a7a90' }}>
                                🔄 {lastUpdated.toLocaleTimeString()}
                            </span>
                        )}
                        <button
                            onClick={() => fetchDeals()}
                            className="pill"
                            style={{ border: '1px solid #2a2a35', color: '#7a7a90' }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = '#c8ff57'; e.currentTarget.style.color = '#c8ff57' }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a35'; e.currentTarget.style.color = '#7a7a90' }}
                        >↻ Refresh</button>
                    </div>
                </div>

                <NewDealsBanner deals={newDeals} onDismiss={() => setNewDeals([])} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                    <div className="filter-row">
                        {FILTER_STORES.map(s => (
                            <button key={s.key} onClick={() => handleStoreFilter(s.key)} className="pill"
                                style={{ border: `1px solid ${storeFilter === s.key ? '#3dffb0' : '#2a2a35'}`, background: storeFilter === s.key ? 'rgba(61,255,176,0.06)' : 'transparent', color: storeFilter === s.key ? '#3dffb0' : '#7a7a90' }}>
                                {s.label}
                            </button>
                        ))}
                    </div>
                    <div className="filter-row">
                        <button onClick={handleFreeOnly} className="pill"
                            style={{ border: `1px solid ${freeOnly ? '#c8ff57' : '#2a2a35'}`, background: freeOnly ? 'rgba(200,255,87,0.06)' : 'transparent', color: freeOnly ? '#c8ff57' : '#7a7a90' }}>
                            🎁 Free Only
                        </button>
                        <div style={{ marginLeft: 'auto', position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#7a7a90' }}>🔍</span>
                            <input type="text" placeholder="Search deals..." value={search}
                                onChange={e => { setSearch(e.target.value); setPage(1) }}
                                style={{ background: '#111118', border: '1px solid #2a2a35', borderRadius: 4, padding: '6px 10px 6px 28px', color: '#e8e8f0', fontFamily: "'DM Sans', sans-serif", fontSize: 13, width: 180, outline: 'none', transition: 'border-color 0.15s' }}
                                onFocus={e => e.target.style.borderColor = '#c8ff57'}
                                onBlur={e => e.target.style.borderColor = '#2a2a35'}
                            />
                        </div>
                    </div>
                </div>

                {dealsLoading ? (
                    <>
                        {fetchStatus && (
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: '#7a7a90', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ animation: 'pulse 1s infinite' }}>⏳</span> {fetchStatus}
                            </div>
                        )}
                        <div className="deals-grid">
                            {Array.from({ length: 12 }).map((_, i) => <DealSkeleton key={i} />)}
                        </div>
                    </>
                ) : paginated.length > 0 ? (
                    <>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#5a5a6a', marginBottom: 14 }}>
                            Showing {(page - 1) * DEALS_PER_PAGE + 1}–{Math.min(page * DEALS_PER_PAGE, filtered.length)} of {filtered.length} deals
                        </div>
                        <div className="deals-grid">
                            {paginated.map(deal => <DealCard key={deal.dealID} deal={deal} />)}
                        </div>
                        <Pagination page={page} totalPages={totalPages} onPage={handlePage} />
                    </>
                ) : (
                    <div style={{ textAlign: 'center', padding: '48px 0', color: '#7a7a90', fontFamily: "'DM Mono', monospace", fontSize: 12, background: '#111118', border: '1px solid #2a2a35', borderRadius: 8 }}>
                        No deals found — try a different filter or{' '}
                        <button onClick={() => { setStoreFilter('all'); setFreeOnly(false); setSearch('') }}
                            style={{ background: 'none', border: 'none', color: '#c8ff57', cursor: 'pointer', fontFamily: "'DM Mono', monospace", fontSize: 12 }}>
                            clear filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}