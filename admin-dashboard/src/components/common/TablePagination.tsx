import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface TablePaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
}

export const TablePagination: React.FC<TablePaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, currentPage * pageSize);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-4 py-3 bg-white dark:bg-[#0F192C] border-t border-slate-100 dark:border-[#24344D] rounded-b-2xl text-xs text-slate-600 dark:text-[#94A3B8]">
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
        <span className="text-[11px] sm:text-xs">
          Showing <span className="font-semibold text-slate-900 dark:text-[#E8EEF8]">{startItem}</span> to{' '}
          <span className="font-semibold text-slate-900 dark:text-[#E8EEF8]">{endItem}</span> of{' '}
          <span className="font-semibold text-slate-900 dark:text-[#E8EEF8]">{totalItems}</span> entries
        </span>
        {onPageSizeChange && (
          <div className="flex items-center space-x-1 sm:ml-2 sm:border-l sm:border-slate-200 dark:sm:border-[#24344D] sm:pl-2">
            <span className="text-[11px] text-slate-400 dark:text-[#71839D]">Rows:</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
              className="bg-transparent border border-slate-200 dark:border-[#24344D] rounded-md px-1.5 py-0.5 text-xs text-slate-700 dark:text-[#E8EEF8] focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {pageSizeOptions.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-1.5 shrink-0">
        <Button
          variant="outline"
          size="xs"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          icon={ChevronLeft}
          title="Previous page"
        />
        <div className="flex items-center space-x-1 px-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum = i + 1;
            if (totalPages > 5 && currentPage > 3) {
              pageNum = currentPage - 3 + i;
              if (pageNum > totalPages) pageNum = totalPages - (4 - i);
            }
            const active = pageNum === currentPage;
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition-all ${
                  active
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="xs"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          icon={ChevronRight}
          title="Next page"
        />
      </div>
    </div>
  );
};

