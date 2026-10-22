import React from 'react';
import { cn } from '@/lib/utils';

export interface Option {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Option[];
  placeholder?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, ...props }, ref) => {
    const selectId = id || props.name || Math.random().toString(36).substring(2, 9);

    return (
      <div className="w-full space-y-1">
        {label && (
          <label htmlFor={selectId} className="block text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
            {label}
            {props.required && <span className="text-rose-500 ml-1">*</span>}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={cn(
            'block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 transition-colors',
            'focus:outline-none focus:ring-2 focus:ring-navy-900 focus:border-navy-900 dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700 dark:focus:ring-brand-500',
            error ? 'border-rose-400 text-rose-900' : 'border-slate-300',
            props.disabled && 'bg-slate-100 text-slate-500 cursor-not-allowed dark:bg-slate-800',
            className
          )}
          {...props}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
      </div>
    );
  }
);

Select.displayName = 'Select';
