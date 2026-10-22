import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from './EmptyState';
import { TableSkeleton } from './LoadingSkeleton';

export interface Column<T> {
  key: string;
  header: string;
  accessor?: (row: T) => any;
  sortable?: boolean;
  className?: string;
  render?: (row: T) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchFilter?: (row: T, term: string) => boolean;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: React.ReactNode;
  rowKey: (row: T) => string;
  pageSizeDefault?: number;
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search records...',
  searchFilter,
  isLoading = false,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no records matching your query.',
  actions,
  rowKey,
  pageSizeDefault = 10,
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(pageSizeDefault);

  // 1. Filter
  const filteredData = useMemo(() => {
    if (!searchTerm.trim()) return data;
    const term = searchTerm.toLowerCase();
    if (searchFilter) {
      return data.filter((row) => searchFilter(row, term));
    }
    return data.filter((row: any) => {
      return Object.values(row).some((val) => {
        if (typeof val === 'string' || typeof val === 'number') {
          return String(val).toLowerCase().includes(term);
        }
        return false;
      });
    });
  }, [data, searchTerm, searchFilter]);

  // 2. Sort
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    const column = columns.find((c) => c.key === sortKey);
    return [...filteredData].sort((a, b) => {
      const aVal = column?.accessor ? column.accessor(a) : (a as any)[sortKey];
      const bVal = column?.accessor ? column.accessor(b) : (b as any)[sortKey];

      if (aVal === bVal) return 0;
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      const compare = aVal < bVal ? -1 : 1;
      return sortOrder === 'asc' ? compare : -compare;
    });
  }, [filteredData, sortKey, sortOrder, columns]);

  // 3. Paginate
  const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const paginatedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, page, pageSize]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      if (sortOrder === 'asc') setSortOrder('desc');
      else setSortKey(null);
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-4">
      {/* Search and Action Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder={searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-900 dark:focus:ring-brand-500 text-slate-900 dark:text-slate-100"
          />
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Table Container */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6">
              <TableSkeleton rows={pageSizeDefault} cols={columns.length} />
            </div>
          ) : paginatedData.length === 0 ? (
            <div className="py-12">
              <EmptyState title={emptyTitle} description={emptyDescription} />
            </div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      onClick={() => col.sortable && handleSort(col.key)}
                      className={cn(
                        'px-4 py-3 select-none',
                        col.sortable && 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors',
                        col.className
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-slate-400">
                            {sortKey === col.key ? (
                              sortOrder === 'asc' ? (
                                <ChevronUp className="w-3.5 h-3.5 text-navy-900 dark:text-brand-400" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5 text-navy-900 dark:text-brand-400" />
                              )
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedData.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3 align-middle', col.className)}>
                        {col.render
                          ? col.render(row)
                          : col.accessor
                          ? col.accessor(row)
                          : (row as any)[col.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Footer */}
        {!isLoading && paginatedData.length > 0 && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>
                Showing {Math.min(sortedData.length, (page - 1) * pageSize + 1)} to{' '}
                {Math.min(sortedData.length, page * pageSize)} of {sortedData.length} records
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
