import React from 'react';

export const SchoolCampusIllustration: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`relative overflow-hidden pointer-events-none select-none ${className}`} aria-hidden="true">
      <svg
        viewBox="0 0 680 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full object-cover"
        preserveAspectRatio="xMidYMid slice"
      >
        {/* Soft Sky Gradient */}
        <rect width="680" height="240" fill="url(#sky-grad)" />

        {/* Soft Distant Clouds */}
        <ellipse cx="140" cy="40" rx="90" ry="25" fill="#ffffff" fillOpacity="0.6" />
        <ellipse cx="220" cy="35" rx="70" ry="20" fill="#ffffff" fillOpacity="0.5" />
        <ellipse cx="500" cy="45" rx="100" ry="28" fill="#ffffff" fillOpacity="0.6" />
        <ellipse cx="580" cy="40" rx="80" ry="22" fill="#ffffff" fillOpacity="0.5" />

        {/* Distant Hills / Horizon */}
        <path d="M 0 160 Q 200 135 400 150 Q 560 140 680 155 L 680 240 L 0 240 Z" fill="#b9d5c6" fillOpacity="0.4" />

        {/* Main School Building Structure */}
        {/* Left Wing */}
        <rect x="120" y="90" width="160" height="90" fill="#f4ebd9" stroke="#d5c4a1" strokeWidth="1.5" />
        <rect x="120" y="82" width="160" height="8" fill="#c47a54" />
        {/* Left Wing Roof Balustrade */}
        <line x1="120" y1="78" x2="280" y2="78" stroke="#8d4b2e" strokeWidth="2" />
        {/* Left Wing Windows Row 1 */}
        {[135, 165, 195, 225, 255].map((x) => (
          <g key={`l1-${x}`}>
            <rect x={x} y="100" width="16" height="22" rx="8" fill="#3b6998" />
            <line x1={x + 8} y1="100" x2={x + 8} y2="122" stroke="#ffffff" strokeWidth="0.8" />
            <line x1={x} y1="112" x2={x + 16} y2="112" stroke="#ffffff" strokeWidth="0.8" />
          </g>
        ))}
        {/* Left Wing Windows Row 2 */}
        {[135, 165, 195, 225, 255].map((x) => (
          <g key={`l2-${x}`}>
            <rect x={x} y="135" width="16" height="25" fill="#3b6998" />
            <line x1={x + 8} y1="135" x2={x + 8} y2="160" stroke="#ffffff" strokeWidth="0.8" />
            <line x1={x} y1="147" x2={x + 16} y2="147" stroke="#ffffff" strokeWidth="0.8" />
          </g>
        ))}

        {/* Right Wing */}
        <rect x="400" y="90" width="160" height="90" fill="#f4ebd9" stroke="#d5c4a1" strokeWidth="1.5" />
        <rect x="400" y="82" width="160" height="8" fill="#c47a54" />
        <line x1="400" y1="78" x2="560" y2="78" stroke="#8d4b2e" strokeWidth="2" />
        {/* Right Wing Windows Row 1 */}
        {[415, 445, 475, 505, 535].map((x) => (
          <g key={`r1-${x}`}>
            <rect x={x} y="100" width="16" height="22" rx="8" fill="#3b6998" />
            <line x1={x + 8} y1="100" x2={x + 8} y2="122" stroke="#ffffff" strokeWidth="0.8" />
            <line x1={x} y1="112" x2={x + 16} y2="112" stroke="#ffffff" strokeWidth="0.8" />
          </g>
        ))}
        {/* Right Wing Windows Row 2 */}
        {[415, 445, 475, 505, 535].map((x) => (
          <g key={`r2-${x}`}>
            <rect x={x} y="135" width="16" height="25" fill="#3b6998" />
            <line x1={x + 8} y1="135" x2={x + 8} y2="160" stroke="#ffffff" strokeWidth="0.8" />
            <line x1={x} y1="147" x2={x + 16} y2="147" stroke="#ffffff" strokeWidth="0.8" />
          </g>
        ))}

        {/* Central Portico / Hall with Grand Pediment */}
        <rect x="270" y="70" width="140" height="110" fill="#faedd9" stroke="#cfbe98" strokeWidth="1.5" />
        {/* Triangular Pediment atop Portico */}
        <polygon points="260,70 340,30 420,70" fill="#d97757" stroke="#ad4f33" strokeWidth="1.5" />
        {/* Circular Clock in Pediment */}
        <circle cx="340" cy="54" r="10" fill="#ffffff" stroke="#ad4f33" strokeWidth="1.5" />
        <line x1="340" y1="54" x2="340" y2="48" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />
        <line x1="340" y1="54" x2="345" y2="54" stroke="#1e293b" strokeWidth="1.2" strokeLinecap="round" />

        {/* Grand Pillars on Portico */}
        {[285, 315, 345, 375].map((x) => (
          <rect key={`pillar-${x}`} x={x} y="74" width="12" height="106" fill="#fefaf0" stroke="#cfbe98" strokeWidth="0.8" />
        ))}
        {/* Classical Arched Main Entrance Doors */}
        <path d="M 322 180 L 322 135 C 322 125 358 125 358 135 L 358 180 Z" fill="#1e3a8a" />
        <path d="M 326 180 L 326 137 C 326 128 354 128 354 137 L 354 180 Z" fill="#0f172a" />
        <circle cx="337" cy="155" r="1.5" fill="#facc15" />
        <circle cx="343" cy="155" r="1.5" fill="#facc15" />

        {/* Entrance Steps */}
        <polygon points="290,180 390,180 405,190 275,190" fill="#e2d8c3" stroke="#b8ab91" strokeWidth="1" />
        <polygon points="275,190 405,190 420,200 260,200" fill="#d5cbaf" stroke="#b8ab91" strokeWidth="1" />

        {/* Flagpole on Center Dome */}
        <line x1="340" y1="30" x2="340" y2="8" stroke="#94a3b8" strokeWidth="1.5" />
        <polygon points="340,9 356,14 340,19" fill="#15803d" />
        <circle cx="347" cy="14" r="2.5" fill="#ffffff" />

        {/* Lush Green Lawn in Foreground */}
        <path d="M 0 185 Q 340 175 680 185 L 680 240 L 0 240 Z" fill="url(#lawn-grad)" />

        {/* Landscaped Decorative Bushes and Trees */}
        {[60, 95, 275, 405, 575, 615].map((x, i) => (
          <g key={`tree-${i}`}>
            <circle cx={x} cy={175} r={14} fill="#15803d" />
            <circle cx={x + 6} cy={170} r={12} fill="#22c55e" fillOpacity="0.8" />
            <circle cx={x - 6} cy={172} r={10} fill="#166534" />
            <rect x={x - 2} y={185} width="4" height="12" fill="#78350f" />
          </g>
        ))}

        <defs>
          <linearGradient id="sky-grad" x1="340" y1="0" x2="340" y2="180" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e0f2fe" />
            <stop offset="0.7" stopColor="#bae6fd" />
            <stop offset="1" stopColor="#e0f2fe" />
          </linearGradient>
          <linearGradient id="lawn-grad" x1="340" y1="180" x2="340" y2="240" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4ade80" />
            <stop offset="0.5" stopColor="#22c55e" />
            <stop offset="1" stopColor="#16a34a" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
};
