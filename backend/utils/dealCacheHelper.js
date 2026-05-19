import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(__dirname, '../data');
const CACHE_FILE = path.join(CACHE_DIR, 'deals_cache.json');

export const GLOBAL_DEAL_CACHE = {
    all: [],
    stores: {},
    lastSynced: null,
    isSyncing: false
};

export const loadDealsFromBackup = () => {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const rawData = fs.readFileSync(CACHE_FILE, 'utf8');
            const data = JSON.parse(rawData);
            if (data && Array.isArray(data.all)) {
                logger.info(`💾 [Deals-Helper] Hydrated ${data.all.length} deals from local file cache.`);
                GLOBAL_DEAL_CACHE.all = data.all;
                GLOBAL_DEAL_CACHE.stores = data.stores || {};
                GLOBAL_DEAL_CACHE.lastSynced = data.lastSynced || null;
                GLOBAL_DEAL_CACHE.isSyncing = data.isSyncing || false;
                return data;
            }
        }
    } catch (err) {
        logger.error('[Deals-Helper] Failed to load local deals backup file:', err);
    }
    return null;
};

export const saveDealsToBackup = (data) => {
    try {
        if (!fs.existsSync(CACHE_DIR)) {
            fs.mkdirSync(CACHE_DIR, { recursive: true });
        }
        fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
        logger.info('💾 [Deals-Helper] Saved successfully to local deals_cache.json backup.');
    } catch (err) {
        logger.error('[Deals-Helper] Failed to write backup file:', err);
    }
};

export const updateGlobalDealCache = (newCache) => {
    if (newCache) {
        if (Array.isArray(newCache.all)) GLOBAL_DEAL_CACHE.all = newCache.all;
        if (newCache.stores) GLOBAL_DEAL_CACHE.stores = newCache.stores;
        if (newCache.lastSynced !== undefined) GLOBAL_DEAL_CACHE.lastSynced = newCache.lastSynced;
        if (newCache.isSyncing !== undefined) GLOBAL_DEAL_CACHE.isSyncing = newCache.isSyncing;
        saveDealsToBackup(GLOBAL_DEAL_CACHE);
    }
};

// Auto-hydrate cache on module load
loadDealsFromBackup();
