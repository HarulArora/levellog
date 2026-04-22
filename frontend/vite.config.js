import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(),
    ],
    // This fixes blank page on refresh in production
    base: '/',
    server: {
        headers: {
            'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
        }
    }
})