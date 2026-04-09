import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { GoogleOAuthProvider } from '@react-oauth/google'
import { GamesProvider } from './context/GamesContext.jsx'
import { DealsProvider } from './context/DealsContext.jsx'
import { FollowProvider } from './context/FollowContext.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
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
    </StrictMode>
)

