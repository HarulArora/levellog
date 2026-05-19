import express from 'express';
import { GLOBAL_DEAL_CACHE } from '../utils/dealCacheHelper.js';

const router = express.Router();

router.get('/', async (req, res) => {
    const { storeFilter, freeOnly } = req.query;
    const isFree = freeOnly === 'true';

    // ⚡ ZERO LATENCY: Serve directly from memory
    let results = [];
    
    if (storeFilter && storeFilter !== 'all') {
        const storeId = String(storeFilter);
        results = GLOBAL_DEAL_CACHE.stores[storeId] || [];
    } else {
        results = GLOBAL_DEAL_CACHE.all || [];
    }

    // Filter free if requested
    if (isFree) {
        results = results.filter(d => parseFloat(d.salePrice) === 0);
    }

    res.json({ 
        success: true, 
        deals: results,
        total: results.length,
        lastUpdated: GLOBAL_DEAL_CACHE.lastSynced,
        isSyncing: GLOBAL_DEAL_CACHE.isSyncing
    });
});

export default router;
