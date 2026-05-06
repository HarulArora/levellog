import { Link } from 'react-router-dom'
import { Mail, Heart, ExternalLink, Shield, Info, Rocket } from 'lucide-react'
import './Footer.css'

// Safe SVG Icons to avoid Lucide-React export issues
const GithubIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.28 1.15-.28 2.35 0 3.5-.73 1.02-1.08 2.25-1 3.5 0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
)

const TwitterIcon = ({ size = 18 }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
)

function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="footer-container">
            {/* Top Gradient Separator */}
            <div className="footer-divider-top" />

            <div className="footer-content">
                <div className="footer-top-section">
                    {/* Brand & Mission */}
                    <div className="footer-brand-box">
                        <Link to="/" className="footer-logo">
                            <h2 className="logo-text" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                QUEST<span className="text-white">DUCK</span>
                            </h2>
                        </Link>
                        <p className="footer-mission">
                            Level up your media tracking experience. A premium sanctuary for gamers, cinephiles, and collectors to log their journey across the digital pond.
                        </p>
                        <div className="footer-social-row">
                            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="social-pill">
                                <GithubIcon size={14} /> <span>GitHub</span>
                            </a>
                            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="social-pill">
                                <TwitterIcon size={14} /> <span>Twitter</span>
                            </a>
                            <a href="mailto:contact@questduck.com" className="social-pill">
                                <Mail size={14} /> <span>Email</span>
                            </a>
                        </div>
                    </div>

                    {/* Navigation Columns */}
                    <div className="footer-nav-groups">

                        <div className="nav-group">
                            <h4 className="group-title"><Shield size={14} className="inline mr-2 text-[#5c9fff]" /> Platform</h4>
                            <Link to="/privacy" className="nav-link">Privacy Policy</Link>
                            <Link to="/terms" className="nav-link">Terms of Service</Link>
                            <Link to="/attributions" className="nav-link">Attributions</Link>
                        </div>
                    </div>
                </div>

                <div className="footer-bottom-section">
                    <div className="copyright-box">
                        <span className="copyright-text">© {currentYear} <span className="brand-highlight">QUESTDUCK</span></span>
                        <span className="separator">•</span>
                        <span className="legal-text">ALL RIGHTS RESERVED</span>
                    </div>
                    
                    <div className="footer-love-tag">
                        MADE WITH <Heart size={14} className="heart-pulse mx-1.5" /> FOR THE <span className="community-text">COMMUNITY</span>
                    </div>
                </div>
            </div>

            {/* Subtle background element */}
            <div className="footer-corner-glow" />
        </footer>
    )
}

export default Footer
