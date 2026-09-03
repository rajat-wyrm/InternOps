import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Download,
  Loader2,
} from 'lucide-react';
import { EXPORT_FORMATS } from '../utils/tableExport';

export default function DownloadDataMenu({ onSelect, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const root = useRef(null);
  useEffect(() => {
    const close = (e) => {
      if (!root.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  const groups = ['Spreadsheets', 'Share & print', 'Raw data'];
  return (
    <div ref={root} className="relative self-end">
      <button
        type="button"
        disabled={disabled || exporting}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
      >
        {exporting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}{' '}
        {exporting ? 'Preparing...' : 'Download'}{' '}
        <ChevronDown className="h-4 w-4" />
      </button>
      {error && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-80 items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700 shadow-xl dark:border-red-900/60 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          {groups.map((group) => (
            <div key={group} className="py-1">
              <p className="px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                {group}
              </p>
              {EXPORT_FORMATS.filter((f) => f.group === group).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={async () => {
                    setOpen(false);
                    setError('');
                    setExporting(true);
                    try {
                      await onSelect(f.value);
                    } catch (exportError) {
                      setError(
                        exportError?.message ||
                          'Unable to create this download.'
                      );
                    } finally {
                      setExporting(false);
                    }
                  }}
                  className="group relative flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-left text-sm font-bold text-slate-700 transition-all duration-150 before:absolute before:inset-y-2 before:left-0 before:w-1 before:scale-y-0 before:rounded-r-full before:bg-indigo-500 before:transition-transform hover:bg-indigo-50 hover:pl-4 hover:text-indigo-800 hover:before:scale-y-100 active:scale-[0.99] focus-visible:bg-indigo-50 focus-visible:pl-4 focus-visible:text-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/40 focus-visible:before:scale-y-100 dark:text-slate-200 dark:hover:bg-indigo-500/15 dark:hover:text-indigo-100 dark:focus-visible:bg-indigo-500/15 dark:focus-visible:text-indigo-100"
                >
                  <span className="flex-1">{f.label}</span>
                  {f.recommended && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      <Check className="h-3 w-3" />
                      Recommended
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
