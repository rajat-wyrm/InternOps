import { useState } from 'react';
import { PageHeader, Card, Input } from '../../components/ui';
import api from '../../lib/axios';

const EXPORTS = [
  {
    key: 'attendance-csv',
    label: 'Attendance',
    icon: '📅',
    grad: 'from-blue-500 to-indigo-600',
    desc: 'Daily attendance records',
  },
  {
    key: 'ratings-csv',
    label: 'Ratings',
    icon: '⭐',
    grad: 'from-amber-400 to-orange-500',
    desc: 'Performance ratings',
  },
  {
    key: 'tasks-csv',
    label: 'Tasks',
    icon: '🎯',
    grad: 'from-purple-500 to-fuchsia-600',
    desc: 'Social task completion',
  },
];

export default function Exports() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  // window.open() navigates the browser directly, so the Axios Authorization
  // header is never attached and the request hits the auth-guarded export
  // routes unauthenticated (401). Fetch the CSV through the Axios instance with
  // a blob response, then trigger the download from the response — same pattern
  // as Team.jsx's exportCsv.
  const download = async (endpoint) => {
    if (!from || !to) return alert('Please select a date range first');
    try {
      const res = await api.get(
        `/reports/export/${endpoint}?from=${from}&to=${to}`,
        {
          responseType: 'blob',
        }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${endpoint}-${from}-${to}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.response?.data?.error || 'Download failed');
    }
  };

  return (
    <div>
      <PageHeader
        title="Export Reports"
        icon="⬇️"
        subtitle="Download CSV data for any date range"
      />

      <Card className="p-4 mb-5 flex gap-4 items-end flex-wrap">
        <div>
          <label className="text-xs text-gray-500">From</label>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500">To</label>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {EXPORTS.map((e) => (
          <Card key={e.key} className="p-5 card-hover cursor-pointer" hover>
            <div onClick={() => download(e.key)}>
              <div
                className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${e.grad} text-white flex items-center justify-center text-2xl shadow-lg mb-3`}
              >
                {e.icon}
              </div>
              <h3 className="font-bold text-gray-800">{e.label} CSV</h3>
              <p className="text-sm text-gray-500 mb-3">{e.desc}</p>
              <span className="text-indigo-600 text-sm font-semibold">
                ⬇ Download →
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
