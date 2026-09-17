import { useMemo, useState } from 'react';

const STATUS_OPTIONS = ['present', 'absent', 'leave'];
const COLUMN_OPTIONS = [
  { key: 'name', label: 'Employee Name' },
  { key: 'id', label: 'Employee ID' },
  { key: 'department', label: 'Department' },
  { key: 'date', label: 'Date' },
  { key: 'status', label: 'Attendance Status' },
];

const DEFAULT_COLUMNS = ['name', 'id', 'department', 'date', 'status'];

function AttendanceReport() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [departments] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [roles] = useState([]);
  const [employees] = useState([]);
  const [columns, setColumns] = useState(DEFAULT_COLUMNS);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleValue = (value, setter) => {
    setter((current) =>
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    );
  };

  const applyPreset = (preset) => {
    const today = new Date();
    const start = new Date(today);

    if (preset === 'week') {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1;
      start.setDate(today.getDate() - diff);
    }

    if (preset === 'month') {
      start.setDate(1);
    }

    if (preset === 'quarter') {
      const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
      start.setMonth(quarterStartMonth, 1);
    }

    setFrom(start.toISOString().slice(0, 10));
    setTo(today.toISOString().slice(0, 10));
  };

  const generateReport = async () => {
    setError('');

    if (!from || !to) {
      setError('Please select both From and To dates.');
      return;
    }

    if (from > to) {
      setError('From date must be earlier than To date.');
      return;
    }

    try {
      setLoading(true);

      const params = new URLSearchParams({
        from,
        to,
        departments: departments.join(','),
        statuses: statuses.join(','),
        roles: roles.join(','),
        employees: employees.join(','),
      });

      const response = await fetch(
        `/api/v1/attendance/report?${params.toString()}`,
        {
          credentials: 'include',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to generate attendance report.');
      }

      const data = await response.json();
      setRows(data.rows || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const visibleRows = useMemo(() => {
    return rows.map((row) => {
      const result = {};

      columns.forEach((column) => {
        result[column] = row[column] ?? '';
      });

      return result;
    });
  }, [rows, columns]);

  const exportCSV = () => {
    if (!visibleRows.length) return;

    const header = columns.map(
      (column) =>
        COLUMN_OPTIONS.find((item) => item.key === column)?.label || column
    );

    const body = visibleRows.map((row) =>
      columns.map(
        (column) => `"${String(row[column] ?? '').replaceAll('"', '""')}"`
      )
    );

    const csv = [header, ...body].map((line) => line.join(',')).join('\n');

    const blob = new Blob([csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `attendance-report-${from}-to-${to}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  };

  const exportExcel = () => {
    if (!visibleRows.length) return;

    const header = columns.map(
      (column) =>
        COLUMN_OPTIONS.find((item) => item.key === column)?.label || column
    );

    const tableRows = visibleRows
      .map(
        (row) => `
        <tr>
          ${columns.map((column) => `<td>${row[column] ?? ''}</td>`).join('')}
        </tr>
      `
      )
      .join('');

    const table = `
  <table border="1">
    <thead>
      <tr>
        ${header.map((item) => `<th>${item}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${tableRows}
    </tbody>
  </table>
`;

    const blob = new Blob([table], {
      type: 'application/vnd.ms-excel',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `attendance-report-${from}-to-${to}.xls`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Attendance Reports
          </h1>

          <p className="text-sm text-slate-500 mt-1">
            Generate customized attendance reports using filters and selected
            columns.
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6 space-y-6">
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white mb-3">
              Date Range
            </h2>

            <div className="flex flex-wrap gap-3 mb-4">
              <button
                onClick={() => applyPreset('week')}
                className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700"
              >
                This Week
              </button>

              <button
                onClick={() => applyPreset('month')}
                className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700"
              >
                This Month
              </button>

              <button
                onClick={() => applyPreset('quarter')}
                className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700"
              >
                This Quarter
              </button>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />

              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-3">Attendance Status</h2>

            <div className="flex gap-4 flex-wrap">
              {STATUS_OPTIONS.map((status) => (
                <label key={status} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={statuses.includes(status)}
                    onChange={() => toggleValue(status, setStatuses)}
                  />

                  {status}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h2 className="font-semibold mb-3">Report Columns</h2>

            <div className="flex flex-wrap gap-4">
              {COLUMN_OPTIONS.map((column) => (
                <label key={column.key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={columns.includes(column.key)}
                    onChange={() => toggleValue(column.key, setColumns)}
                  />

                  {column.label}
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 text-red-700 px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={generateReport}
            disabled={loading}
            className="px-5 py-2.5 rounded-lg bg-indigo-600 text-white font-medium disabled:opacity-50"
          >
            {loading ? 'Generating...' : 'Generate Report'}
          </button>
        </div>

        {rows.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-xl border p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-semibold text-lg">Report Preview</h2>

              <div className="flex gap-2">
                <button
                  onClick={exportCSV}
                  className="px-3 py-2 rounded-lg border"
                >
                  CSV
                </button>

                <button
                  onClick={exportExcel}
                  className="px-3 py-2 rounded-lg border"
                >
                  Excel
                </button>

                <button
                  onClick={exportPDF}
                  className="px-3 py-2 rounded-lg border"
                >
                  PDF
                </button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    {columns.map((column) => (
                      <th key={column} className="text-left p-3">
                        {COLUMN_OPTIONS.find((item) => item.key === column)
                          ?.label || column}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {visibleRows.map((row, index) => (
                    <tr key={index} className="border-b">
                      {columns.map((column) => (
                        <td key={column} className="p-3">
                          {row[column]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AttendanceReport;
