import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Upload, Download, CheckCircle, XCircle } from 'lucide-react';
import api from '../../lib/axios';

const ROLES = ['SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN'];

const CSV_TEMPLATE = `fullName,email,password,role
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

export default function BulkUserModal({ open, onClose }) {
  const queryClient = useQueryClient();
  const fileRef = useRef(null);
  const [rows, setRows] = useState([]);
  const [parseError, setParseError] = useState('');
  const [results, setResults] = useState(null);

  const bulkMutation = useMutation({
    mutationFn: (users) =>
      api.post('/auth/register/bulk', { users }).then((r) => r.data),
    onSuccess: (data) => {
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] });
    },
  });

  const handleFile = (e) => {
    setParseError('');
    setResults(null);
    const file = e.target.files[0];
    if (!file) return;
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

  const handleSubmit = () => {
    if (!rows.length) return;
    bulkMutation.mutate(rows);
  };

  const handleClose = () => {
    setRows([]);
    setParseError('');
    setResults(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl text-white">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-green/10 text-brand-green flex items-center justify-center text-lg">
              📋
            </div>
            <div>
              <h2 className="text-lg font-bold">Bulk Add Users</h2>
              <p className="text-xs text-gray-400">
                Upload a CSV to add up to 100 users at once
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-lg hover:bg-gray-800 flex items-center justify-center text-gray-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          {/* Template download */}
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-2 text-sm text-brand-green hover:underline"
          >
            <Download className="w-4 h-4" />
            Download CSV Template
          </button>

          {/* File upload */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-brand-green transition"
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-gray-500" />
            <p className="text-sm text-gray-400">
              {rows.length
                ? `✓ ${rows.length} users loaded from CSV`
                : 'Click to upload CSV file'}
            </p>
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
            <div className="bg-error/10 border border-error/40 text-error text-sm rounded-lg px-4 py-2.5">
              {parseError}
            </div>
          )}

          {/* Preview table */}
          {rows.length > 0 && !results && (
            <div className="rounded-xl border border-gray-700 overflow-hidden max-h-48 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-800 text-gray-400">
                  <tr>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Email</th>
                    <th className="px-3 py-2 text-left">Role</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {rows.map((r, i) => (
                    <tr key={i} className="hover:bg-gray-800/50">
                      <td className="px-3 py-2">{r.fullName || '—'}</td>
                      <td className="px-3 py-2">{r.email}</td>
                      <td className="px-3 py-2">{r.role}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Results */}
          {results && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-brand-green text-sm font-semibold">
                <CheckCircle className="w-4 h-4" />
                {results.success.length} users created successfully
              </div>
              {results.failed.length > 0 && (
                <div className="rounded-xl border border-error/40 bg-error/10 p-3 space-y-1 max-h-36 overflow-y-auto">
                  <p className="text-error text-xs font-semibold flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" />
                    {results.failed.length} failed:
                  </p>
                  {results.failed.map((f, i) => (
                    <p key={i} className="text-error text-xs">
                      {f.email} — {f.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-800 mt-6">
          <button
            onClick={handleClose}
            className="px-4 py-2 rounded-lg border border-gray-700 text-white hover:bg-gray-800 transition text-sm font-semibold"
          >
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && (
            <button
              onClick={handleSubmit}
              disabled={!rows.length || bulkMutation.isPending}
              className="px-5 py-2 rounded-lg bg-brand-green hover:opacity-90 text-slate-950 font-bold transition disabled:opacity-50 text-sm"
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