import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  LockKeyhole,
  Maximize2,
  Minimize2,
  RefreshCw,
  Search,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import api from '../../lib/axios';
import CustomSelect from '../CustomSelect';
import { Btn, Card, Spinner } from '../ui';
import { createPortal } from 'react-dom';

const SUMMARY_LABELS = {
  attendanceSheets: 'Attendance sheets',
  ignoredSheets: 'Ignored sheets',
  skippedSheets: 'Skipped sheets',
  uniqueInterns: 'Unique interns',
  attendanceRecords: 'Attendance records',
  reviewRequired: 'Review required',
  warnings: 'Warnings',
  databaseMatched: 'Matched in Neon',
  databaseNewCandidates: 'New candidates',
  databaseAmbiguous: 'Ambiguous matches',
  databaseProfileDifferences: 'Profile differences',
  databaseNewAttendance: 'New attendance',
  databaseUnchangedAttendance: 'Attendance unchanged',
  databaseAttendanceConflicts: 'Neon attendance conflicts',
  databaseUnmatchedAttendance: 'Workbook attendance awaiting account creation',
  accountPlanTotal: 'Workbook interns',
  accountPlanActive: 'Active interns',
  accountPlanEligible: 'Accounts eligible',
  accountPlanNonActiveExcluded: 'Non-active excluded',
  accountPlanMissingEmail: 'Missing email',
  accountPlanInvalidGmail: 'Invalid email',
  accountPlanMissingInternCode: 'Missing intern code',
  accountPlanIncompleteIdentitySkipped: 'Incomplete identity rows skipped',
  accountPlanExistingUser: 'Existing users',
  accountPlanExistingLeadershipReused: 'Existing leadership accounts reused',
  accountPlanPeopleReceivingAttendance: 'People receiving attendance',
  accountPlanManualReview: 'Manual review',
  accountPlanAttendanceExcluded: 'Non-active attendance excluded',
  accountPlanAttendanceToImport: 'Active attendance to import',
  sheet: 'Primary email sheet',
  fallbackSheet: 'Fallback email sheet',
  primaryRows: 'Primary email rows',
  fallbackRows: 'Fallback email rows',
  emailProfileRows: 'Email profile rows',
  emailMatchedByPhone: 'Emails matched by mobile',
  emailMatchedByCode: 'Emails matched by intern code',
  emailUnmatchedActive: 'Unmatched active interns',
  emailIdentityConflicts: 'Email identity conflicts',
  emailInvalidOrMissing: 'Invalid or missing profile email',
  emailMatchedFromInternDetails: 'Emails from Intern Details fallback',
  accountPlanStatusVerification: 'Status verification required',
  accountPlanInternCodesToCorrect: 'Intern codes to correct',
  emailProfilesSupplemented: 'Email profiles supplemented',
  emailInternsProfilesSupplemented: 'Intern profiles supplemented',
  emailSupplementAmbiguous: 'Ambiguous email supplements',
  fullDetailsSheet: 'Full details sheet',
  masterSheet: 'Master sheet',
  masterRows: 'Master rows',
  internsSheet: 'Interns sheet',
  internsRows: 'Intern rows',
  activeInterns: 'Active interns',
  incompleteIdentitySkipped: 'Incomplete identity rows skipped',
  nonActiveExcluded: 'Non-active interns excluded',
  accountsCreated: 'Accounts created',
  existingAccounts: 'Existing accounts',
  existingInternAccountsReused: 'Existing intern accounts reused',
  existingLeadershipAccountsReused: 'Existing leadership accounts reused',
  peopleReceivingAttendance: 'People receiving attendance',
  attendanceCreated: 'Attendance records created',
  attendanceUnchanged: 'Attendance records unchanged',
  attendanceKeptExisting: 'Attendance conflicts kept existing',
  attendanceUpdatedFromWorkbook: 'Attendance updated from workbook',
  internCodesCorrected: 'Intern codes corrected',
  ratingSheets: 'Rating sheets',
  ratingRecords: 'Rating records',
  ratingScoreRecords: 'Rating score records',
  ratingReasonOnlyRecords: 'Rating reason-only records',
  ratingEmptyWeekRecords: 'Rating empty-week records',
  ratingIdentityMissing: 'Rating identity missing',
  ratingIdentityConflicts: 'Rating identity conflicts',
  ratingNonNumericExcluded: 'Rating non-numeric excluded',
  ratingAfterCompletionExcluded: 'Ratings after completion excluded',
  ratingUnsupportedSheets: 'Rating unsupported sheets',
  ratingsCreated: 'Ratings created',
  ratingsUnchanged: 'Ratings unchanged',
  ratingsFilled: 'Ratings filled',
  ratingsConflicting: 'Rating conflicts',
  profilePhonesEnriched: 'Profile phones enriched',
  profileFieldsEnriched: 'Profile fields enriched',
  profileFieldsCorrected: 'Profile fields corrected',
  profileValuesAlreadyCorrect: 'Profile values already correct',
  newInternAccounts: 'New intern accounts',
};

const STATUS_STYLES = {
  ACTIVE:
    'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
  COMPLETED:
    'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300',
  TERMINATED:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300',
  DISCONTINUED:
    'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value) {
  if (!value) return 'Blank';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function StatusBadge({ value }) {
  const status = value || 'UNKNOWN';
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${
        STATUS_STYLES[status] ||
        'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
      }`}
    >
      {status}
    </span>
  );
}

function AttendanceBadge({ value }) {
  const isLeave = value === 'LEAVE';
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-extrabold ${
        isLeave
          ? 'border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-300'
          : 'border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
      }`}
    >
      {value}
    </span>
  );
}

export default function WorkbookImportModal({ open, onClose }) {
  const [file, setFile] = useState(null);
  const [emailFile, setEmailFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [resolutions, setResolutions] = useState({});
  const [databaseResolutions, setDatabaseResolutions] = useState({});
  const [error, setError] = useState('');
  const [duplicateReview, setDuplicateReview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [search, setSearch] = useState('');
  const [visibleRows, setVisibleRows] = useState(20);
  const [departmentId, setDepartmentId] = useState('');
  const [managerId, setManagerId] = useState('');
  const [departments, setDepartments] = useState([]);
  const [managers, setManagers] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const modalBodyRef = useRef(null);

  const toggleExpanded = () => {
    setIsExpanded((current) => !current);
    requestAnimationFrame(() => {
      modalBodyRef.current?.scrollTo({ top: 0, behavior: 'auto' });
    });
  };

  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    api
      .get('/departments')
      .then((response) => setDepartments(response.data || []))
      .catch(() => setDepartments([]));
  }, [open]);

  useEffect(() => {
    if (!departmentId) {
      setManagers([]);
      setManagerId('');
      return;
    }
    api
      .get(`/departments/${departmentId}/teams`)
      .then((response) => setManagers(response.data || []))
      .catch(() => setManagers([]));
  }, [departmentId]);

  const unresolvedWorkbookCount = useMemo(() => {
    if (!preview) return 0;
    return preview.conflicts.filter((conflict) => !resolutions[conflict.id])
      .length;
  }, [preview, resolutions]);
  const databaseConflicts =
    preview?.databaseComparison?.databaseConflicts || [];
  const unresolvedDatabaseCount = databaseConflicts.filter(
    (conflict) => !databaseResolutions[conflict.id]
  ).length;
  const keptExistingCount = databaseConflicts.filter(
    (conflict) => databaseResolutions[conflict.id] === 'KEEP_EXISTING'
  ).length;
  const useWorkbookCount = databaseConflicts.filter(
    (conflict) => databaseResolutions[conflict.id] === 'USE_WORKBOOK'
  ).length;
  const unresolvedCount = unresolvedWorkbookCount + unresolvedDatabaseCount;

  const filteredInterns = useMemo(() => {
    if (!preview) return [];
    const query = search.trim().toLowerCase();
    if (!query) return preview.interns;
    return preview.interns.filter((intern) =>
      [intern.name, intern.code, intern.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [preview, search]);

  const accountPlanDisplayCounts = useMemo(() => {
    if (!preview?.accountPlan) return [];
    const counts = { ...preview.accountPlan.counts };
    const allAttendance = Number(preview.summary?.attendanceRecords || 0);
    const activeAttendance = Number(counts.accountPlanAttendanceToImport || 0);
    counts.accountPlanAttendanceExcluded = Math.max(
      0,
      allAttendance - activeAttendance
    );
    return Object.entries(counts);
  }, [preview]);

  if (!open) return null;

  const clearFile = () => {
    setFile(null);
    setEmailFile(null);
    setPreview(null);
    setResolutions({});
    setDatabaseResolutions({});
    setSearch('');
    setVisibleRows(20);
    setError('');
    setDuplicateReview([]);
    setImportResult(null);
  };

  const runPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setDuplicateReview([]);
    setPreview(null);
    setResolutions({});
    setDatabaseResolutions({});
    setSearch('');
    setVisibleRows(20);
    try {
      const form = new FormData();
      form.append('workbook', file);
      if (emailFile) form.append('emailWorkbook', emailFile);
      const response = await api.post('/workbook-imports/preview', form, {
        params: {
          departmentId: departmentId || undefined,
          managerId: managerId || undefined,
        },
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
        _suppressGlobalError: true,
      });
      setPreview(response.data);
      setDatabaseResolutions({});
      setImportResult(null);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
          requestError.message ||
          'Preview failed'
      );
    } finally {
      setLoading(false);
    }
  };

  const chooseResolution = (conflictId, value) => {
    setResolutions((current) => ({ ...current, [conflictId]: value }));
  };
  const chooseDatabaseResolution = (conflictId, value) => {
    setDatabaseResolutions((current) => ({
      ...current,
      [conflictId]: value,
    }));
  };
  const resolveAllDatabaseConflicts = (value) => {
    setDatabaseResolutions(
      Object.fromEntries(
        databaseConflicts.map((conflict) => [conflict.id, value])
      )
    );
  };

  const canImport = Boolean(
    preview &&
    file &&
    emailFile &&
    departmentId &&
    managerId &&
    preview.emailPreviewFingerprint &&
    preview.accountPlan?.writesAllowed &&
    !preview.importBlocked &&
    unresolvedCount === 0 &&
    !loading &&
    !importing &&
    !importResult
  );

  const runImport = async () => {
    if (!canImport) return;
    const active = preview.accountPlan.counts.accountPlanActive || 0;
    const attendance =
      preview.accountPlan.counts.accountPlanAttendanceToImport || 0;
    const confirmed = window.confirm(
      `Import ${active} current intern(s), ${attendance} attendance record(s), and valid weekly ratings into Neon? Incomplete rows with no email, mobile, or Intern Code will be skipped. This operation is transactional.`
    );
    if (!confirmed) return;

    setImporting(true);
    setError('');
    setDuplicateReview([]);
    try {
      const form = new FormData();
      form.append('workbook', file);
      form.append('emailWorkbook', emailFile);
      form.append('attendanceResolutions', JSON.stringify(databaseResolutions));
      const response = await api.post('/workbook-imports/execute', form, {
        params: {
          departmentId,
          managerId,
          previewFingerprint: preview.previewFingerprint,
          emailPreviewFingerprint: preview.emailPreviewFingerprint,
        },
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 600000,
        _suppressGlobalError: true,
      });
      setImportResult(response.data);
    } catch (requestError) {
      setDuplicateReview(requestError.response?.data?.duplicates || []);
      setError(
        requestError.response?.data?.error ||
          requestError.message ||
          'Import failed. No partial records were kept. Preview again before retrying.'
      );
    } finally {
      setImporting(false);
    }
  };

  const modal = (
    <div className="internops-modal-backdrop fixed inset-0 z-[9999] bg-slate-950/60 backdrop-blur-sm">
      <div
        className={`flex h-full w-full items-center justify-center overflow-y-auto ${
          isExpanded ? 'p-2' : 'p-4'
        }`}
      >
        <section
          aria-modal="true"
          role="dialog"
          aria-labelledby="workbook-import-title"
          className={`flex w-full flex-col overflow-hidden border border-slate-200 bg-white shadow-lg shadow-slate-900/10 transition-[max-width,height,max-height,border-radius] duration-200 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/25 ${
            isExpanded
              ? 'h-[calc(100vh-1rem)] max-h-[calc(100vh-1rem)] max-w-[calc(100vw-1rem)] rounded-xl'
              : 'max-h-[calc(100vh-2rem)] max-w-5xl rounded-2xl'
          }`}
        >
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900 sm:px-7 sm:py-5">
            <div className="flex min-w-0 items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-2.5 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <h2
                  id="workbook-import-title"
                  className="truncate text-xl font-extrabold text-slate-950 dark:text-white"
                >
                  Preview Intern Workbook
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Preview first, then import only after all safety checks pass.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={toggleExpanded}
                aria-label={
                  isExpanded
                    ? 'Restore workbook preview size'
                    : 'Expand workbook preview'
                }
                title={isExpanded ? 'Restore size' : 'Expand preview'}
                className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {isExpanded ? (
                  <Minimize2 className="h-5 w-5" />
                ) : (
                  <Maximize2 className="h-5 w-5" />
                )}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close workbook preview"
                className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div
            ref={modalBodyRef}
            data-testid="workbook-modal-body"
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-7"
          >
            <div className="space-y-5">
              <Card className="p-4 sm:p-5">
                {!file ? (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 py-8 text-center transition hover:border-emerald-500 hover:bg-emerald-50/50 dark:border-slate-700 dark:bg-slate-950/40 dark:hover:border-emerald-500 dark:hover:bg-emerald-950/20">
                    <Upload className="mb-3 h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                    <span className="font-extrabold text-slate-900 dark:text-white">
                      Choose an Excel workbook
                    </span>
                    <span className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      .xlsx only, maximum 10 MB
                    </span>
                    <input
                      type="file"
                      accept=".xlsx"
                      className="sr-only"
                      onChange={(event) => {
                        setFile(event.target.files?.[0] || null);
                        setPreview(null);
                        setResolutions({});
                        setError('');
                      }}
                    />
                  </label>
                ) : (
                  <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileSpreadsheet className="h-8 w-8 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <div className="min-w-0">
                        <div className="truncate font-bold text-slate-950 dark:text-white">
                          {file.name}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {formatBytes(file.size)} | XLSX workbook
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700">
                        <RefreshCw className="h-4 w-4" />
                        Replace
                        <input
                          type="file"
                          accept=".xlsx"
                          className="sr-only"
                          onChange={(event) => {
                            setFile(event.target.files?.[0] || null);
                            setPreview(null);
                            setResolutions({});
                            setError('');
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={clearFile}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={runPreview}
                        disabled={loading}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-extrabold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-400"
                      >
                        <Upload className="h-4 w-4" />
                        {loading
                          ? 'Parsing...'
                          : preview
                            ? 'Preview again'
                            : 'Preview workbook'}
                      </button>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-extrabold text-slate-900 dark:text-white">
                      Intern Email Details workbook
                    </div>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Used only to match email addresses. Full details is
                      primary; Intern Details is a mobile-only fallback.
                      Attendance records, status, and completion dates remain
                      authoritative.
                    </div>
                    {emailFile && (
                      <div className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                        {emailFile.name} | {formatBytes(emailFile.size)}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {emailFile && (
                      <button
                        type="button"
                        onClick={() => {
                          setEmailFile(null);
                          setPreview(null);
                          setResolutions({});
                          setDatabaseResolutions({});
                          setError('');
                        }}
                        className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                      >
                        Clear email workbook
                      </button>
                    )}
                    <label className="inline-flex cursor-pointer items-center gap-2 whitespace-nowrap rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100">
                      <Upload className="h-4 w-4" />
                      {emailFile
                        ? 'Replace email workbook'
                        : 'Choose email workbook'}
                      <input
                        type="file"
                        accept=".xlsx"
                        className="sr-only"
                        onChange={(event) => {
                          setEmailFile(event.target.files?.[0] || null);
                          setPreview(null);
                          setError('');
                        }}
                      />
                    </label>
                  </div>
                </div>
              </Card>
              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950/40 md:grid-cols-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Assign to department
                  <CustomSelect
                    value={departmentId}
                    onChange={(value) => {
                      setDepartmentId(value);
                      setManagerId('');
                      setPreview(null);
                    }}
                    options={[
                      { value: '', label: 'Select department' },
                      ...departments.map((department) => ({
                        value: department.id,
                        label: department.name,
                      })),
                    ]}
                    placeholder="Select department"
                    className="mt-2 w-full"
                    searchable
                  />
                </label>
                <label className="text-sm font-bold text-slate-700 dark:text-slate-200">
                  Assign direct manager
                  <CustomSelect
                    value={managerId}
                    onChange={(value) => {
                      setManagerId(value);
                      setPreview(null);
                    }}
                    options={[
                      {
                        value: '',
                        label: 'Select Senior TL, TL, or Captain',
                      },
                      ...managers.map((manager) => ({
                        value: manager.lead_id,
                        label: `${manager.lead_name} (${manager.role})`,
                      })),
                    ]}
                    placeholder="Select Senior TL, TL, or Captain"
                    disabled={!departmentId}
                    className="mt-2 w-full"
                    searchable
                  />
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 md:col-span-2">
                  The selected direct manager applies only to newly created
                  accounts. Existing accounts keep their current valid manager
                  in this department. Preview remains read-only until import is
                  confirmed.
                </p>
              </div>

              {loading && <Spinner label="Parsing workbook safely..." />}
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                  <div className="flex gap-2">
                    <AlertTriangle className="h-5 w-5 shrink-0" />
                    <span>{error}</span>
                  </div>
                  {duplicateReview.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {duplicateReview.map((item) => (
                        <div
                          key={`${item.field}-${item.value}`}
                          className="rounded-xl border border-red-200 bg-white/70 p-3 text-sm dark:border-red-800 dark:bg-slate-900/60"
                        >
                          <div className="font-extrabold">
                            Duplicate {item.label}: {item.value}
                          </div>
                          <div className="mt-1">
                            {item.interns
                              .map(
                                (intern) =>
                                  `${intern.name} (${intern.code || 'No Intern Code'})`
                              )
                              .join(' and ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {importResult && (
                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100">
                  <div className="flex items-center gap-2 font-extrabold">
                    <CheckCircle2 className="h-5 w-5" />
                    Import completed successfully
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
                    {Object.entries(importResult.summary || {}).map(
                      ([key, value]) => (
                        <div
                          key={key}
                          className="rounded-xl border border-emerald-200 bg-white/70 p-2 dark:border-emerald-800 dark:bg-slate-900/50"
                        >
                          <div className="font-extrabold">
                            {value.toLocaleString()}
                          </div>
                          <div className="break-words text-xs leading-relaxed">
                            {SUMMARY_LABELS[key] ||
                              key
                                .replaceAll(/([A-Z])/g, ' $1')
                                .replaceAll('_', ' ')
                                .trim()
                                .toLowerCase()
                                .replace(/^./, (character) =>
                                  character.toUpperCase()
                                )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {preview && (
                <>
                  <div className="grid auto-rows-min gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {Object.entries(preview.summary).map(([key, value]) => (
                      <Card key={key} className="p-4">
                        <div className="text-2xl font-extrabold text-slate-950 dark:text-white">
                          {value.toLocaleString()}
                        </div>
                        <div className="mt-1 break-words text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                          {SUMMARY_LABELS[key] ||
                            key
                              .replaceAll(/([A-Z])/g, ' $1')
                              .replaceAll('_', ' ')
                              .trim()}
                        </div>
                      </Card>
                    ))}
                  </div>

                  {preview.accountPlan && (
                    <Card className="p-5 border-emerald-200 dark:border-emerald-800">
                      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                          <h4 className="text-base font-extrabold text-slate-900 dark:text-white">
                            Reviewed account assignment
                          </h4>
                          <p className="mt-1 break-words text-sm leading-relaxed text-slate-500 dark:text-slate-400">
                            Role: INTERN {' | '} Department:{' '}
                            {preview.accountPlan.department?.name} {' | '}{' '}
                            Direct manager:{' '}
                            {preview.accountPlan.manager?.full_name}
                          </p>
                        </div>
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          {preview.accountPlan.writesAllowed
                            ? 'Ready after final confirmation'
                            : 'Import blocked'}
                        </span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                        {accountPlanDisplayCounts.map(([key, value]) => (
                          <div
                            key={key}
                            className="min-w-0 overflow-hidden rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                          >
                            <p className="text-lg font-extrabold text-slate-900 dark:text-white">
                              {value.toLocaleString()}
                            </p>
                            <p className="break-words text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                              {SUMMARY_LABELS[key] ||
                                key
                                  .replaceAll(/([A-Z])/g, ' $1')
                                  .replaceAll('_', ' ')
                                  .trim()}
                            </p>
                          </div>
                        ))}
                      </div>
                      {preview.accountPlan.manualReview?.length > 0 && (
                        <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50/60 p-4 dark:border-orange-800 dark:bg-orange-950/20">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <h5 className="font-extrabold text-slate-900 dark:text-white">
                                Manual review items
                              </h5>
                              <p className="text-sm text-slate-600 dark:text-slate-300">
                                Shows the exact attendance source while keeping
                                email addresses and full phone numbers hidden.
                              </p>
                            </div>
                            <span className="text-sm font-bold text-orange-700 dark:text-orange-300">
                              {preview.accountPlan.manualReview.length} records
                            </span>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {preview.accountPlan.manualReview.map((item) => (
                              <div
                                key={`${item.name}-${item.maskedPhone}-${item.reasons.join('-')}`}
                                className="rounded-xl border border-orange-200 bg-white p-3 dark:border-orange-800 dark:bg-slate-900"
                              >
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {item.name}
                                </div>
                                <div className="mt-1 break-words text-xs font-semibold leading-relaxed text-slate-500 dark:text-slate-400">
                                  Mobile: {item.maskedPhone}
                                </div>
                                <div className="mt-2 space-y-1">
                                  {item.sources.length > 0 ? (
                                    item.sources.map((source) => (
                                      <div
                                        key={`${source.sheet}-${source.row}`}
                                        className="text-xs text-slate-600 dark:text-slate-300"
                                      >
                                        Attendance source: {source.sheet}, row{' '}
                                        {source.row}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                      Attendance source unavailable
                                    </div>
                                  )}
                                </div>
                                {(item.emailProfileSource ||
                                  item.latestAttendanceCompletionDate ||
                                  item.completionDateHistory?.length) && (
                                  <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-300">
                                    {item.emailProfileSource && (
                                      <div>
                                        Email profile: {item.emailProfileSource}
                                        {item.emailProfileRow
                                          ? `, row ${item.emailProfileRow}`
                                          : ''}
                                      </div>
                                    )}
                                    {item.latestAttendanceCompletionDate && (
                                      <div>
                                        Latest attendance completion date:{' '}
                                        {formatDate(
                                          item.latestAttendanceCompletionDate
                                        )}
                                        {item.latestAttendanceCompletionSource
                                          ? ` (${item.latestAttendanceCompletionSource.sheet}, row ${item.latestAttendanceCompletionSource.row})`
                                          : ''}
                                      </div>
                                    )}
                                    {item.completionDateHistory?.length > 0 && (
                                      <div className="mt-2">
                                        <div className="font-bold text-slate-700 dark:text-slate-200">
                                          Completion-date history
                                        </div>
                                        {item.completionDateHistory.map(
                                          (source) => (
                                            <div
                                              key={`${source.sheet}-${source.row}-${source.date}`}
                                            >
                                              {source.sheet}, row {source.row}:{' '}
                                              {formatDate(source.date)}
                                            </div>
                                          )
                                        )}
                                      </div>
                                    )}
                                    {item.effectiveCompletionDate && (
                                      <div className="font-bold text-slate-800 dark:text-slate-100">
                                        Effective completion date:{' '}
                                        {formatDate(
                                          item.effectiveCompletionDate
                                        )}
                                      </div>
                                    )}
                                    {item.extensionDetected && (
                                      <div className="font-bold text-emerald-700 dark:text-emerald-300">
                                        Extension detected from newer attendance
                                        data
                                      </div>
                                    )}
                                  </div>
                                )}
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {item.reasons.map((reason) => (
                                    <span
                                      key={reason}
                                      className="rounded-full border border-orange-200 bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800 dark:border-orange-700 dark:bg-orange-950 dark:text-orange-200"
                                    >
                                      {reason.replaceAll('_', ' ')}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {!preview.accountPlan.passwordChangeEnforcementReady && (
                        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                          First-login password change is required by policy, but
                          a reviewed database migration is still needed before
                          it can be enforced. Account creation remains disabled.
                        </p>
                      )}
                    </Card>
                  )}

                  <Card className="overflow-hidden">
                    <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                      <h3 className="font-extrabold text-slate-950 dark:text-white">
                        Workbook sheets
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-[760px] w-full text-sm">
                        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                          <tr>
                            <th className="px-5 py-3">Sheet</th>
                            <th className="px-5 py-3 text-right">Rows</th>
                            <th className="px-5 py-3 text-right">
                              Date columns
                            </th>
                            <th className="px-5 py-3">Handling</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.sheets.map((sheet) => (
                            <tr
                              key={sheet.sheet}
                              className="border-t border-slate-200 dark:border-slate-700"
                            >
                              <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-900 dark:text-white">
                                {sheet.sheet}
                              </td>
                              <td className="px-5 py-3 text-right tabular-nums">
                                {sheet.internRows}
                              </td>
                              <td className="px-5 py-3 text-right tabular-nums">
                                {sheet.dateColumns || 0}
                              </td>
                              <td className="px-5 py-3 text-slate-600 dark:text-slate-300">
                                {sheet.ignored
                                  ? sheet.sheet
                                      .toLowerCase()
                                      .startsWith('ratings')
                                    ? 'Not included in this attendance-only import'
                                    : `Ignored: ${sheet.ignoreReason}`
                                  : sheet.skipped
                                    ? `Skipped: ${sheet.skipReason}`
                                    : `${sheet.warnings?.length || 0} warnings`}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {preview.conflicts.length > 0 && (
                    <Card className="border-amber-300 dark:border-amber-700">
                      <div className="flex items-start gap-3 border-b border-amber-200 px-5 py-4 dark:border-amber-800">
                        <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-amber-600 dark:text-amber-400" />
                        <div>
                          <h3 className="font-extrabold text-slate-950 dark:text-white">
                            Review required
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Resolve each attendance conflict. Completion-date
                            differences are shown separately and are not
                            resolved by the attendance selection.
                          </p>
                        </div>
                      </div>

                      <div className="space-y-4 p-4 sm:p-5">
                        {preview.conflicts.map((conflict) => (
                          <div
                            key={conflict.id}
                            className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30"
                          >
                            <div className="mb-4 flex flex-wrap items-center gap-2">
                              <span className="font-extrabold text-slate-950 dark:text-white">
                                {conflict.name || conflict.intern}
                              </span>
                              <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                                {conflict.code || conflict.intern}
                              </span>
                              <span className="text-sm text-slate-500 dark:text-slate-400">
                                {conflict.phone || 'No phone'}
                              </span>
                              <span className="ml-auto text-sm font-bold text-slate-700 dark:text-slate-200">
                                {formatDate(conflict.date)}
                              </span>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Existing source
                                </div>
                                <AttendanceBadge value={conflict.existing} />
                                <div className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {conflict.existingSource}
                                </div>
                                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                  Completion date:{' '}
                                  {formatDate(conflict.existingCompletionDate)}
                                </div>
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                                  Incoming source
                                </div>
                                <AttendanceBadge value={conflict.incoming} />
                                <div className="mt-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                  {conflict.incomingSource}
                                </div>
                                <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                                  Completion date:{' '}
                                  {formatDate(conflict.incomingCompletionDate)}
                                </div>
                              </div>
                            </div>

                            {conflict.existingCompletionDate !==
                              conflict.incomingCompletionDate && (
                              <div className="mt-3 flex gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-800 dark:bg-orange-950/40 dark:text-orange-300">
                                <AlertTriangle className="h-5 w-5 shrink-0" />
                                Completion dates also differ. The attendance
                                choice below does not resolve that separate
                                discrepancy.
                              </div>
                            )}

                            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                              Preview resolution
                            </label>
                            <CustomSelect
                              value={resolutions[conflict.id] || ''}
                              onChange={(value) =>
                                chooseResolution(conflict.id, value)
                              }
                              options={[
                                { value: '', label: 'Select a resolution' },
                                ...conflict.allowedResolutions,
                              ]}
                              placeholder="Select a resolution"
                              className="mt-1 w-full"
                            />
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}

                  {databaseConflicts.length > 0 && (
                    <Card className="border-rose-300 dark:border-rose-800">
                      <div className="flex flex-col gap-3 border-b border-rose-200 px-5 py-4 dark:border-rose-800 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <h3 className="font-extrabold text-slate-950 dark:text-white">
                            Existing InternOps attendance conflicts
                          </h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400">
                            Choose whether to keep the saved record or use the
                            uploaded workbook value.
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-bold">
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                              Unresolved: {unresolvedDatabaseCount}
                            </span>
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                              Keep existing: {keptExistingCount}
                            </span>
                            <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                              Use workbook: {useWorkbookCount}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              resolveAllDatabaseConflicts('KEEP_EXISTING')
                            }
                            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                          >
                            Keep all existing
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              resolveAllDatabaseConflicts('USE_WORKBOOK')
                            }
                            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white hover:bg-indigo-700"
                          >
                            Use all workbook values
                          </button>
                        </div>
                      </div>
                      <div className="space-y-4 p-4 sm:p-5">
                        {databaseConflicts.map((conflict) => (
                          <div
                            key={conflict.id}
                            className="rounded-2xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-800 dark:bg-rose-950/20"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <strong>{conflict.name}</strong>
                              {conflict.code && (
                                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                                  {conflict.code}
                                </span>
                              )}
                              <span className="ml-auto text-sm font-bold">
                                {formatDate(conflict.date)}
                              </span>
                            </div>
                            <div className="mt-3 grid gap-3 md:grid-cols-2">
                              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                <div className="text-xs font-bold uppercase text-slate-500">
                                  InternOps
                                </div>
                                <div className="mt-2">
                                  <AttendanceBadge value={conflict.existing} />
                                </div>
                                {conflict.existingRemarks && (
                                  <p className="mt-2 text-sm">
                                    {conflict.existingRemarks}
                                  </p>
                                )}
                              </div>
                              <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
                                <div className="text-xs font-bold uppercase text-slate-500">
                                  Workbook
                                </div>
                                <div className="mt-2">
                                  <AttendanceBadge value={conflict.incoming} />
                                </div>
                                <p className="mt-2 text-sm text-slate-500">
                                  {conflict.incomingSource}
                                </p>
                                {conflict.incomingRemarks && (
                                  <p className="mt-1 text-sm">
                                    {conflict.incomingRemarks}
                                  </p>
                                )}
                              </div>
                            </div>
                            <CustomSelect
                              value={databaseResolutions[conflict.id] || ''}
                              onChange={(value) =>
                                chooseDatabaseResolution(conflict.id, value)
                              }
                              options={conflict.allowedResolutions}
                              placeholder="Select how to resolve this conflict"
                              className="mt-4 w-full"
                            />
                          </div>
                        ))}
                      </div>
                    </Card>
                  )}
                  <Card className="overflow-hidden">
                    <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-extrabold text-slate-950 dark:text-white">
                          Intern reconciliation
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Showing{' '}
                          {Math.min(visibleRows, filteredInterns.length)} of{' '}
                          {filteredInterns.length} matching interns
                        </p>
                      </div>
                      <label className="relative block w-full sm:w-72">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          value={search}
                          onChange={(event) => {
                            setSearch(event.target.value);
                            setVisibleRows(20);
                          }}
                          placeholder="Search name, code, or phone"
                          className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                        />
                      </label>
                    </div>

                    <div className="max-h-[430px] overflow-auto">
                      <table className="min-w-[900px] w-full table-fixed text-sm">
                        <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
                          <tr>
                            <th className="w-44 px-5 py-3">Name</th>
                            <th className="w-36 px-5 py-3">Code</th>
                            <th className="w-36 px-5 py-3">Status</th>
                            <th className="w-28 px-5 py-3 text-right">
                              Attendance
                            </th>
                            <th className="px-5 py-3">Sources</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredInterns
                            .slice(0, visibleRows)
                            .map((intern) => (
                              <tr
                                key={intern.key}
                                className="border-t border-slate-200 dark:border-slate-700"
                              >
                                <td className="truncate px-5 py-3 font-semibold text-slate-950 dark:text-white">
                                  {intern.name}
                                </td>
                                <td className="whitespace-nowrap px-5 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">
                                  {intern.code || 'Review'}
                                </td>
                                <td className="px-5 py-3">
                                  <StatusBadge
                                    value={
                                      intern.lifecycle?.status ||
                                      intern.workbookStatus ||
                                      'UNKNOWN'
                                    }
                                  />
                                </td>
                                <td className="px-5 py-3 text-right font-bold tabular-nums text-slate-900 dark:text-white">
                                  {intern.attendanceCount}
                                </td>
                                <td className="px-5 py-3">
                                  <div
                                    className="truncate text-slate-600 dark:text-slate-300"
                                    title={intern.sources.join(', ')}
                                  >
                                    {intern.sources.join(', ')}
                                  </div>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {visibleRows < filteredInterns.length && (
                      <div className="border-t border-slate-200 p-4 text-center dark:border-slate-700">
                        <button
                          type="button"
                          onClick={() =>
                            setVisibleRows((current) => current + 20)
                          }
                          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                        >
                          Show 20 more
                        </button>
                      </div>
                    )}
                  </Card>
                </>
              )}
            </div>
          </div>

          <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            {preview ? (
              <div
                className={`flex min-w-0 items-start gap-3 ${
                  unresolvedCount > 0
                    ? 'text-amber-700 dark:text-amber-300'
                    : 'text-emerald-700 dark:text-emerald-300'
                }`}
              >
                {unresolvedCount > 0 ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="font-bold">
                    {unresolvedCount > 0
                      ? `${unresolvedCount} conflict${unresolvedCount === 1 ? '' : 's'} unresolved`
                      : 'All attendance conflicts explicitly resolved'}
                  </div>
                  <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                    Preview fingerprint:{' '}
                    {preview.previewFingerprint.slice(0, 12)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Choose a workbook to begin preview validation.
              </div>
            )}

            <div className="flex shrink-0 flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
              >
                Close
              </button>
              <button
                type="button"
                onClick={runImport}
                disabled={!canImport}
                title={
                  canImport
                    ? 'Import reviewed current interns into Neon'
                    : 'Complete a clean preview with both workbooks, department, and direct manager'
                }
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-extrabold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:bg-emerald-600 dark:hover:bg-emerald-500 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
              >
                {importing ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <LockKeyhole className="h-4 w-4" />
                )}
                {importing
                  ? 'Importing transaction...'
                  : importResult
                    ? 'Import completed'
                    : 'Import current interns'}
              </button>
            </div>
          </footer>
        </section>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
