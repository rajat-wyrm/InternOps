import { useState } from 'react';
import { PageHeader, Card, Badge } from '../../components/ui';
import CustomSelect from '../../components/CustomSelect';
import CustomDatePicker from '../../components/CustomDatePicker';
import {
  useValidateCertificate,
  useGenerateAchievement,
  useGenerateContent,
  useMatchTemplate,
  useFullPipeline,
  useToneCustomize,
  useGenerateMultilanguage,
  useDesignSuggest,
  useDesignTemplates,
  useCertificatePreview,
  useAvailableTones,
  useSupportedLanguages,
} from '../../hooks/useAICertificates';
import {
  Sparkles,
  FileText,
  CheckCircle,
  AlertCircle,
  Globe,
  Palette,
  Wand2,
  Eye,
} from 'lucide-react';

const DEFAULT_AVAILABLE_TONES = [
  'Professional',
  'Formal',
  'Friendly',
  'Motivational',
  'Casual',
];

const DEFAULT_SUPPORTED_LANGUAGES = [
  'English',
  'Hindi',
  'Tamil',
  'Telugu',
  'Malayalam',
  'Kannada',
  'Bengali',
  'Marathi',
  'Gujarati',
  'French',
  'Spanish',
  'Arabic',
  'German',
  'Japanese',
  'Chinese (Simplified)',
];

const TABS = [
  { id: 'pipeline', label: 'Full Pipeline', icon: Sparkles },
  { id: 'validate', label: 'Validate', icon: CheckCircle },
  { id: 'achievement', label: 'Achievement', icon: FileText },
  { id: 'content', label: 'Content Gen', icon: FileText },
  { id: 'template', label: 'Match Template', icon: CheckCircle },
  { id: 'tone', label: 'Tone Custom', icon: Wand2 },
  { id: 'multilanguage', label: 'Multi-Language', icon: Globe },
  { id: 'design', label: 'Design Suggest', icon: Palette },
  { id: 'preview', label: 'Preview', icon: Eye },
];

export default function AICertificates() {
  const [activeTab, setActiveTab] = useState('pipeline');
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    achievement: '',
    date: new Date().toISOString().slice(0, 10),
    tone: 'Professional',
    certificate_type: 'Internship',
    industry: 'Technology',
    style: 'Modern',
    audience: 'Professional',
    language: 'English',
    use_ai_beautify: true,
  });

  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [previewHtml, setPreviewHtml] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState('Modern Minimal');

  const validateMutation = useValidateCertificate();
  const achievementMutation = useGenerateAchievement();
  const contentMutation = useGenerateContent();
  const matchTemplateMutation = useMatchTemplate();
  const fullPipelineMutation = useFullPipeline();
  const toneCustomizeMutation = useToneCustomize();
  const multilanguageMutation = useGenerateMultilanguage();
  const designSuggestMutation = useDesignSuggest();
  const previewMutation = useCertificatePreview();
  const { data: templatesData } = useDesignTemplates();

  const certificateTypeOptions = [
    { value: 'Internship', label: 'Internship' },
    { value: 'Achievement', label: 'Achievement' },
    { value: 'Completion', label: 'Completion' },
    { value: 'Excellence', label: 'Excellence' },
    { value: 'Participation', label: 'Participation' },
  ];

  const availableTonesQuery = useAvailableTones();
  const supportedLanguagesQuery = useSupportedLanguages();

  const toneOptions = (
    availableTonesQuery.data?.data || DEFAULT_AVAILABLE_TONES
  ).map((tone) => ({ value: tone, label: tone }));

  const languageOptions = (
    supportedLanguagesQuery.data?.data || DEFAULT_SUPPORTED_LANGUAGES
  ).map((language) => ({ value: language, label: language }));

  const industryOptions = [
    'Technology',
    'Business',
    'Education',
    'Healthcare',
    'Creative',
    'Finance',
    'Sports',
    'Science',
  ].map((industry) => ({
    value: industry,
    label: industry,
  }));

  const styleOptions = [
    'Modern',
    'Classic',
    'Elegant',
    'Minimalist',
    'Colorful',
    'Bold',
    'Formal',
  ].map((style) => ({
    value: style,
    label: style,
  }));

  const audienceOptions = [
    'Professional',
    'Academic',
    'Corporate',
    'Student',
    'General',
  ].map((audience) => ({
    value: audience,
    label: audience,
  }));

  const previewTemplateOptions = (templatesData?.data || []).map(
    (template) => ({
      value: template.name,
      label:
        `${template.emoji || ''} ${template.name} — ${template.style || ''}`.trim(),
    })
  );

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const updateFormValue = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleValidate = async () => {
    try {
      setError(null);
      setResult({
        type: 'validate',
        data: await validateMutation.mutateAsync({
          name: formData.name,
          company: formData.company,
          achievement: formData.achievement,
          date: formData.date,
          use_ai: formData.use_ai_beautify,
        }),
      });
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Validation failed');
    }
  };

  const handleGenerateAchievement = async () => {
    try {
      setError(null);
      setResult({
        type: 'achievement',
        data: await achievementMutation.mutateAsync({
          recipient_name: formData.name,
          recognition_type: formData.certificate_type,
          core_achievement: formData.achievement,
          desired_tone: formData.tone,
        }),
      });
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message ||
          'Achievement generation failed'
      );
    }
  };

  const handleGenerateContent = async () => {
    try {
      setError(null);
      setResult({
        type: 'content',
        data: await contentMutation.mutateAsync({
          prompt: `Generate certificate content for ${formData.name} from ${formData.company} for ${formData.achievement}`,
          tone: formData.tone.toLowerCase(),
          content_type: 'certificate',
        }),
      });
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || 'Content generation failed'
      );
    }
  };

  const handleMatchTemplate = async () => {
    try {
      setError(null);
      setResult({
        type: 'template',
        data: await matchTemplateMutation.mutateAsync({
          certificate_type: formData.certificate_type,
          tone: formData.tone,
          industry: formData.industry,
          style: formData.style,
          audience: formData.audience,
          language: formData.language,
          user_text: formData.achievement,
        }),
      });
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || 'Template matching failed'
      );
    }
  };

  const handleFullPipeline = async () => {
    try {
      setError(null);
      setResult({
        type: 'pipeline',
        data: await fullPipelineMutation.mutateAsync({
          name: formData.name,
          company: formData.company,
          achievement: formData.achievement,
          date: formData.date,
          tone: formData.tone,
          certificate_type: formData.certificate_type,
          industry: formData.industry,
          style: formData.style,
          audience: formData.audience,
          language: formData.language,
          use_ai_beautify: formData.use_ai_beautify,
        }),
      });
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || 'Pipeline execution failed'
      );
    }
  };

  const handleToneCustomize = async () => {
    try {
      setError(null);
      setResult({
        type: 'tone',
        data: await toneCustomizeMutation.mutateAsync({
          recipient_name: formData.name,
          company_name: formData.company,
          certificate_type: formData.certificate_type,
          achievement: formData.achievement,
          tone: formData.tone,
        }),
      });
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || 'Tone customization failed'
      );
    }
  };

  const handleMultilanguage = async () => {
    try {
      setError(null);
      setResult({
        type: 'multilanguage',
        data: await multilanguageMutation.mutateAsync({
          recipient_name: formData.name,
          company_name: formData.company,
          certificate_type: formData.certificate_type,
          achievement: formData.achievement,
          language: formData.language,
        }),
      });
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.message ||
          'Multi-language generation failed'
      );
    }
  };

  const handleDesignSuggest = async () => {
    try {
      setError(null);
      setResult({
        type: 'design',
        data: await designSuggestMutation.mutateAsync({
          certificate_type: formData.certificate_type,
          industry: formData.industry,
          style: formData.style,
          tone: formData.tone,
          audience: formData.audience,
        }),
      });
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || 'Design suggestion failed'
      );
    }
  };

  const handlePreview = async (templateName) => {
    try {
      setError(null);
      const res = await previewMutation.mutateAsync({
        recipient_name: formData.name || 'John Doe',
        title: `Certificate of ${formData.certificate_type || 'Achievement'}`,
        body:
          formData.achievement ||
          'This certificate is presented in recognition of outstanding performance.',
        closing: 'Congratulations',
        template_name: templateName,
      });
      setPreviewHtml(res.data?.html || null);
    } catch (err) {
      setError(
        err.response?.data?.error || err.message || 'Preview generation failed'
      );
    }
  };

  const runCurrentTab = () => {
    const map = {
      pipeline: handleFullPipeline,
      validate: handleValidate,
      achievement: handleGenerateAchievement,
      content: handleGenerateContent,
      tone: handleToneCustomize,
      multilanguage: handleMultilanguage,
      design: handleDesignSuggest,
      template: handleMatchTemplate,
      preview: () => handlePreview(previewTemplate || 'Modern Minimal'),
    };

    map[activeTab]?.();
  };

  const isLoading =
    validateMutation.isPending ||
    achievementMutation.isPending ||
    contentMutation.isPending ||
    matchTemplateMutation.isPending ||
    fullPipelineMutation.isPending ||
    toneCustomizeMutation.isPending ||
    multilanguageMutation.isPending ||
    designSuggestMutation.isPending ||
    previewMutation.isPending;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        title="AI Certificate Generator"
        icon={<Sparkles className="h-6 w-6" />}
        subtitle="Generate, customize, and preview certificates with AI-powered tools"
      />

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-wrap gap-2 mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setResult(null);
                setError(null);
                setPreviewHtml(null);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/25'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">
                {TABS.find((t) => t.id === activeTab)?.label || 'Details'}
              </h3>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      placeholder="Recipient name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Company
                    </label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                      placeholder="Company name"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Achievement <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="achievement"
                    value={formData.achievement}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
                    placeholder="Describe the achievement"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Type
                    </label>
                    <CustomSelect
                      value={formData.certificate_type}
                      onChange={(value) =>
                        updateFormValue('certificate_type', value)
                      }
                      options={certificateTypeOptions}
                      placeholder="Select type"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Tone
                    </label>
                    <CustomSelect
                      value={formData.tone}
                      onChange={(value) => updateFormValue('tone', value)}
                      options={toneOptions}
                      placeholder="Select tone"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Industry
                    </label>
                    <CustomSelect
                      value={formData.industry}
                      onChange={(value) => updateFormValue('industry', value)}
                      options={industryOptions}
                      placeholder="Select industry"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Style
                    </label>
                    <CustomSelect
                      value={formData.style}
                      onChange={(value) => updateFormValue('style', value)}
                      options={styleOptions}
                      placeholder="Select style"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Language
                    </label>
                    <CustomSelect
                      value={formData.language}
                      onChange={(value) => updateFormValue('language', value)}
                      options={languageOptions}
                      placeholder="Select language"
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Audience
                    </label>
                    <CustomSelect
                      value={formData.audience}
                      onChange={(value) => updateFormValue('audience', value)}
                      options={audienceOptions}
                      placeholder="Select audience"
                      className="w-full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Date
                  </label>
                  <CustomDatePicker
                    value={formData.date}
                    onChange={(value) => updateFormValue('date', value)}
                    placeholder="Select date"
                    className="w-full"
                  />
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="use_ai_beautify"
                    checked={formData.use_ai_beautify}
                    onChange={handleInputChange}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Use AI beautification
                  </span>
                </label>

                {activeTab === 'preview' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Template to Preview
                    </label>
                    <CustomSelect
                      value={previewTemplate}
                      onChange={setPreviewTemplate}
                      options={previewTemplateOptions}
                      placeholder="Select template"
                      className="w-full"
                    />
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={runCurrentTab}
                    disabled={
                      isLoading || !formData.name || !formData.achievement
                    }
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white font-semibold text-sm hover:from-indigo-700 hover:to-blue-700 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all shadow-lg shadow-indigo-500/25"
                  >
                    {isLoading ? (
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
                        Processing...
                      </>
                    ) : (
                      <>Run {TABS.find((t) => t.id === activeTab)?.label}</>
                    )}
                  </button>
                </div>
              </div>
            </Card>
          </div>

          <div className="lg:col-span-3">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">
                Results
              </h3>

              {error && (
                <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 mb-4">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-1">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-semibold">Error</span>
                  </div>
                  <p className="text-sm text-red-600 dark:text-red-300">
                    {error}
                  </p>
                </div>
              )}

              {previewHtml && (
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Certificate Preview
                  </h4>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white">
                    <iframe
                      srcDoc={previewHtml}
                      title="Preview"
                      className="w-full"
                      style={{ height: '400px', border: 'none' }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setPreviewHtml(null)}
                    className="mt-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                  >
                    Close preview
                  </button>
                </div>
              )}

              {result && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm font-semibold">Success</span>
                  </div>

                  {result.type === 'tone' && result.data?.data && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <Badge color="purple" className="mb-2">
                        {result.data.data.tone}
                      </Badge>
                      <h4 className="font-semibold text-slate-900 dark:text-white">
                        {result.data.data.title}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        {result.data.data.body}
                      </p>
                      <p className="text-xs text-slate-500 mt-3 italic">
                        {result.data.data.closing}
                      </p>
                    </div>
                  )}

                  {result.type === 'multilanguage' && result.data?.data && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                      <Badge color="blue" className="mb-2">
                        {result.data.data.language}
                      </Badge>
                      <h4 className="font-semibold text-slate-900 dark:text-white">
                        {result.data.data.title}
                      </h4>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                        {result.data.data.body}
                      </p>
                      <p className="text-xs text-slate-500 mt-3 italic">
                        {result.data.data.closing}
                      </p>
                    </div>
                  )}

                  {result.type === 'design' && result.data?.data && (
                    <div className="space-y-3">
                      {(result.data.data.recommendations || []).map(
                        (rec, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-base">{rec.emoji}</span>
                              <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                {rec.name}
                              </span>
                              <Badge
                                color={
                                  rec.confidence === 'high'
                                    ? 'green'
                                    : rec.confidence === 'medium'
                                      ? 'yellow'
                                      : 'gray'
                                }
                              >
                                {rec.confidence}
                              </Badge>
                            </div>
                            <p className="text-xs text-slate-500">
                              {rec.style} | {rec.colors} | {rec.font}
                            </p>
                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                              {rec.reason}
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {!['tone', 'multilanguage', 'design'].includes(
                    result.type
                  ) && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 overflow-auto max-h-96">
                      <pre className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-mono">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {!result && !error && !previewHtml && (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                  <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">
                    Select a function and run it
                  </p>
                  <p className="text-xs mt-1">Results will appear here</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
