// ⚡ Dynamic Chunk Import Error Recovery System
// Detects if a hashed chunk (e.g. from an old deployment) fails to load and reloads the page to get the fresh build.
window.addEventListener('error', (e) => {
    const message = e.message || '';
    const isChunkError = message.includes('Failed to fetch dynamically imported module') || 
                         message.includes('Importing a module script failed');
                         
    const isAssetElementError = e.target && 
                                (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK') && 
                                (e.target.src || e.target.href || '').includes('/assets/');

    if (isChunkError || isAssetElementError) {
        const lastReload = sessionStorage.getItem('last_chunk_reload');
        const now = Date.now();
        
        // Limit reloads to once every 10 seconds to prevent infinite reload loops if offline
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
            sessionStorage.setItem('last_chunk_reload', String(now));
            console.warn('Vite chunk load failure detected. Reloading page to get latest deployment...');
            window.location.reload();
        } else {
            console.error('Vite chunk load failure repeated. Skipping auto-reload to avoid loop.');
        }
    }
}, true);

window.addEventListener('unhandledrejection', (e) => {
    const message = e.reason?.message || '';
    if (message.includes('Failed to fetch dynamically imported module') || message.includes('Importing a module script failed')) {
        const lastReload = sessionStorage.getItem('last_chunk_reload');
        const now = Date.now();
        
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
            sessionStorage.setItem('last_chunk_reload', String(now));
            console.warn('Unhandled dynamic import rejection. Reloading page to get latest deployment...');
            window.location.reload();
        } else {
            console.error('Unhandled dynamic import rejection repeated. Skipping auto-reload.');
        }
    }
});

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import { HelmetProvider } from 'react-helmet-async'

import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GamesProvider } from './context/GamesContext.jsx'
import { AnimeProvider } from './context/AnimeContext.jsx'
import { MoviesProvider } from './context/MoviesContext.jsx'
import { DealsProvider } from './context/DealsContext.jsx'
import { FollowProvider } from './context/FollowContext.jsx'
import { LeaderboardProvider } from './context/LeaderboardContext.jsx'
import { SectionProvider } from './context/SectionContext.jsx'


if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration(),
        ],
        tracesSampleRate: 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
    })
}

const GoogleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <HelmetProvider>
            {GoogleClientId ? (
                <GoogleOAuthProvider clientId={GoogleClientId}>
                    <AuthProvider>
                    <SectionProvider>
                        <GamesProvider>
                        <AnimeProvider>
                        <MoviesProvider>
                            <DealsProvider>
                                <FollowProvider>
                                    <LeaderboardProvider>
                                        <App />
                                    </LeaderboardProvider>
                                </FollowProvider>
                            </DealsProvider>
                        </MoviesProvider>
                        </AnimeProvider>
                        </GamesProvider>
                    </SectionProvider>
                    </AuthProvider>
                </GoogleOAuthProvider>
            ) : (
                <AuthProvider>
                <SectionProvider>
                    <GamesProvider>
                    <AnimeProvider>
                    <MoviesProvider>
                        <DealsProvider>
                            <FollowProvider>
                                <LeaderboardProvider>
                                    <App />
                                </LeaderboardProvider>
                            </FollowProvider>
                        </DealsProvider>
                    </MoviesProvider>
                    </AnimeProvider>
                    </GamesProvider>
                </SectionProvider>
                </AuthProvider>
            )}
        </HelmetProvider>
    </StrictMode>
)

