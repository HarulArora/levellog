import { Link } from 'react-router-dom'
import { Mail, Heart, ExternalLink as LucideExternalLink } from 'lucide-react'
import './Footer.css'

// Safe SVG Icons to avoid Lucide-React export issues in older versions
const ExternalLinkIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-external-link"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" x2="21" y1="14" y2="3"></line></svg>
)

const GithubIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.28 1.15-.28 2.35 0 3.5-.73 1.02-1.08 2.25-1 3.5 0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path><path d="M9 18c-4.51 2-5-2-7-2"></path></svg>
)

const TwitterIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
)

const MailIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"></rect><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path></svg>
)

const HeartIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="heart-icon"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>
)

function Footer() {
    const currentYear = new Date().getFullYear()

    return (
        <footer className="footer-container">
            {/* Upper Decorative Border */}
            <div className="footer-glow-line" />

            <div className="footer-content">
                <div className="footer-grid">
                    {/* Brand Section */}
                    <div className="footer-brand">
                        <Link to="/" className="footer-logo">
                            <div className="logo-text" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                                QUEST<span className="text-white">DUCK</span>
                            </div>
                        </Link>
                        <p className="brand-description">
                            The ultimate companion for your gaming journey. Track your progress, discover new worlds, and connect with fellow hunters.
                        </p>
                    </div>

                    {/* Links Section */}
                    <div className="footer-links-grid">
                        <div className="footer-col">
                            <h4 className="col-title">Legal</h4>
                            <ul className="col-links">
                                <li>
                                    <Link to="/privacy">
                                        <ExternalLinkIcon /> Privacy Policy
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/terms">
                                        <ExternalLinkIcon /> Terms of Service
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        <div className="footer-col">
                            <h4 className="col-title">Connect</h4>
                            <div className="social-links">
                                <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="social-btn" aria-label="GitHub">
                                    <GithubIcon />
                                </a>
                                <a href="https://twitter.com/questduck69" target="_blank" rel="noopener noreferrer" className="social-btn" aria-label="Twitter">
                                    <TwitterIcon />
                                </a>
                                <a href="mailto:questduck69@gmail.com" className="social-btn" aria-label="Email">
                                    <MailIcon />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="footer-bottom">
                    <div className="copyright">
                        © {currentYear} QUESTDUCK. All rights reserved.
                    </div>
                    <div className="built-with">
                        Built with <HeartIcon /> for Gamers
                    </div>
                </div>
            </div>
            
            {/* Background Decorative Element */}
            <div className="footer-bg-glow" />
        </footer>
    )
}

export default Footer
