import { useState } from 'react';
import {
  Download,
  CalendarDays,
  Star,
  Target,
  ArrowDownToLine,
  AlertCircle,
} from 'lucide-react';
import { PageHeader, Card, Input } from '../../components/ui';
import api from '../../lib/axios';

const EXPORTS = [
  {
    key: 'attendance-csv',
    label: 'Attendance',
    icon: <CalendarDays className="w-6 h-6" />,
    grad: 'from-blue-500 to-indigo-600',
    desc: 'Daily attendance records',
    requiresDates: true,
  },
  {
    key: 'ratings-csv',
    label: 'Ratings',
    icon: <Star className="w-6 h-6" />,
    grad: 'from-amber-400 to-orange-500',
    desc: 'Performance ratings',
    requiresDates: true,
  },
  {
    key: 'tasks-csv',
    label: 'Tasks',
    icon: <Target className="w-6 h-6" />,
    grad: 'from-purple-500 to-fuchsia-600',
    desc: 'Social task completion',
    requiresDates: false,
  },
];

export default function Exports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const download = async (endpoint, requiresDates) => {
    if (requiresDates && (!from || !to)) {
      alert('Please select both a From and To date before downloading.');
      return;
    }
    try {
      const params = requiresDates ? `?from=${from}&to=${to}` : '';
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
    }
  };

  return (
    <div className="animate-fade-in-up">
      {/* 🚀 Professional Header Block 🚀 */}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg shadow-sm">
          <Download className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">
            Export Reports
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Download CSV data for any date range
          </p>
        </div>
      </div>

      <Card className="p-5 mb-6 border-indigo-100 shadow-sm">
        // Find this part in your return statement:
        <div className="flex flex-wrap gap-4 items-end">
          {/* Add "relative" here */}
          <div className="flex-1 min-w-[200px] relative">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
              From
            </label>
            <Input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          {/* Add "relative" here */}
          <div className="flex-1 min-w-[200px] relative">
            <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {EXPORTS.map((e) => {
          const isDisabled = e.requiresDates && (!from || !to);
          return (
            <Card
              key={e.key}
              className={`p-6 transition-all duration-300 ${isDisabled ? 'opacity-60 grayscale' : 'hover:shadow-md hover:border-indigo-200'}`}
            >
              <div
                className={
                  !isDisabled ? 'cursor-pointer' : 'cursor-not-allowed'
                }
                onClick={() => !isDisabled && download(e.key, e.requiresDates)}
              >
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${e.grad} text-white flex items-center justify-center shadow-md mb-4`}
                >
                  {e.icon}
                </div>

                <h3 className="font-bold text-gray-900 text-lg mb-1">
                  {e.label} CSV
                </h3>
                <p className="text-sm text-gray-500 mb-6">{e.desc}</p>

                {isDisabled ? (
                  <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Date range required
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-indigo-600 text-sm font-semibold hover:gap-3 transition-all">
                    Download <ArrowDownToLine className="w-4 h-4" />
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
