import React from 'react';

interface SchoolEmblemProps {
  className?: string;
  size?: number;
  logoUrl?: string | null;
  schoolName?: string;
}

export const SchoolEmblem: React.FC<SchoolEmblemProps> = ({
  className = '',
  size = 56,
  logoUrl,
  schoolName = 'Islamia Public High School',
}) => {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={schoolName}
        className={`object-contain rounded-full ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  // High-fidelity vector School Crest matching Islamia Public High School reference
  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-label={schoolName}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm"
      >
        {/* Subtle Outer Laurel Glow */}
        <circle cx="50" cy="50" r="46" fill="url(#crest-bg-grad)" opacity="0.15" />

        {/* Left Laurel Wreath Branch */}
        <g stroke="#f3cf7a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 48 86 C 26 82 12 66 16 42 C 18 30 24 20 34 14" />
          {/* Leaves on left */}
          <path d="M 28 82 C 22 80 18 74 22 68 C 24 73 28 77 31 79" fill="#fef3c7" stroke="#eab308" strokeWidth="1" />
          <path d="M 18 68 C 12 64 12 56 18 52 C 18 58 20 63 24 65" fill="#fef3c7" stroke="#eab308" strokeWidth="1" />
          <path d="M 15 52 C 10 46 12 38 18 36 C 18 42 20 47 23 49" fill="#fef3c7" stroke="#eab308" strokeWidth="1" />
          <path d="M 19 36 C 16 30 20 22 26 22 C 24 27 26 32 29 34" fill="#fef3c7" stroke="#eab308" strokeWidth="1" />
          <path d="M 28 22 C 28 16 34 12 40 14 C 37 18 36 22 38 25" fill="#fef3c7" stroke="#eab308" strokeWidth="1" />
        </g>

        {/* Right Laurel Wreath Branch */}
        <g stroke="#f3cf7a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 52 86 C 74 82 88 66 84 42 C 82 30 76 20 66 14" />
          {/* Leaves on right */}
          <path d="M 72 82 C 78 80 82 74 78 68 C 76 73 72 77 69 79" fill="#fef3c7" stroke="#eab308" strokeWidth="1" />
          <path d="M 82 68 C 88 64 88 56 82 52 C 82 58 80 63 76 65" fill="#fef3c7" stroke="#eab308" strokeWidth="1" />
          <path d="M 85 52 C 90 46 88 38 82 36 C 82 42 80 47 77 49" fill="#fef3c7" stroke="#eab308" strokeWidth="1" />
          <path d="M 81 36 C 84 30 80 22 74 22 C 76 27 74 32 71 34" fill="#fef3c7" stroke="#eab308" strokeWidth="1" />
          <path d="M 72 22 C 72 16 66 12 60 14 C 63 18 64 22 62 25" fill="#fef3c7" stroke="#eab308" strokeWidth="1" />
        </g>

        {/* Bottom Ribbon / Tie Knot */}
        <path d="M 46 85 Q 50 87 54 85 Q 56 89 50 90 Q 44 89 46 85 Z" fill="#eab308" stroke="#ca8a04" strokeWidth="1" />

        {/* Central Shield Outline */}
        <path
          d="M 50 20 Q 64 20 68 32 C 68 54 58 68 50 72 C 42 68 32 54 32 32 Q 36 20 50 20 Z"
          fill="#0c1d3b"
          stroke="#fde047"
          strokeWidth="1.6"
        />

        {/* Inner Shield Accent */}
        <path
          d="M 50 23 Q 62 23 65 33 C 65 52 56 64 50 68 C 44 64 35 52 35 33 Q 38 23 50 23 Z"
          fill="#081427"
          stroke="#ca8a04"
          strokeWidth="0.8"
        />

        {/* Radiant Star atop the Book */}
        <path
          d="M 50 27 L 51.5 30.5 L 55 31 L 52.5 33.2 L 53.2 36.8 L 50 35 L 46.8 36.8 L 47.5 33.2 L 45 31 L 48.5 30.5 Z"
          fill="#fef08a"
          stroke="#ca8a04"
          strokeWidth="0.5"
        />

        {/* Open Book in Center */}
        {/* Left Page */}
        <path
          d="M 49 42 C 43 40 37 42 36 43 L 36 57 C 38 56 43 54 49 56 Z"
          fill="#ffffff"
          stroke="#e2e8f0"
          strokeWidth="0.8"
        />
        {/* Right Page */}
        <path
          d="M 51 42 C 57 40 63 42 64 43 L 64 57 C 62 56 57 54 51 56 Z"
          fill="#ffffff"
          stroke="#e2e8f0"
          strokeWidth="0.8"
        />
        {/* Book Spine */}
        <line x1="50" y1="41" x2="50" y2="57" stroke="#3b82f6" strokeWidth="1.2" strokeLinecap="round" />

        {/* Lines representing knowledge / text on pages */}
        <line x1="39" y1="46" x2="47" y2="45" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="39" y1="49" x2="47" y2="48" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="39" y1="52" x2="46" y2="51" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" />

        <line x1="53" y1="45" x2="61" y2="46" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="53" y1="48" x2="61" y2="49" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" />
        <line x1="54" y1="51" x2="61" y2="52" stroke="#94a3b8" strokeWidth="0.8" strokeLinecap="round" />

        {/* Small Golden Quill / Foundation Bar */}
        <path d="M 40 61 Q 50 64 60 61 L 59 63 Q 50 66 41 63 Z" fill="#eab308" />

        <defs>
          <radialGradient id="crest-bg-grad" cx="50" cy="50" r="46" gradientUnits="userSpaceOnUse">
            <stop stopColor="#fbbf24" />
            <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    </div>
  );
};
