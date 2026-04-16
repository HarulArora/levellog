import express from 'express'
import { LRUCache } from 'lru-cache'
import axios from 'axios'

import { z } from 'zod'
import logger from '../utils/logger.js'

const router = express.Router()

const cache = new LRUCache({
    max: 100, // accommodate different queries
    ttl: 1000 * 60 * 60, // 60 mins cache (Industry standard for external deals)
})

// 🚀 Industry Standard: In-flight request tracking to prevent Cache Stampede
const inFlightRequests = new Map()

// 🚀 Global Pacer: Absolute protection against rate limiting
let globalLastFetch = 0
const GLOBAL_PACE_MS = 2000 // Max 1 request every 2 seconds across ALL users
let isCoolingDown = false

const ALL_STORE_IDS = ['1', '7', '11', '15', '3', '25', '35', '21', '6', '8', '13']

// 🎨 Premium Fallback for "Startup Readiness" - ensures page never looks empty
const MOCK_FALLBACK_DEALS = [
    { title: "Elden Ring", salePrice: "35.99", normalPrice: "59.99", savings: "40", thumb: "https://shared.fastly.steamstatic.com/store_apps/1245620/header.jpg", dealID: "mock1" },
    { title: "Cyberpunk 2077", salePrice: "29.99", normalPrice: "59.99", savings: "50", thumb: "https://shared.fastly.steamstatic.com/store_apps/1091500/header.jpg", dealID: "mock2" },
    { title: "Hades II", salePrice: "24.99", normalPrice: "29.99", savings: "17", thumb: "https://shared.fastly.steamstatic.com/store_apps/1145350/header.jpg", dealID: "mock3" },
    { title: "Stardew Valley", salePrice: "8.99", normalPrice: "14.99", savings: "40", thumb: "https://shared.fastly.steamstatic.com/store_apps/413150/header.jpg", dealID: "mock4" },
    { title: "Baldur's Gate 3", salePrice: "53.99", normalPrice: "59.99", savings: "10", thumb: "https://shared.fastly.steamstatic.com/store_apps/1086940/header.jpg", dealID: "mock5" },
    { title: "The Witcher 3: Wild Hunt", salePrice: "9.99", normalPrice: "39.99", savings: "75", thumb: "https://shared.fastly.steamstatic.com/store_apps/292030/header.jpg", dealID: "mock6" }
]

const dealsQuerySchema = z.object({
    storeFilter: z.string().optional().default('all'),
    freeOnly: z.enum(['true', 'false']).optional().default('false')
})

router.get('/', async (req, res) => {
    try {
        const validated = dealsQuerySchema.parse(req.query)
        const { storeFilter, freeOnly } = validated
        const isFree = freeOnly === 'true'
        
        const cacheKey = `${storeFilter}-${isFree}`
        
        // 1. Check persistent cache
        if (cache.has(cacheKey)) {
            return res.json({ success: true, deals: cache.get(cacheKey) })
        }

        // 2. Check for identical request already in progress
        if (inFlightRequests.has(cacheKey)) {
            const data = await inFlightRequests.get(cacheKey)
            return res.json({ success: true, deals: data })
        }

        // 3. Define the fetcher with a promise tracker
        const performFetch = async () => {
            if (isCoolingDown) {
                logger.warn('Deals API is cooling down. Serving fallback.')
                return MOCK_FALLBACK_DEALS
            }

            // Global Pacing
            const now = Date.now()
            const timeSinceLast = now - globalLastFetch
            if (timeSinceLast < GLOBAL_PACE_MS) {
                await new Promise(r => setTimeout(r, GLOBAL_PACE_MS - timeSinceLast))
            }
            globalLastFetch = Date.now()

            const stores = storeFilter === 'all' ? '' : storeFilter
            
            // Minimalist URL - avoiding all non-essential params
            const p = new URLSearchParams()
            p.append('onSale', '1')
            if (stores) p.append('storeID', stores)
            if (isFree) p.append('upperPrice', '0')
            
            const url = `https://www.cheapshark.com/api/1.0/deals?${p.toString()}`

            try {
                const r = await axios.get(url, { headers: { 'User-Agent': 'QuestDuck/1.4', 'Accept': 'application/json' } })
                const data = r.data || []
                
                // Success - keep coolingDown false
                isCoolingDown = false 
                
                const seen = new Set()
                const unique = data.filter(d => {
                    if (!d?.dealID || seen.has(d.dealID)) return false
                    seen.add(d.dealID)
                    return true
                })

                unique.sort((a, b) => parseFloat(b.savings) - parseFloat(a.savings))

                const cleaned = unique.filter(d => {
                    const sale = parseFloat(d.salePrice)
                    const normal = parseFloat(d.normalPrice)
                    const pct = Math.trunc(parseFloat(d.savings))
                    return sale === 0 || (pct > 0 && normal > sale)
                })

                cache.set(cacheKey, cleaned)
                return cleaned
            } catch (e) {
                if (e.response?.status === 429) {
                    logger.error('CRITICAL: 429 DETECTED. ENTERING 5-MIN COOL DOWN.')
                    isCoolingDown = true
                    setTimeout(() => { isCoolingDown = false }, 5 * 60 * 1000)
                }
                logger.error(`CheapShark Fetch Err: ${e.message}`, { url })
                return MOCK_FALLBACK_DEALS
            }
        }

        // 4. Start the fetch and track it
        const fetchPromise = performFetch()
        inFlightRequests.set(cacheKey, fetchPromise)
        
        const finalData = await fetchPromise
        inFlightRequests.delete(cacheKey) // Cleanup after done
        
        res.json({ success: true, deals: finalData })

    } catch (err) {
        logger.error('Deals Route Exception:', err)
        res.status(500).json({ success: false, message: 'Failed to fetch deals' })
    }
})

export default router
