// main.jsx — entry point of your React app
// We wrap everything in AuthProvider so auth is available everywhere

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

createRoot(document.getElementById('root')).render(
    <StrictMode>
        {/* AuthProvider wraps App so every component can access auth */}
        <AuthProvider>
            <App />
        </AuthProvider>
    </StrictMode>
)