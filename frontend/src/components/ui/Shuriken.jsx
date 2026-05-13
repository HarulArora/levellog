import React from 'react';

const Shuriken = ({ size = 24, className = "", strokeWidth = 2, ...props }) => {
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            <path d="M12 2l2 7 8 3-8 3-2 7-2-7-8-3 8-3 2-7z" />
            <circle cx="12" cy="12" r="2.5" />
        </svg>
    );
};

export default Shuriken;
