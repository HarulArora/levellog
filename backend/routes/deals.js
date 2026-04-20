import express from 'express'
import axios from 'axios'
import logger from '../utils/logger.js'

const router = express.Router()

/**
 * 🚀 QUESTDUCK DEAL-CLOUD ARCHITECTURE
 * Instead of fetching on-demand, we maintain a massive in-memory cache
 * of EVERY deal available, refreshed periodically in the background.
 */
let GLOBAL_DEAL_CACHE = {
    all: [],
    stores: {}, // store-specific sub-caches
    lastSynced: null,
    isSyncing: false
}

const SYNC_INTERVAL_MS = 60 * 60 * 1000 // Refresh every hour
const STORES_TO_SYNC = ['1', '25', '7', '11', '15', '3', '21', '6', '8', '13']

/**
 * Background Scraper: Crawls the API for every available deal.
 * Respects rate limits by using sequential page fetching.
 */
async function syncAllDeals() {
    if (GLOBAL_DEAL_CACHE.isSyncing) return
    
    logger.info('🚀 DEAL-SYNC: Starting global market crawl...')
    GLOBAL_DEAL_CACHE.isSyncing = true
    
    const startTime = Date.now()
    let allDeals = []
    const storeDeals = {}

    try {
        // We fetch the top 10 stores
        for (const storeID of STORES_TO_SYNC) {
            let storePage = 0
            let hasMoreForStore = true
            storeDeals[storeID] = []

            // Scrape up to 5 pages per store (300 deals per store)
            // This gives us a massive pool of ~3,000 deals
            while (hasMoreForStore && storePage < 5) {
                try {
                    const url = `https://www.cheapshark.com/api/1.0/deals?storeID=${storeID}&onSale=1&pageSize=60&pageNumber=${storePage}`
                    const r = await axios.get(url, { timeout: 10000 })
                    const pageData = r.data || []
                    
                    if (pageData.length === 0) {
                        hasMoreForStore = false
                    } else {
                        storeDeals[storeID].push(...pageData)
                        allDeals.push(...pageData)
                        storePage++
                        // Tiny delay to respect API rate limits
                        await new Promise(res => setTimeout(res, 300))
                    }
                } catch (e) {
                    logger.error(`DEAL-SYNC: Error fetching store ${storeID} page ${storePage}: ${e.message}`)
                    hasMoreForStore = false
                }
            }
        }

        // 🛠️ Post-Processing: Deduplicate and Clean
        const seen = new Set()
        const uniqueAll = allDeals.filter(d => {
            if (!d?.dealID || seen.has(d.dealID)) return false
            seen.add(d.dealID)
            return true
        })

        // Sort by highest savings globally
        uniqueAll.sort((a, b) => parseFloat(b.savings) - parseFloat(a.savings))

        const cleanedAll = uniqueAll.filter(d => {
            const sale = parseFloat(d.salePrice)
            const normal = parseFloat(d.normalPrice)
            const pct = Math.trunc(parseFloat(d.savings))
            return sale === 0 || (pct > 0 && normal > sale)
        })

        // Update the global cache
        GLOBAL_DEAL_CACHE.all = cleanedAll
        GLOBAL_DEAL_CACHE.stores = storeDeals
        GLOBAL_DEAL_CACHE.lastSynced = new Date()
        
        logger.info(`✅ DEAL-SYNC: Success. Synced ${cleanedAll.length} total deals in ${Math.round((Date.now() - startTime)/1000)}s`)
    } catch (err) {
        logger.error('DEAL-SYNC: Critical failure:', err)
    } finally {
        GLOBAL_DEAL_CACHE.isSyncing = false
    }
}

// 🚦 Start first sync on boot
syncAllDeals()
// 🔄 Schedule periodic sync
setInterval(syncAllDeals, SYNC_INTERVAL_MS)

router.get('/', async (req, res) => {
    const { storeFilter, freeOnly } = req.query
    const isFree = freeOnly === 'true'

    // ⚡ ZERO LATENCY: Serve directly from memory
    let results = []
    
    if (storeFilter && storeFilter !== 'all') {
        const storeId = String(storeFilter)
        results = GLOBAL_DEAL_CACHE.stores[storeId] || []
    } else {
        results = GLOBAL_DEAL_CACHE.all
    }

    // Filter free if requested
    if (isFree) {
        results = results.filter(d => parseFloat(d.salePrice) === 0)
    }

    res.json({ 
        success: true, 
        deals: results,
        total: results.length,
        lastUpdated: GLOBAL_DEAL_CACHE.lastSynced,
        isSyncing: GLOBAL_DEAL_CACHE.isSyncing
    })
})

export default router
