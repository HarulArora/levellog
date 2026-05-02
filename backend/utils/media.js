/**
 * Robustly extracts the release year from various Jikan API response formats.
 * @param {Object} item - The media item from Jikan API
 * @returns {Number|null} - The extracted year or null
 */
export const extractYear = (item) => {
    if (!item) return null;

    // 1. Check prop object (Most reliable for Jikan)
    if (item.aired?.prop?.from?.year) return item.aired.prop.from.year;
    if (item.published?.prop?.from?.year) return item.published.prop.from.year;
    
    // 2. Check direct year field (Sometimes present in search results)
    if (item.year) return item.year;
    
    // 3. Parse from direct date string
    const dateStr = item.aired?.from || item.published?.from;
    if (dateStr) {
        const year = new Date(dateStr).getFullYear();
        if (!isNaN(year) && year > 1900) return year;
    }
    
    // 4. Regex fallback from "aired/published string" (e.g. "Oct 1999 to ...")
    const airedString = item.aired?.string || item.published?.string;
    if (airedString) {
        const match = airedString.match(/\d{4}/);
        if (match) return parseInt(match[0]);
    }

    return null;
};
