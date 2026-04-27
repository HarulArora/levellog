import axios from 'axios';

const apiClient = axios.create({
    timeout: 30000, // Increased to 30 seconds
    headers: {
        // 'Connection': 'close',
        'User-Agent': 'LevelLog/1.0 (Coding Assistant Integration)'
    }
});

// Simple retry interceptor
apiClient.interceptors.response.use(null, async (error) => {
    const { config } = error;
    if (!config || !config.retry) return Promise.reject(error);

    config.retryCount = config.retryCount || 0;
    // Handle network errors (no response) or specific status codes
    const isNetworkError = !error.response;
    const isRetryableStatus = error.response?.status >= 500 || error.response?.status === 429;
    
    if (!isNetworkError && !isRetryableStatus) {
        return Promise.reject(error);
    }

    if (config.retryCount >= config.retry) {
        return Promise.reject(error);
    }

    config.retryCount += 1;
    
    // If 429 or network error, wait longer
    const delay = (error.response?.status === 429 || isNetworkError) ? 2000 : (config.retryDelay || 1000);
    
    const backoff = new Promise((resolve) => {
        setTimeout(() => resolve(), delay);
    });

    await backoff;
    return apiClient(config);
});

export default apiClient;
