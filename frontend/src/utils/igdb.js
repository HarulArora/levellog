/**
 * IGDB Image Utility
 * Helps transform default cover URLs into specific sizes for performance optimization.
 * 
 * Available sizes:
 * t_thumb           90 x 90
 * t_micro           35 x 35
 * t_cover_small     90 x 128
 * t_cover_big       264 x 374
 * t_logo_med        284 x 160
 * t_screenshot_med  569 x 320
 * t_screenshot_big  889 x 500
 * t_720p            1280 x 720
 * t_1080p           1920 x 1080
 */

export const getIGDBImage = (url, size = 't_cover_big') => {
    if (typeof url !== 'string') return null;
    const fullUrl = url.startsWith('http') ? url : `https:${url}`;
    return fullUrl.replace(/t_[a-zA-Z0-9_]+/, size);
};

export const SIZES = {
    THUMB: 't_thumb',
    MICRO: 't_micro',
    COVER_SMALL: 't_cover_small',
    COVER_BIG: 't_cover_big',
    SCREENSHOT_MED: 't_screenshot_med',
    SCREENSHOT_BIG: 't_screenshot_big',
    HD: 't_720p',
    FULL_HD: 't_1080p'
};
