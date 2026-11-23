import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { exportToExcel, exportToCsv } from '../../utils/exportUtils';

export interface ExportDropdownProps {
  data: Record<string, any>[];
  filename: string;
  sheetName?: string;
  disabled?: boolean;
  size?: 'xs' | 'sm' | 'md';
}

export const ExportDropdown: React.FC<ExportDropdownProps> = ({
  data,
  filename,
  sheetName = 'Data',
  disabled = false,
  size = 'sm',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportExcel = () => {
    setOpen(false);
    exportToExcel(data, filename, sheetName);
  };

  const handleExportCsv = () => {
    setOpen(false);
    exportToCsv(data, filename);
  };

  const sizeClasses = {
    xs: 'h-7 px-2.5 text-[11px] rounded-lg gap-1.5',
    sm: 'h-8 px-3 text-xs rounded-lg gap-1.5',
    md: 'h-9.5 px-3.5 text-xs rounded-xl gap-2',
  }[size];

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  }[size];

  return (
    <div className="relative inline-flex flex-row items-center shrink-0 flex-nowrap" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`inline-flex flex-row items-center justify-center flex-nowrap font-semibold rounded-lg border border-slate-200 dark:border-[#24344D] bg-white dark:bg-[#0D1729] text-slate-700 dark:text-[#E8EEF8] hover:bg-slate-50 dark:hover:bg-[#17243A] focus:outline-none focus:ring-2 focus:ring-brand-500/20 active:scale-[0.98] transition-all select-none shadow-sm disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap ${sizeClasses}`}
      >
        <Download className={`${iconSizes} shrink-0 text-slate-500 dark:text-[#94A3B8]`} />
        <span className="whitespace-nowrap shrink-0">Export</span>
        <ChevronDown className={`${iconSizes} shrink-0 opacity-60 ml-0.5`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-[#17243A] rounded-xl border border-slate-200 dark:border-[#24344D] shadow-xl py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 border-b border-slate-100 dark:border-[#24344D]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-[#71839D]">
              Export {data.length} Records
            </p>
          </div>
          <button
            type="button"
            onClick={handleExportExcel}
            className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-[#E8EEF8] hover:bg-slate-50 dark:hover:bg-[#1C2A42] flex items-center gap-2 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>Excel Spreadsheet (.xlsx)</span>
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="w-full text-left px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-[#E8EEF8] hover:bg-slate-50 dark:hover:bg-[#1C2A42] flex items-center gap-2 transition-colors"
          >
            <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>CSV File (.csv)</span>
          </button>
        </div>
      )}
    </div>
  );
};
