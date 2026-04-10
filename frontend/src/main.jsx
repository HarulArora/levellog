import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from "@sentry/react"
import { HelmetProvider } from 'react-helmet-async'

import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GamesProvider } from './context/GamesContext.jsx'
import { DealsProvider } from './context/DealsContext.jsx'
import { FollowProvider } from './context/FollowContext.jsx'

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

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <HelmetProvider>
            <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
                <AuthProvider>
                    <GamesProvider>
                        <DealsProvider>
                            <FollowProvider>
                                <App />
                            </FollowProvider>
                        </DealsProvider>
                    </GamesProvider>
                </AuthProvider>
            </GoogleOAuthProvider>
        </HelmetProvider>
    </StrictMode>
)

