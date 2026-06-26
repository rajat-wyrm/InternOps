import { useState } from 'react';
import {
  Download,
  CalendarDays,
  Star,
  Target,
  ArrowDownToLine,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { Card, Input } from '../../components/ui';
import api from '../../lib/axios';

const EXPORTS = [
  {
    key: 'attendance-csv',
    label: 'Attendance',
    icon: <CalendarDays className="w-6 h-6" />,
    grad: 'from-blue-500 to-indigo-600',
    accent:
      'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-100 dark:border-blue-900/60',
    desc: 'Daily attendance records',
    requiresDates: true,
  },
  {
    key: 'ratings-csv',
    label: 'Ratings',
    icon: <Star className="w-6 h-6" />,
    grad: 'from-amber-400 to-orange-500',
    accent:
      'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-900/60',
    desc: 'Performance ratings',
    requiresDates: true,
  },
  {
    key: 'tasks-csv',
    label: 'Tasks',
    icon: <Target className="w-6 h-6" />,
    grad: 'from-violet-500 to-indigo-600',
    accent:
      'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-100 dark:border-violet-900/60',
    desc: 'Social task completion',
    requiresDates: false,
  },
];

export default function Exports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [downloading, setDownloading] = useState(null);

  const download = async (endpoint, requiresDates) => {
    if (requiresDates && (!from || !to)) {
      alert('Please select both a From and To date before downloading.');
      return;
    }

    try {
      setDownloading(endpoint);

      const params = requiresDates
        ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
        : '';

      const res = await api.get(`/reports/export/${endpoint}${params}`, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');

      a.href = url;
      a.download = requiresDates
        ? `${endpoint}-${from}-${to}.csv`
        : `${endpoint}.csv`;

      a.click();

      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.error || 'Download failed');
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="animate-fade-in-up">
      {/* Professional Header Block */}
      <div className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shadow-sm">
            <Download className="w-6 h-6" />
          </div>

          <div>
            <p className="text-xs md:text-sm uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300 font-extrabold mb-1">
              Reports
            </p>

            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Export Reports
            </h1>

            <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mt-1">
              Download CSV reports for attendance, ratings, and social tasks.
            </p>
          </div>
        </div>
      </div>

      {/* Date Range Filter Card */}
      <Card className="p-6 md:p-7 mb-7 border border-slate-200 dark:border-slate-700 bg-gradient-to-br from-white via-slate-50 to-indigo-50/60 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/60">
              <CalendarDays className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Date Range
              </h2>

              <p className="text-sm text-slate-500 dark:text-slate-400">
                Attendance and ratings exports require a valid date range.
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-bold text-slate-600 dark:text-slate-300 w-fit">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            CSV exports
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              From
            </label>

            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>

          <div className="relative">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 block">
              To
            </label>

            <Input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Export Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
        {EXPORTS.map((item) => {
          const isDisabled = item.requiresDates && (!from || !to);
          const isDownloading = downloading === item.key;

          return (
            <Card
              key={item.key}
              className={`p-6 md:p-7 min-h-[260px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-[0_14px_35px_rgba(15,23,42,0.06)] dark:shadow-none transition-all duration-300 ${
                isDisabled
                  ? 'opacity-75'
                  : 'hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(79,70,229,0.14)] dark:hover:shadow-none'
              }`}
            >
              <div className="flex h-full flex-col justify-between">
                <div>
                  <div
                    className={`w-16 h-16 rounded-3xl bg-gradient-to-br ${item.grad} text-white flex items-center justify-center shadow-lg shadow-slate-300/40 dark:shadow-none mb-6`}
                  >
                    {item.icon}
                  </div>

                  <div>
                    <h3 className="font-extrabold text-2xl text-slate-900 dark:text-white tracking-tight">
                      {item.label} CSV
                    </h3>

                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                      {item.desc}
                    </p>
                  </div>
                </div>

                <div className="mt-7">
                  {isDisabled ? (
                    <div className="inline-flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300 font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60 rounded-2xl px-3 py-2">
                      <AlertCircle className="w-4 h-4" />
                      Date range required
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isDownloading}
                      onClick={() => download(item.key, item.requiresDates)}
                      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition-all hover:gap-3 disabled:opacity-60 disabled:cursor-not-allowed ${item.accent}`}
                    >
                      {isDownloading ? 'Downloading...' : 'Download'}
                      <ArrowDownToLine className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
