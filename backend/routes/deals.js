import express from 'express'
import { LRUCache } from 'lru-cache'
import axios from 'axios'

const router = express.Router()

const cache = new LRUCache({
    max: 100, // accommodate different queries
    ttl: 1000 * 60 * 15, // 15 mins cache
})

const ALL_STORE_IDS = ['1', '7', '11', '15', '3', '25', '35', '21', '6', '8', '13']

router.get('/', async (req, res) => {
    try {
        const { storeFilter = 'all', freeOnly = 'false' } = req.query
        const isFree = freeOnly === 'true'
        
        const cacheKey = `${storeFilter}-${isFree}`
        if (cache.has(cacheKey)) {
            return res.json({ success: true, deals: cache.get(cacheKey) })
        }

        let urls = []
        const stores = storeFilter === 'all' ? ALL_STORE_IDS.join(',') : storeFilter
        const pagesToFetch = storeFilter === 'all' 
            ? Array.from({ length: 15 }, (_, i) => i) 
            : Array.from({ length: 5 }, (_, i) => i)
        
        urls = pagesToFetch.map(pageNum => {
            const p = new URLSearchParams()
            p.append('pageSize', '60')
            p.append('sortBy', 'Savings')
            p.append('desc', '1')
            p.append('onSale', '1')
            p.append('storeID', stores)
            p.append('pageNumber', pageNum.toString())
            if (isFree) p.append('upperPrice', '0')
            return `https://www.cheapshark.com/api/1.0/deals?${p.toString()}`
        })

        const fetchPromises = urls.map(url => 
            axios.get(url, { headers: { 'User-Agent': 'LevelLog/1.0', 'Accept': 'application/json' } })
                .then(r => r.data || [])
                .catch(e => { console.error('Deal fetch err:', e.message); return [] })
        )
        const results = await Promise.all(fetchPromises)
        
        let data = []
        for (const r of results) {
            if (Array.isArray(r)) data = data.concat(r)
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

        cache.set(cacheKey, cleaned)
        res.json({ success: true, deals: cleaned })
    } catch (err) {
        console.error('Deals Route Error: ', err)
        res.status(500).json({ success: false, message: 'Failed to fetch deals' })
    }
})

export default router
