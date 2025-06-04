<div>
    <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        class="transition-all duration-300"
    >
        <defs>
            <linearGradient id="cupGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#ef4444;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#ec4899;stop-opacity:1" />
            </linearGradient>
            <linearGradient id="steamGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" style="stop-color:#a855f7;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:1" />
            </linearGradient>
        </defs>
        
        <!-- Coffee cup handle -->
        <path
            d="M18 8h1a4 4 0 1 1 0 8h-1"
            stroke="url(#cupGradient)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
        />
        
        <!-- Coffee cup body -->
        <path
            d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"
            stroke="url(#cupGradient)"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            fill="rgba(251, 191, 36, 0.1)"
        />
        
        <!-- Steam lines with gradient -->
        <path
            d="M6 1v3M10 1v3M14 1v3"
            stroke="url(#steamGradient)"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="animate-pulse"
        />
        
        <!-- Coffee liquid -->
        <ellipse
            cx="10"
            cy="12"
            rx="6"
            ry="2"
            fill="rgba(120, 53, 15, 0.3)"
        />
    </svg>
</div>