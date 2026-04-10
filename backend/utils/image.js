import sharp from 'sharp'
import logger from './logger.js'

/**
 * Optimizes an image (Buffer/Base64) to WebP format for startup performance.
 * @param {string|Buffer} imageInput - Base64 string or image Buffer
 * @param {number} width - Target width (default 400)
 * @returns {Promise<string>} - Base64 optimized image
 */
export const optimizeAvatar = async (imageInput, width = 400) => {
    try {
        let buffer = imageInput
        if (typeof imageInput === 'string' && imageInput.includes('base64,')) {
            buffer = Buffer.from(imageInput.split(',')[1], 'base64')
        } else if (typeof imageInput === 'string') {
             // If it's a URL, we don't optimize it here to avoid server wait
             return imageInput
        }

        const optimizedBuffer = await sharp(buffer)
            .resize(width, width, { fit: 'cover' })
            .webp({ quality: 80 })
            .toBuffer()

        return `data:image/webp;base64,${optimizedBuffer.toString('base64')}`
    } catch (error) {
        logger.error('Image optimization failed:', error)
        return imageInput // Fallback to original
    }
}
