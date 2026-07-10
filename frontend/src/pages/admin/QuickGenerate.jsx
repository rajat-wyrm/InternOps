import { useState } from 'react';
import {
  Zap,
  CheckCircle,
  AlertCircle,
  Download,
  Copy,
  FileText,
} from 'lucide-react';
import { PageHeader, Card, Badge, Spinner } from '../../components/ui';
import { useTemplates, useQuickGenerate } from '../../hooks/useCertificates';

const DOMAINS = [
  'Web Development',
  'Mobile Development',
  'Data Science',
  'Machine Learning',
  'Artificial Intelligence',
  'Cloud Computing',
  'Cybersecurity',
  'DevOps',
  'UI/UX Design',
  'Blockchain',
  'IoT',
  'Full Stack',
  'Backend',
  'Frontend',
  'Python',
  'Java',
  'React',
  'Node.js',
  'Angular',
  'Vue.js',
  'Digital Marketing',
  'Content Writing',
  'Project Management',
  'Business Analytics',
];

export default function QuickGenerate() {
  const [formData, setFormData] = useState({
    template_id: '',
    recipient_name: '',
    domain: '',
    custom_domain: '',
    start_date: '',
    end_date: '',
    issuer: 'InternOps',
  });
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: templatesData, isLoading: templatesLoading } = useTemplates();
  const templates = templatesData?.data || [];
  const quickGenerateMutation = useQuickGenerate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    try {
      setError(null);
      setResult(null);
      const domain =
        formData.domain === 'Other' ? formData.custom_domain : formData.domain;
      const res = await quickGenerateMutation.mutateAsync({
        template_id: formData.template_id || undefined,
        recipient_name: formData.recipient_name,
        domain,
        start_date: formData.start_date,
        end_date: formData.end_date,
        issuer: formData.issuer,
      });
      setResult(res);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Generation failed');
    }
  };

  const copyCertNumber = () => {
    if (result?.data?.certificate_number) {
      navigator.clipboard.writeText(result.data.certificate_number);
    }
  };

  const domain =
    formData.domain === 'Other' ? formData.custom_domain : formData.domain;
  const isValid =
    formData.recipient_name &&
    domain &&
    formData.start_date &&
    formData.end_date;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="Quick Generate Certificate"
        icon={<Zap className="h-6 w-6" />}
        subtitle="Select a template, fill in the details, and generate instantly"
      />

      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Form — 2 cols */}
          <div className="lg:col-span-3">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">
                Certificate Details
              </h3>

              <div className="space-y-4">
                {/* Template */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Template <span className="text-slate-400">(optional)</span>
                  </label>
                  {templatesLoading ? (
                    <div className="flex items-center gap-2 text-slate-500 text-sm">
                      <Spinner /> Loading templates...
                    </div>
                  ) : (
                    <select
                      name="template_id"
                      value={formData.template_id}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    >
                      <option value="">Auto-select template</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Intern / Recipient Name{' '}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="recipient_name"
                    value={formData.recipient_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="e.g. Rahul Sharma"
                  />
                </div>

                {/* Domain */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Domain / Field <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="domain"
                    value={formData.domain}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                  >
                    <option value="">Select domain</option>
                    {DOMAINS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                    <option value="Other">Other (type below)</option>
                  </select>
                  {formData.domain === 'Other' && (
                    <input
                      type="text"
                      name="custom_domain"
                      value={formData.custom_domain}
                      onChange={handleInputChange}
                      className="w-full mt-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      placeholder="Enter your domain"
                    />
                  )}
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Start Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="start_date"
                      value={formData.start_date}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      End Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="end_date"
                      value={formData.end_date}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Issuer */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Issued By
                  </label>
                  <input
                    type="text"
                    name="issuer"
                    value={formData.issuer}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="e.g. InternOps"
                  />
                </div>

                {/* Generate Button */}
                <div className="pt-2">
                  <button
                    onClick={handleGenerate}
                    disabled={!isValid || quickGenerateMutation.isPending}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-sm hover:from-indigo-700 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25"
                  >
                    {quickGenerateMutation.isPending ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="none"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Generate Certificate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </Card>
          </div>

          {/* Result — 3 cols */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">
                Generated Certificate
              </h3>

              {error && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-semibold">Error</span>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {error}
                  </p>
                </div>
              )}

              {result?.success && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 mb-3">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-semibold">
                        Certificate Generated
                      </span>
                    </div>

                    <div className="space-y-2.5 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">
                          Certificate No
                        </span>
                        <div className="flex items-center gap-1.5">
                          <code className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs font-semibold">
                            {result.data.certificate_number}
                          </code>
                          <button
                            onClick={copyCertNumber}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                            title="Copy"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">
                          Recipient
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {result.data.recipient_name}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">
                          Domain
                        </span>
                        <Badge color="blue">{result.data.domain}</Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500 dark:text-slate-400">
                          Duration
                        </span>
                        <span className="text-slate-700 dark:text-slate-300 text-xs">
                          {new Date(
                            result.data.start_date
                          ).toLocaleDateString()}{' '}
                          —{' '}
                          {new Date(result.data.end_date).toLocaleDateString()}
                        </span>
                      </div>
                      {result.data.template_name && (
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500 dark:text-slate-400">
                            Template
                          </span>
                          <span className="text-slate-700 dark:text-slate-300">
                            {result.data.template_name}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {result.data.pdf_url && (
                    <a
                      href={result.data.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold hover:bg-slate-800 dark:hover:bg-slate-100 transition"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </a>
                  )}
                </div>
              )}

              {!result && !error && (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">
                    No certificate generated yet
                  </p>
                  <p className="text-xs mt-1 text-slate-400">
                    Fill in the form and click Generate
                  </p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
