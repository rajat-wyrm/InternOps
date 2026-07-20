import { useState, useCallback } from 'react';
import { PageHeader, Card, Badge, Spinner } from '../../components/ui';
import CustomSelect from '../../components/CustomSelect';
import {
  useBulkGenerate,
  useTemplates,
  useBulkJobStatus,
} from '../../hooks/useCertificates';
import {
  Upload,
  Plus,
  Trash2,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from 'lucide-react';

const BulkGenerate = () => {
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [recipients, setRecipients] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [validationError, setValidationError] = useState('');

  const { data: templatesData, isLoading: templatesLoading } = useTemplates();
  const templates = templatesData?.data || [];
  const bulkGenerateMutation = useBulkGenerate();

  const templateOptions = [
    { value: '', label: 'Select a template...' },
    ...templates.map((template) => ({
      value: template.id,
      label: template.name,
    })),
  ];

  const { data: jobStatusData, isFetching: isPolling } =
    useBulkJobStatus(jobId);
  const jobStatus = jobStatusData?.data || null;
  const isGenerating = bulkGenerateMutation.isPending;

  const isValidEmail = (email) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());

  const validateRecipients = () => {
    if (recipients.length === 0) {
      return 'Please add at least one recipient.';
    }

    const missingNameIndex = recipients.findIndex(
      (recipient) => !recipient.name?.trim()
    );

    if (missingNameIndex !== -1) {
      return `Row ${missingNameIndex + 1}: Please enter recipient name.`;
    }

    const missingEmailIndex = recipients.findIndex(
      (recipient) => !recipient.email?.trim()
    );

    if (missingEmailIndex !== -1) {
      return `Row ${missingEmailIndex + 1}: Please enter recipient email.`;
    }

    const invalidEmailIndex = recipients.findIndex(
      (recipient) => !isValidEmail(recipient.email)
    );

    if (invalidEmailIndex !== -1) {
      return `Row ${invalidEmailIndex + 1}: Please enter a valid email address.`;
    }

    return '';
  };

  const parseCsv = useCallback((text) => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0]
      .toLowerCase()
      .split(',')
      .map((h) => h.trim());

    const nameIdx = headers.findIndex((h) => h === 'name');
    const emailIdx = headers.findIndex((h) => h === 'email');
    const titleIdx = headers.findIndex((h) => h === 'title');
    const achievementIdx = headers.findIndex((h) => h === 'achievement');

    if (nameIdx === -1 || emailIdx === -1) return [];

    return lines
      .slice(1)
      .map((line) => {
        const values = line.split(',').map((v) => v.trim());
        return {
          name: values[nameIdx] || '',
          email: values[emailIdx] || '',
          title: values[titleIdx] || '',
          achievement: values[achievementIdx] || '',
        };
      })
      .filter((r) => r.name && r.email);
  }, []);

  const handleCsvUpload = useCallback(
    (e) => {
      const file = e.target.files[0];
      if (!file) return;

      setValidationError('');
      setCsvFileName(file.name);

      const reader = new FileReader();
      reader.onload = (event) => {
        const parsed = parseCsv(event.target.result);
        setRecipients(parsed);
      };
      reader.readAsText(file);
      e.target.value = '';
    },
    [parseCsv]
  );

  const addRow = () => {
    setValidationError('');
    setRecipients([
      ...recipients,
      { name: '', email: '', title: '', achievement: '' },
    ]);
  };

  const removeRow = (index) => {
    setValidationError('');
    setRecipients(recipients.filter((_, i) => i !== index));
  };

  const updateRow = (index, field, value) => {
    setValidationError('');
    const updated = [...recipients];
    updated[index] = { ...updated[index], [field]: value };
    setRecipients(updated);
  };

  const goToPreview = () => {
    const message = validateRecipients();
    if (message) {
      setValidationError(message);
      return;
    }
    setValidationError('');
    setStep(3);
  };

  const handleGenerate = async () => {
    const message = validateRecipients();
    if (message) {
      setValidationError(message);
      setStep(2);
      return;
    }

    try {
      setValidationError('');
      const result = await bulkGenerateMutation.mutateAsync({
        template_id: selectedTemplate,
        certificates: recipients.map((r) => ({
          recipient_name: r.name.trim(),
          recipient_email: r.email.trim(),
          title: r.title?.trim() || 'Certificate of Achievement',
          certificate_type: 'achievement',
        })),
      });
      setJobId(result.data?.job_id || result.job_id);
      setStep(4);
    } catch (error) {
      setValidationError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          error.message ||
          'Bulk generation failed. Please try again.'
      );
    }
  };

  const progress = jobStatus
    ? Math.round(
        ((jobStatus.completed_count || 0) / (jobStatus.total_count || 1)) * 100
      )
    : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <PageHeader
        title="Bulk Generate Certificates"
        icon={<FileText className="h-6 w-6" />}
      />

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  step >= s
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {s}
              </div>
              {s < 3 && (
                <div
                  className={`w-20 h-1 mx-2 ${
                    step > s ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {step === 1 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Step 1: Select Template
            </h2>
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Choose a certificate template
              </label>
              {templatesLoading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Loading templates...</span>
                </div>
              ) : (
                <CustomSelect
                  value={selectedTemplate}
                  onChange={setSelectedTemplate}
                  options={templateOptions}
                  placeholder="Select a template..."
                  className="w-full"
                />
              )}
              <button
                type="button"
                onClick={() => selectedTemplate && setStep(2)}
                disabled={!selectedTemplate}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Next Step
              </button>
            </div>
          </Card>
        )}

        {step === 2 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Step 2: Add Recipients
            </h2>

            <div className="mb-6 p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <div className="flex items-center gap-4">
                <Upload className="h-8 w-8 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Upload CSV file
                  </p>
                  <p className="text-xs text-gray-500">
                    Format: name, email, title, achievement
                  </p>
                </div>
                <label className="ml-auto cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleCsvUpload}
                    className="hidden"
                  />
                  <span className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                    Choose File
                  </span>
                </label>
              </div>
              {csvFileName && (
                <p className="mt-2 text-sm text-green-600 dark:text-green-400">
                  Loaded: {csvFileName}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 mb-4">
              <span className="text-gray-500">or</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Enter recipients manually
              </span>
            </div>

            {validationError && (
              <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">
                {validationError}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Title
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 dark:text-gray-300">
                      Achievement
                    </th>
                    <th className="px-4 py-3 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {recipients.map((recipient, index) => (
                    <tr
                      key={index}
                      className="border-t border-gray-200 dark:border-gray-700"
                    >
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={recipient.name}
                          onChange={(e) =>
                            updateRow(index, 'name', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="John Doe"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="email"
                          value={recipient.email}
                          onChange={(e) =>
                            updateRow(index, 'email', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="john@example.com"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={recipient.title}
                          onChange={(e) =>
                            updateRow(index, 'title', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="Software Engineer"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={recipient.achievement}
                          onChange={(e) =>
                            updateRow(index, 'achievement', e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                          placeholder="Completed Training"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center gap-4">
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                <Plus className="h-4 w-4" /> Add Row
              </button>
              <span className="text-sm text-gray-500">
                {recipients.length} recipient
                {recipients.length !== 1 ? 's' : ''} added
              </span>
            </div>

            <div className="mt-6 flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setValidationError('');
                  setStep(1);
                }}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={goToPreview}
                disabled={recipients.length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                Next Step
              </button>
            </div>
          </Card>
        )}

        {step === 3 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Step 3: Preview & Generate
            </h2>
            <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Template</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {templates?.find((t) => t.id === selectedTemplate)?.name ||
                      'Unknown'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Recipients</p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {recipients.length} certificate
                    {recipients.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Recipients Preview
              </p>
              <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">
                        #
                      </th>
                      <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">
                        Name
                      </th>
                      <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">
                        Email
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipients.slice(0, 10).map((recipient, index) => (
                      <tr
                        key={index}
                        className="border-t border-gray-200 dark:border-gray-700"
                      >
                        <td className="px-4 py-2 text-gray-500">{index + 1}</td>
                        <td className="px-4 py-2 text-gray-900 dark:text-white">
                          {recipient.name}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {recipient.email}
                        </td>
                      </tr>
                    ))}
                    {recipients.length > 10 && (
                      <tr>
                        <td
                          colSpan="3"
                          className="px-4 py-2 text-center text-gray-500"
                        >
                          ...and {recipients.length - 10} more
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {validationError && (
              <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm font-semibold text-red-700 dark:text-red-300">
                {validationError}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" /> Generate All
                  </>
                )}
              </button>
            </div>
          </Card>
        )}

        {step === 4 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Generation Progress
            </h2>
            {jobStatus ? (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Overall Progress
                    </span>
                    <span className="text-sm text-gray-500">{progress}%</span>
                  </div>
                  <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-green-700 dark:text-green-400">
                        Completed
                      </span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-green-700 dark:text-green-400">
                      {jobStatus.completed_count || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-sm text-red-700 dark:text-red-400">
                        Failed
                      </span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-red-700 dark:text-red-400">
                      {jobStatus.failed_count || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-blue-600" />
                      <span className="text-sm text-blue-700 dark:text-blue-400">
                        Total
                      </span>
                    </div>
                    <p className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-400">
                      {jobStatus.total_count || 0}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">Status:</span>
                  <Badge
                    color={
                      jobStatus.status === 'completed'
                        ? 'green'
                        : jobStatus.status === 'failed'
                          ? 'red'
                          : 'blue'
                    }
                  >
                    {jobStatus.status}
                  </Badge>
                  {isPolling && (
                    <span className="text-sm text-gray-500 flex items-center gap-1">
                      <Loader2 className="h-4 w-4 animate-spin" /> Polling...
                    </span>
                  )}
                </div>

                {jobStatus.status === 'completed' && jobStatus.items && (
                  <div className="mt-6">
                    <h3 className="text-lg font-medium mb-3 text-gray-900 dark:text-white">
                      Generated Certificates
                    </h3>
                    <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                          <tr>
                            <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">
                              Name
                            </th>
                            <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">
                              Status
                            </th>
                            <th className="px-4 py-2 text-left text-gray-600 dark:text-gray-400">
                              Certificate ID
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {jobStatus.items.map((item, index) => (
                            <tr
                              key={index}
                              className="border-t border-gray-200 dark:border-gray-700"
                            >
                              <td className="px-4 py-2 text-gray-900 dark:text-white">
                                {item.recipient_name}
                              </td>
                              <td className="px-4 py-2">
                                <Badge
                                  color={
                                    item.status === 'generated'
                                      ? 'green'
                                      : 'red'
                                  }
                                >
                                  {item.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                                {item.certificate_id || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="flex gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setSelectedTemplate('');
                      setRecipients([]);
                      setCsvFileName('');
                      setJobId(null);
                      setValidationError('');
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Generate More
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (jobStatus.items) {
                        const csv = [
                          'name,email,certificate_id,status',
                          ...jobStatus.items
                            .filter((r) => r.status === 'generated')
                            .map(
                              (r) =>
                                `${r.recipient_name},${r.recipient_email || ''},${r.certificate_id || ''},${r.status}`
                            ),
                        ].join('\n');
                        const blob = new Blob([csv], { type: 'text/csv' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'certificates.csv';
                        a.click();
                        URL.revokeObjectURL(url);
                      }
                    }}
                    className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Export Results
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center py-12">
                <Spinner label="Loading job status..." />
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
};

export default BulkGenerate;
