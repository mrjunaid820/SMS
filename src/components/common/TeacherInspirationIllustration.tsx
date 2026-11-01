import React from 'react';

export const TeacherInspirationIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center p-4 text-center select-none ${className}`} aria-hidden="true">
      {/* Decorative Quote */}
      <p className="font-serif italic text-base sm:text-lg font-medium text-slate-700 dark:text-slate-200 tracking-wide mb-3">
        Teach <span className="text-blue-500 font-sans mx-1">•</span> Guide <span className="text-emerald-500 font-sans mx-1">•</span> Inspire
      </p>

      {/* Books & Coffee Mug Vector Art */}
      <svg
        viewBox="0 0 240 140"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-48 sm:w-56 h-auto drop-shadow-xs"
      >
        <defs>
          <linearGradient id="book-bottom-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="book-mid-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#065f46" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <linearGradient id="book-top-grad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#f59e0b" />
          </linearGradient>
          <linearGradient id="mug-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#0369a1" />
          </linearGradient>
        </defs>

        {/* Soft Base Shadow */}
        <ellipse cx="120" cy="130" rx="90" ry="8" fill="#64748b" fillOpacity="0.18" />

        {/* BOOK 1 (Bottom - Blue) */}
        <g>
          {/* Base / Cover */}
          <rect x="35" y="105" width="145" height="18" rx="3" fill="url(#book-bottom-grad)" />
          {/* Pages */}
          <rect x="42" y="108" width="134" height="12" fill="#fffbeb" />
          <line x1="44" y1="112" x2="174" y2="112" stroke="#e2e8f0" strokeWidth="0.8" />
          <line x1="44" y1="116" x2="174" y2="116" stroke="#e2e8f0" strokeWidth="0.8" />
          {/* Spine Ribbon Marker */}
          <path d="M 35 114 L 28 114 L 32 120 L 26 126 L 35 120 Z" fill="#ef4444" />
        </g>

        {/* BOOK 2 (Middle - Emerald Green) */}
        <g>
          {/* Base / Cover */}
          <rect x="48" y="87" width="125" height="18" rx="3" fill="url(#book-mid-grad)" />
          {/* Pages */}
          <rect x="54" y="90" width="115" height="12" fill="#fffbeb" />
          <line x1="56" y1="94" x2="167" y2="94" stroke="#e2e8f0" strokeWidth="0.8" />
          <line x1="56" y1="98" x2="167" y2="98" stroke="#e2e8f0" strokeWidth="0.8" />
          {/* Gold Embossed Spine Lines */}
          <line x1="51" y1="89" x2="51" y2="103" stroke="#fef08a" strokeWidth="1.2" />
        </g>

        {/* BOOK 3 (Top - Warm Amber) */}
        <g>
          {/* Base / Cover */}
          <rect x="62" y="70" width="105" height="17" rx="3" fill="url(#book-top-grad)" />
          {/* Pages */}
          <rect x="68" y="73" width="95" height="11" fill="#fffbeb" />
          <line x1="70" y1="77" x2="161" y2="77" stroke="#e2e8f0" strokeWidth="0.8" />
          <line x1="70" y1="80" x2="161" y2="80" stroke="#e2e8f0" strokeWidth="0.8" />
        </g>

        {/* COFFEE / TEA MUG */}
        <g transform="translate(142, 44)">
          {/* Mug Shadow */}
          <ellipse cx="26" cy="62" rx="22" ry="4" fill="#0f172a" fillOpacity="0.25" />

          {/* Mug Handle */}
          <path
            d="M 44 22 C 54 22 56 46 44 48"
            stroke="#0284c7"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />

          {/* Mug Body */}
          <path
            d="M 12 14 L 14 54 C 14 60 38 60 38 54 L 40 14 Z"
            fill="url(#mug-grad)"
          />

          {/* Mug Rim */}
          <ellipse cx="26" cy="14" rx="14" ry="4" fill="#38bdf8" />
          {/* Tea / Coffee Surface */}
          <ellipse cx="26" cy="14.5" rx="12" ry="3" fill="#78350f" />

          {/* Steam Swirls */}
          <path
            d="M 22 8 Q 18 0 24 -8"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.75"
          />
          <path
            d="M 30 8 Q 34 2 28 -6"
            stroke="#94a3b8"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.75"
          />
        </g>
      </svg>
    </div>
  );
};
