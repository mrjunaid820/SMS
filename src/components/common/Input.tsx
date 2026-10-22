import React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, leftIcon, id, ...props }, ref) => {
    const inputId = id || props.name || Math.random().toString(36).substring(2, 9);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={inputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative rounded-lg shadow-sm">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 transition-colors placeholder:text-slate-400',
              'focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:focus:ring-brand-500',
              leftIcon && 'pl-10',
              error
                ? 'border-rose-400 text-rose-900 focus:border-rose-500 focus:ring-rose-500 dark:border-rose-600'
                : 'border-slate-300',
              props.disabled && 'bg-slate-100 text-slate-500 cursor-not-allowed dark:bg-slate-800',
              className
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error}</p>}
        {!error && helperText && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
