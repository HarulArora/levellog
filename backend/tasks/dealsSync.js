import cron from 'node-cron';
import apiClient from '../utils/apiClient.js';
import logger from '../utils/logger.js';
import { updateGlobalDealCache } from '../utils/dealCacheHelper.js';

const STORES_TO_SYNC = ['1', '25', '7', '11', '15', '3', '21', '6', '8', '13'];

// Local status indicator
let isSyncing = false;

/**
 * 🚀 Sequential, Rate-Limit Safe Deep Scraper
 */
export const syncAllDeals = async () => {
    if (isSyncing) {
        logger.info('[Deals-Sync] Sync already in progress, skipping start request.');
        return;
    }

    logger.info('🚀 [Deals-Sync] Starting global market crawl with deep rate-limit protection...');
    isSyncing = true;
    
    const startTime = Date.now();
    let allDeals = [];
    const storeDeals = {};

    try {
        for (const storeID of STORES_TO_SYNC) {
            let storePage = 0;
            let hasMoreForStore = true;
            storeDeals[storeID] = [];

            logger.info(`🔍 [Deals-Sync] Fetching deals for Store ID: ${storeID}`);

            // Max 5 pages per store to prevent endless hammering
            while (hasMoreForStore && storePage < 5) {
                try {
                    const url = `https://www.cheapshark.com/api/1.0/deals?storeID=${storeID}&onSale=1&pageSize=60&pageNumber=${storePage}`;
                    
                    // We use the apiClient that automatically retries on 429 and 5xx errors
                    const r = await apiClient.get(url, { 
                        retry: 3, 
                        retryDelay: 1500,
                        timeout: 8000
                    });
                    
                    const pageData = r.data || [];

                    if (pageData.length === 0) {
                        hasMoreForStore = false;
                    } else {
                        storeDeals[storeID].push(...pageData);
                        allDeals.push(...pageData);
                        storePage++;
                        
                        // Gentle paced delay between pages to be a friendly client
                        await new Promise(res => setTimeout(res, 1000));
                    }
                } catch (e) {
                    logger.error(`⚠️ [Deals-Sync] Error crawling store ${storeID} page ${storePage}: ${e.message}`);
                    hasMoreForStore = false; // Stop checking this store but let other stores proceed
                }
            }
            
            // Short breath delay before transitioning to the next store
            await new Promise(res => setTimeout(res, 1500));
        }

        // Post-Processing: Deduplicate
        const seen = new Set();
        const uniqueAll = allDeals.filter(d => {
            if (!d?.dealID || seen.has(d.dealID)) return false;
            seen.add(d.dealID);
            return true;
        });

        // Clean & Filter
        const cleanedAll = uniqueAll.filter(d => {
            const sale = parseFloat(d.salePrice);
            const normal = parseFloat(d.normalPrice);
            const pct = Math.trunc(parseFloat(d.savings));
            return sale === 0 || (pct > 0 && normal > sale);
        });

        // Sort by highest savings globally
        cleanedAll.sort((a, b) => parseFloat(b.savings) - parseFloat(a.savings));

        // Package Cache Object
        const cachePayload = {
            all: cleanedAll,
            stores: storeDeals,
            lastSynced: new Date(),
            isSyncing: false
        };

        // Hydrate in-memory routing cache AND backup to disk
        updateGlobalDealCache(cachePayload);

        logger.info(`✅ [Deals-Sync] Success. Processed ${cleanedAll.length} unique deals in ${Math.round((Date.now() - startTime) / 1000)}s`);

    } catch (err) {
        logger.error('❌ [Deals-Sync] Critical crawling worker failure:', err);
    } finally {
        isSyncing = false;
    }
};

/**
 * ⏰ Cron & Startup Setup
 */
export const initDealsCron = () => {
    // Schedule every 6 hours
    cron.schedule('0 */6 * * *', async () => {
        logger.info('[Cron] Triggering 6-hourly deals crawl update...');
        await syncAllDeals();
    });

    // Run async on startup quickly so the user gets deals almost immediately on first launch
    setTimeout(() => {
        logger.info('[Deals-Sync] Triggering background startup deals update...');
        syncAllDeals().catch(err => logger.error('[Deals-Sync] Startup crawl failed:', err));
    }, 3000); // Wait 3s to let the Express server bind and warm up
};
