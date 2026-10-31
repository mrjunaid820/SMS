import React from 'react';
import { SchoolEmblem } from './SchoolEmblem';

export interface BrandedLoadingScreenProps {
  message?: string;
  submessage?: string;
}

export const BrandedLoadingScreen: React.FC<BrandedLoadingScreenProps> = ({
  message = 'Islamia Public High School',
  submessage = 'Preparing your institutional dashboard...',
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900 text-slate-100 p-4 transition-opacity duration-300 select-none"
    >
      {/* Background Subtle Ambient Glows */}
      <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

      {/* Institutional Crest Card */}
      <div className="relative z-10 flex flex-col items-center max-w-sm text-center">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-950 border border-amber-500/30 shadow-2xl flex items-center justify-center mb-5 animate-pulse">
          <SchoolEmblem className="w-12 h-12 text-amber-400 drop-shadow-md" />
        </div>

        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white mb-1.5">
          {message}
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-medium mb-6">
          {submessage}
        </p>

        {/* Smooth Linear Progress Track */}
        <div className="w-48 sm:w-56 h-1.5 bg-slate-800 rounded-full overflow-hidden relative border border-slate-700/50">
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-blue-600 via-sky-400 to-amber-400 rounded-full animate-indeterminate-bar w-1/2" />
        </div>
      </div>
    </div>
  );
};
