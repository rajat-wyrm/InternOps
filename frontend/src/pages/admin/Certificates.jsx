import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  Download,
  Trash2,
  Search,
  X,
  Loader2,
  Award,
} from 'lucide-react';
import {
  useCertificates,
  useGenerateCertificate,
  useSeedTemplates,
  useTemplates,
} from '../../hooks/useCertificates';
import {
  PageHeader,
  Card,
  Badge,
  Spinner,
  Btn,
  Input,
  EmptyState,
  ConfirmationModal,
} from '../../components/ui';
import CustomSelect from '../../components/CustomSelect';

const CERTIFICATE_TYPES = [
  { value: 'completion', label: 'Completion' },
  { value: 'achievement', label: 'Achievement' },
  { value: 'participation', label: 'Participation' },
  { value: 'excellence', label: 'Excellence' },
];

const STATUS_COLORS = {
  active: 'green',
  pending: 'yellow',
  revoked: 'red',
  draft: 'gray',
};

const TYPE_COLORS = {
  completion: 'blue',
  achievement: 'indigo',
  participation: 'teal',
  excellence: 'purple',
};

export default function Certificates() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [certToDelete, setCertToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const { data: certsData, isLoading } = useCertificates({ search });
  const certificates = certsData?.data || [];
  const { data: templatesData, isLoading: templatesLoading } = useTemplates();
  const templates = templatesData?.data || [];
  const generateMutation = useGenerateCertificate();
  const seedMutation = useSeedTemplates();

  const filteredCertificates = certificates.filter(
    (cert) =>
      cert.recipient_name?.toLowerCase().includes(search.toLowerCase()) ||
      cert.title?.toLowerCase().includes(search.toLowerCase()) ||
      cert.recipient_email?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (cert) => {
    setDeletingId(cert.id);
    // TODO: Add delete mutation to useCertificates hook
    // deleteMutation.mutate(cert.id);
    setCertToDelete(null);
  };

  const handleDownload = (cert) => {
    window.open(
      cert.download_url || `/api/certificates/${cert.id}/download`,
      '_blank'
    );
  };

  return (
    <div className="animate-fade-in-up">
      <ConfirmationModal
        open={!!certToDelete}
        title="Delete Certificate"
        message={`Are you sure you want to permanently delete the certificate for "${certToDelete?.recipient_name}"?`}
        onConfirm={() => handleDelete(certToDelete)}
        onCancel={() => setCertToDelete(null)}
        loading={deletingId === certToDelete?.id}
        danger={true}
      />

      <PageHeader
        title="Certificates"
        icon="🏆"
        subtitle="Manage and generate certificates for participants"
        actions={
          <>
            <Btn
              variant="outline"
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
            >
              {seedMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin inline-block" />
              ) : (
                'Seed Templates'
              )}
            </Btn>
            <Btn onClick={() => setShowModal(true)}>
              <Plus className="w-4 h-4 inline-block" />
              Generate Certificate
            </Btn>
          </>
        }
      />

      {/* Search Bar */}
      <Card className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by recipient, title, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 outline-none transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </Card>

      {/* Certificates Table */}
      {isLoading ? (
        <Spinner label="Loading certificates..." />
      ) : filteredCertificates.length === 0 ? (
        <EmptyState
          icon="📜"
          title="No certificates found"
          text={
            search
              ? 'Try a different search term.'
              : 'Create your first certificate using the button above.'
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950 text-left text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-4 font-bold">Recipient</th>
                  <th className="p-4 font-bold">Title</th>
                  <th className="p-4 font-bold">Type</th>
                  <th className="p-4 font-bold">Status</th>
                  <th className="p-4 font-bold">Date</th>
                  <th className="p-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filteredCertificates.map((cert) => (
                  <tr
                    key={cert.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold shadow-md">
                          {cert.recipient_name?.charAt(0) || '?'}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {cert.recipient_name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {cert.recipient_email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <p className="text-slate-800 dark:text-slate-200 font-medium">
                        {cert.title}
                      </p>
                    </td>
                    <td className="p-4">
                      <Badge
                        color={TYPE_COLORS[cert.certificate_type] || 'gray'}
                      >
                        {cert.certificate_type?.charAt(0).toUpperCase() +
                          cert.certificate_type?.slice(1)}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <Badge color={STATUS_COLORS[cert.status] || 'gray'}>
                        {cert.status?.charAt(0).toUpperCase() +
                          cert.status?.slice(1)}
                      </Badge>
                    </td>

                    <td className="p-4 text-slate-500 dark:text-slate-400">
                      {new Date(cert.created_at).toLocaleDateString()}
                    </td>

                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleDownload(cert)}
                          className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 transition-colors"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setCertToDelete(cert)}
                          className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Generate Certificate Modal */}
      {showModal && (
        <GenerateCertificateModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          templates={templates}
          templatesLoading={templatesLoading}
          generateMutation={generateMutation}
        />
      )}
    </div>
  );
}

function GenerateCertificateModal({
  isOpen,
  onClose,
  templates,
  templatesLoading,
  generateMutation,
}) {
  const [formData, setFormData] = useState({
    recipient_name: '',
    recipient_email: '',
    title: '',
    body: '',
    issuer: '',
    certificate_type: 'completion',
    template_id: '',
  });

  const templateOptions = [
    {
      value: '',
      label: templatesLoading
        ? 'Loading templates...'
        : 'Select a template (optional)',
    },
    ...templates.map((template) => ({
      value: template.id,
      label: template.name,
    })),
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    generateMutation.mutate(formData, {
      onSuccess: () => {
        onClose();
        setFormData({
          recipient_name: '',
          recipient_email: '',
          title: '',
          body: '',
          issuer: '',
          certificate_type: 'completion',
          template_id: '',
        });
      },
    });
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg max-h-[90vh] bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
        <div className="shrink-0 p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white shadow-lg">
                <Award className="w-5 h-5" />
              </div>

              <div>
                <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Generate Certificate
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Create a new certificate for a participant
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="min-h-0 flex flex-col">
          <div className="min-h-0 overflow-y-auto p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Name *
                </label>
                <Input
                  name="recipient_name"
                  value={formData.recipient_name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Recipient Email *
                </label>
                <Input
                  name="recipient_email"
                  type="email"
                  value={formData.recipient_email}
                  onChange={handleChange}
                  placeholder="john@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Certificate Title *
              </label>
              <Input
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="Certificate of Achievement"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Body / Description
              </label>
              <textarea
                name="body"
                value={formData.body}
                onChange={handleChange}
                placeholder="This certificate is awarded to..."
                rows={3}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-400/50 focus:border-indigo-400 outline-none transition resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Issuer
                </label>
                <Input
                  name="issuer"
                  value={formData.issuer}
                  onChange={handleChange}
                  placeholder="Organization Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Certificate Type
                </label>
                <CustomSelect
                  value={formData.certificate_type}
                  onChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      certificate_type: value,
                    }))
                  }
                  options={CERTIFICATE_TYPES}
                  placeholder="Select certificate type"
                  className="w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Template
              </label>
              <CustomSelect
                value={formData.template_id}
                onChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    template_id: value,
                  }))
                }
                options={templateOptions}
                placeholder={
                  templatesLoading
                    ? 'Loading templates...'
                    : 'Select a template (optional)'
                }
                disabled={templatesLoading}
                className="w-full"
              />
            </div>
          </div>

          <div className="shrink-0 flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <Btn type="button" variant="outline" onClick={onClose}>
              Cancel
            </Btn>

            <Btn
              type="submit"
              disabled={
                generateMutation.isPending ||
                !formData.recipient_name ||
                !formData.recipient_email ||
                !formData.title
              }
            >
              {generateMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin inline-block" />
              ) : (
                'Generate Certificate'
              )}
            </Btn>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
