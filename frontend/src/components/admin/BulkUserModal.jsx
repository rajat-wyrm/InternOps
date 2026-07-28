import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Download, CheckCircle, XCircle } from 'lucide-react';
import api from '../../lib/axios';

const ROLES = ['SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'];

const CSV_TEMPLATE = `full_name,email,password,role
John Doe,john@example.com,TempPass@123,INTERN
Jane Smith,jane@example.com,TempPass@123,TL`;

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split('\n');
  const headers = headerLine.split(',').map((h) => h.trim());
  return lines
    .filter((l) => l.trim())
    .map((line) => {
      const values = line.split(',').map((v) => v.trim());
      return Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
    });
}

function UserRow({ row }) {
  return (
    <tr className="hover:bg-slate-50">
      <td className="px-3 py-2 text-slate-700">{row.full_name || '\u2014'}</td>
      <td className="px-3 py-2 text-slate-700">{row.email}</td>
      <td className="px-3 py-2">
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[11px]">
          {row.role}
        </span>
      </td>
    </tr>
  );
}

export default function BulkUserModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [results, setResults] = useState(null);
  const [dragging, setDragging] = useState(false);

  const bulkMutation = useMutation({
    mutationFn: (users) =>
      api.post('/auth/register/bulk', { users }).then((r) => r.data),
    onSuccess: (data) => {
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });

  const processFile = (file) => {
    if (!file) return;
    setParseError('');
    setResults(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCsv(ev.target.result);
        if (!parsed.length) return setParseError('CSV is empty.');
        const invalid = parsed.filter(
          (r) => !r.email || !r.password || !ROLES.includes(r.role)
        );
        if (invalid.length)
          return setParseError(
            `${invalid.length} row(s) have missing/invalid fields (email, password, role required).`
          );
        setRows(parsed);
      } catch {
        setParseError('Failed to parse CSV. Check the format.');
      }
    };
    reader.readAsText(file);
  };

  const handleFile = (e) => processFile(e.target.files[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) {
      processFile(file);
    } else {
      setParseError('Please drop a valid .csv file.');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleSubmit = () => {
    if (!rows.length) return;
    bulkMutation.mutate(rows);
  };

  const handleClose = () => {
    setRows([]);
    setParseError('');
    setResults(null);
    setDragging(false);
    if (fileRef.current) fileRef.current.value = '';
    onClose();
  };

  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bulk_users_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg">
              📋
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Bulk Add Users
              </h2>
              <p className="text-xs text-slate-500">
                Upload a CSV to add up to 100 users at once
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Template download */}
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline"
          >
            <Download className="w-4 h-4" />
            Download CSV Template
          </button>

          {/* Drag & Drop / Upload zone */}
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition
              ${
                dragging
                  ? 'border-emerald-500 bg-emerald-50'
                  : rows.length
                    ? 'border-emerald-400 bg-emerald-50/60'
                    : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/40'
              }`}
          >
            <Upload
              className={`w-8 h-8 mx-auto mb-3 ${dragging ? 'text-emerald-500' : 'text-slate-400'}`}
            />
            {rows.length ? (
              <>
                <p className="text-sm font-semibold text-emerald-600">
                  ✓ {rows.length} users loaded
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Click or drop a new file to replace
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-slate-700">
                  {dragging
                    ? 'Drop your CSV here'
                    : 'Drag & drop your CSV here'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  or click to browse files
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFile}
            />
          </div>

          {/* Parse error */}
          {parseError && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-2.5">
              {parseError}
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !results && (
            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100 text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">Name</th>
                    <th className="px-3 py-2 text-left font-semibold">Email</th>
                    <th className="px-3 py-2 text-left font-semibold">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <UserRow key={r.email} row={r} />
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
                {results.success.length} users created successfully
              </div>
              {results.failed.length > 0 && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-1 max-h-36 overflow-y-auto">
                  <p className="text-red-600 text-xs font-semibold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    {results.failed.length} failed:
                  </p>
                  {results.failed.map((f, i) => (
                    <p key={i} className="text-red-500 text-xs">
                      {f.email} — {f.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 transition text-sm font-semibold"
          >
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && (
            <button
              onClick={handleSubmit}
              disabled={!rows.length || bulkMutation.isPending}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50 text-sm"
            >
              {bulkMutation.isPending
                ? 'Adding Users...'
                : `Add ${rows.length || 0} Users`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
