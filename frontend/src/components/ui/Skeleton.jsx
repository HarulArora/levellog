import React from 'react'

const Skeleton = ({ variant = 'block', width, height, className = '', style = {} }) => {
    const baseStyle = {
        background: '#18181f',
        borderRadius: variant === 'circle' ? '50%' : '8px',
        width: width || '100%',
        height: height || '20px',
        position: 'relative',
        overflow: 'hidden',
        ...style
    }

    // Animation styles
    const animationStyles = `
        @keyframes skeleton-pulse {
            0% { opacity: 1; }
            50% { opacity: 0.4; }
            100% { opacity: 1; }
        }
        .skeleton-animate {
            animation: skeleton-pulse 1.8s ease-in-out infinite;
        }
    `

    return (
        <>
            <style>{animationStyles}</style>
            <div 
                className={`skeleton-animate ${className}`} 
                style={baseStyle}
            />
        </>
    )
}

// ── Compounded Components for Common Layouts ──

export const GameCardSkeleton = () => (
    <div style={{ background: '#111118', border: '1px solid #2a2a35', borderRadius: 12, overflow: 'hidden' }}>
        <Skeleton variant="block" height="180px" style={{ borderRadius: 0 }} />
        <div style={{ padding: '12px' }}>
            <Skeleton variant="line" width="70%" height="16px" style={{ marginBottom: 8 }} />
            <Skeleton variant="line" width="40%" height="10px" />
        </div>
    </div>
)

export const DealSkeleton = () => (
    <div style={{
        display: 'flex', background: '#111118',
        border: '1px solid #2a2a35', borderRadius: 8,
        overflow: 'hidden', height: 92,
    }}>
        <Skeleton variant="block" width="100px" height="100%" style={{ borderRadius: 0 }} />
        <div style={{ flex: 1, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Skeleton variant="line" width="35%" height="9px" />
            <Skeleton variant="line" width="65%" height="12px" />
            <Skeleton variant="line" width="22%" height="18px" />
        </div>
    </div>
)

export const ListSkeleton = () => (
    <div style={{ padding: '12px 16px', background: '#111118', border: '1px solid #2a2a35', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton variant="block" width="40px" height="40px" style={{ borderRadius: 8 }} />
        <div style={{ flex: 1 }}>
            <Skeleton variant="line" width="50%" height="14px" style={{ marginBottom: 6 }} />
            <Skeleton variant="line" width="30%" height="10px" />
        </div>
    </div>
)

export default Skeleton
