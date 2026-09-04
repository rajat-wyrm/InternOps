import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/axios';

import {
  PageHeader,
  Card,
  Badge,
  Btn,
  Input,
  Textarea,
  Select,
  Spinner,
  EmptyState,
  ConfirmationModal,
} from '../../components/ui';

const DEFAULT_COLUMNS = ['employee', 'attendance', 'rating', 'tasks'];

const QUICK_TEMPLATES = {
  WEEKLY: {
    name: 'Weekly Performance Report',
    description: 'Weekly employee performance summary',
    configuration: {
      reportType: 'custom-summary',
      columns: DEFAULT_COLUMNS,
      dateRange: 'weekly',
    },
  },

  MONTHLY: {
    name: 'Monthly Performance Report',
    description: 'Monthly employee performance summary',
    configuration: {
      reportType: 'custom-summary',
      columns: DEFAULT_COLUMNS,
      dateRange: 'monthly',
    },
  },

  QUARTERLY: {
    name: 'Quarterly Performance Report',
    description: 'Quarterly employee performance summary',
    configuration: {
      reportType: 'custom-summary',
      columns: DEFAULT_COLUMNS,
      dateRange: 'quarterly',
    },
  },
};

function emptyForm() {
  return {
    name: '',
    description: '',
    visibility: 'PRIVATE',
    isDefault: false,

    configuration: {
      reportType: 'custom-summary',
      columns: [...DEFAULT_COLUMNS],
      dateRange: 'monthly',
    },
  };
}

export default function ReportTemplates() {
  const queryClient = useQueryClient();

  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [versionsId, setVersionsId] = useState(null);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const [generatedReport, setGeneratedReport] = useState(null);

  const [generatingTemplateId, setGeneratingTemplateId] = useState(null);

  const [importError, setImportError] = useState(null);

  const templatesQuery = useQuery({
    queryKey: ['reportTemplates'],

    queryFn: () => api.get('/report-templates').then((res) => res.data),
  });

  const versionsQuery = useQuery({
    queryKey: ['reportTemplateVersions', versionsId],

    queryFn: () =>
      api
        .get(`/report-templates/${versionsId}/versions`)
        .then((res) => res.data),

    enabled: !!versionsId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingId) {
        return api.put(`/report-templates/${editingId}`, data);
      }

      return api.post('/report-templates', data);
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['reportTemplates'],
      });

      setForm(emptyForm());
      setEditingId(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/report-templates/${id}`),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['reportTemplates'],
      });

      setDeleteId(null);
    },
  });

  const versionMutation = useMutation({
    mutationFn: ({ templateId, configuration }) =>
      api.post(`/report-templates/${templateId}/versions`, {
        configuration,
      }),

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['reportTemplateVersions', variables.templateId],
      });

      setVersionsId(variables.templateId);
    },
  });

  const templates = templatesQuery.data || [];

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(template) {
    setEditingId(template.id);

    setForm({
      name: template.name || '',
      description: template.description || '',
      visibility: template.visibility || 'PRIVATE',
      isDefault: Boolean(template.is_default),

      configuration: {
        reportType: template.configuration?.reportType || 'custom-summary',

        columns: template.configuration?.columns || [...DEFAULT_COLUMNS],

        dateRange: template.configuration?.dateRange || 'monthly',
      },
    });

    setShowForm(true);
  }

  function createQuickTemplate(type) {
    const template = QUICK_TEMPLATES[type];

    setEditingId(null);

    setForm({
      name: template.name,
      description: template.description,
      visibility: 'PRIVATE',
      isDefault: false,

      configuration: {
        ...template.configuration,
      },
    });

    setShowForm(true);
  }

  function toggleColumn(column) {
    setForm((current) => {
      const columns = current.configuration.columns || [];

      return {
        ...current,

        configuration: {
          ...current.configuration,

          columns: columns.includes(column)
            ? columns.filter((item) => item !== column)
            : [...columns, column],
        },
      };
    });
  }

  function submit(event) {
    event.preventDefault();

    if (!form.name.trim()) {
      return;
    }

    saveMutation.mutate({
      name: form.name.trim(),

      description: form.description.trim(),

      departmentId: null,

      visibility: form.visibility,

      isDefault: form.isDefault,

      configuration: form.configuration,
    });
  }

  async function generateReport(template) {
    try {
      setGeneratingTemplateId(template.id);

      const today = new Date();

      const to = today.toISOString().slice(0, 10);

      const fromDate = new Date(today);

      switch (template.configuration?.dateRange) {
        case 'weekly':
          fromDate.setDate(today.getDate() - 7);
          break;

        case 'quarterly':
          fromDate.setMonth(today.getMonth() - 3);
          break;

        case 'monthly':
        default:
          fromDate.setMonth(today.getMonth() - 1);
          break;
      }

      const from = fromDate.toISOString().slice(0, 10);

      const reportType = template.configuration?.reportType || 'custom-summary';

      let response;

      if (reportType === 'task-completion') {
        response = await api.get('/reports/task-completion');
      } else {
        response = await api.get(`/reports/${reportType}`, {
          params: {
            from,
            to,
          },
        });
      }

      setGeneratedReport({
        template,
        from,
        to,
        data: response.data,
      });
    } catch (error) {
      console.error('Failed to generate report:', error);
    } finally {
      setGeneratingTemplateId(null);
    }
  }

  function exportTemplate(template) {
    const exportData = {
      name: template.name,

      description: template.description || '',

      visibility: template.visibility || 'PRIVATE',

      isDefault: false,

      configuration: template.configuration || {},
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;

    link.download = `${template.name
      .replace(/[^a-z0-9]+/gi, '-')
      .toLowerCase()}-template.json`;

    document.body.appendChild(link);

    link.click();

    link.remove();

    URL.revokeObjectURL(url);
  }

  async function handleImport(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setImportError(null);

    try {
      const text = await file.text();

      const imported = JSON.parse(text);

      if (!imported.name || !imported.configuration) {
        throw new Error(
          'Invalid template file. Name and configuration are required.'
        );
      }

      await api.post('/report-templates', {
        name: imported.name,

        description: imported.description || '',

        departmentId: null,

        visibility: imported.visibility || 'PRIVATE',

        isDefault: false,

        configuration: imported.configuration,
      });

      await queryClient.invalidateQueries({
        queryKey: ['reportTemplates'],
      });
    } catch (error) {
      console.error('Template import failed:', error);

      setImportError(
        error.response?.data?.error ||
          error.message ||
          'Failed to import template'
      );
    } finally {
      event.target.value = '';
    }
  }

  return (
    <div>
      <PageHeader
        title="Report Templates"
        icon="📋"
        subtitle="Create and manage reusable report configurations"
        actions={
          <div className="flex gap-2">
            <label className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 cursor-pointer text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800">
              Import Template
              <input
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImport}
              />
            </label>

            <Btn onClick={openCreate}>+ Create Template</Btn>
          </div>
        }
      />

      {importError && (
        <Card className="p-4 mb-5 border border-red-300">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-red-600 dark:text-red-400">
              {importError}
            </p>

            <Btn variant="secondary" onClick={() => setImportError(null)}>
              Close
            </Btn>
          </div>
        </Card>
      )}

      {/* Quick Templates */}

      <Card className="p-4 mb-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-800 dark:text-white">
              Quick Templates
            </h3>

            <p className="text-sm text-gray-500 dark:text-slate-400">
              Start with a predefined report configuration.
            </p>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          {Object.keys(QUICK_TEMPLATES).map((type) => (
            <Btn
              key={type}
              variant="secondary"
              onClick={() => createQuickTemplate(type)}
            >
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </Btn>
          ))}
        </div>
      </Card>

      {/* Template List */}

      {templatesQuery.isLoading ? (
        <Spinner />
      ) : templatesQuery.isError ? (
        <Card className="p-5">
          <p className="text-red-600 dark:text-red-400">
            Failed to load report templates.
          </p>
        </Card>
      ) : templates.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No report templates"
          text="Create your first reusable report template."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {templates.map((template) => (
            <Card key={template.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
                      {template.name}
                    </h3>

                    {template.is_default && (
                      <Badge color="green">Default</Badge>
                    )}

                    <Badge
                      color={
                        template.visibility === 'PRIVATE' ? 'gray' : 'blue'
                      }
                    >
                      {template.visibility}
                    </Badge>
                  </div>

                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    {template.description || 'No description'}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-slate-400 mb-2">
                  Columns
                </p>

                <div className="flex gap-2 flex-wrap">
                  {(template.configuration?.columns || []).map((column) => (
                    <Badge key={column} color="indigo">
                      {column}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex gap-2 flex-wrap">
                {/* Preview */}

                <Btn
                  variant="secondary"
                  onClick={() => setPreviewTemplate(template)}
                >
                  Preview
                </Btn>

                {/* Generate */}

                <Btn
                  variant="secondary"
                  onClick={() => generateReport(template)}
                  disabled={generatingTemplateId === template.id}
                >
                  {generatingTemplateId === template.id
                    ? 'Generating...'
                    : 'Generate'}
                </Btn>

                {/* Edit */}

                <Btn variant="secondary" onClick={() => openEdit(template)}>
                  Edit
                </Btn>

                {/* Versions */}

                <Btn
                  variant="secondary"
                  onClick={() => setVersionsId(template.id)}
                >
                  Versions
                </Btn>

                {/* Save Version */}

                <Btn
                  variant="secondary"
                  onClick={() =>
                    versionMutation.mutate({
                      templateId: template.id,

                      configuration: template.configuration || {},
                    })
                  }
                  disabled={versionMutation.isPending}
                >
                  Save Version
                </Btn>

                {/* Export */}

                <Btn
                  variant="secondary"
                  onClick={() => exportTemplate(template)}
                >
                  Export
                </Btn>

                {/* Delete */}

                <Btn variant="danger" onClick={() => setDeleteId(template.id)}>
                  Delete
                </Btn>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Create / Edit Form */}

      {showForm && (
        <Card className="p-5 mt-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
              {editingId ? 'Edit Template' : 'Create Template'}
            </h2>

            <Btn
              variant="secondary"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
            >
              Cancel
            </Btn>
          </div>

          <form onSubmit={submit} className="space-y-5">
            <Input
              value={form.name}
              onChange={(event) =>
                setForm({
                  ...form,
                  name: event.target.value,
                })
              }
              placeholder="Template name"
              required
            />

            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm({
                  ...form,

                  description: event.target.value,
                })
              }
              placeholder="Description"
              rows={3}
            />

            {/* Visibility */}

            <Select
              value={form.visibility}
              onChange={(event) =>
                setForm({
                  ...form,

                  visibility: event.target.value,
                })
              }
            >
              <option value="PRIVATE">Private</option>

              <option value="TEAM">Team</option>

              <option value="ORGANIZATION">Organization</option>
            </Select>

            {/* Report Type */}

            <Select
              value={form.configuration.reportType}
              onChange={(event) =>
                setForm({
                  ...form,

                  configuration: {
                    ...form.configuration,

                    reportType: event.target.value,
                  },
                })
              }
            >
              <option value="custom-summary">Custom Summary</option>

              <option value="attendance-summary">Attendance Summary</option>

              <option value="ratings-summary">Ratings Summary</option>

              <option value="task-completion">Task Completion</option>
            </Select>

            {/* Date Range */}

            <Select
              value={form.configuration.dateRange}
              onChange={(event) =>
                setForm({
                  ...form,

                  configuration: {
                    ...form.configuration,

                    dateRange: event.target.value,
                  },
                })
              }
            >
              <option value="weekly">Weekly</option>

              <option value="monthly">Monthly</option>

              <option value="quarterly">Quarterly</option>
            </Select>

            {/* Columns */}

            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">
                Report Columns
              </p>

              <div className="flex gap-2 flex-wrap">
                {DEFAULT_COLUMNS.map((column) => {
                  const selected = form.configuration.columns.includes(column);

                  return (
                    <button
                      key={column}
                      type="button"
                      onClick={() => toggleColumn(column)}
                      className={`px-3 py-2 rounded-lg border text-sm ${
                        selected
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600'
                      }`}
                    >
                      {column}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Default */}

            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(event) =>
                  setForm({
                    ...form,

                    isDefault: event.target.checked,
                  })
                }
              />
              Set as default template
            </label>

            <div className="flex gap-3">
              <Btn type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? 'Saving...'
                  : editingId
                    ? 'Update Template'
                    : 'Create Template'}
              </Btn>

              <Btn
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </Btn>
            </div>
          </form>
        </Card>
      )}

      {/* Generated Report */}

      {generatedReport && (
        <Card className="p-5 mt-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                Generated Report
              </h2>

              <p className="text-sm text-gray-500 dark:text-slate-400">
                {generatedReport.template.name}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                {generatedReport.from} → {generatedReport.to}
              </p>
            </div>

            <Btn variant="secondary" onClick={() => setGeneratedReport(null)}>
              Close
            </Btn>
          </div>

          {Array.isArray(generatedReport.data) &&
          generatedReport.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700">
                    {Object.keys(generatedReport.data[0]).map((key) => (
                      <th
                        key={key}
                        className="text-left px-3 py-2 font-semibold text-gray-600 dark:text-slate-300"
                      >
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {generatedReport.data.map((row, index) => (
                    <tr
                      key={index}
                      className="border-b border-gray-100 dark:border-slate-800"
                    >
                      {Object.keys(generatedReport.data[0]).map((key) => (
                        <td
                          key={key}
                          className="px-3 py-2 text-gray-700 dark:text-slate-300"
                        >
                          {row[key] ?? '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No report data found for this period.
            </p>
          )}
        </Card>
      )}

      {/* Template Preview */}

      {previewTemplate && (
        <Card className="p-5 mt-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                Template Preview
              </h2>

              <p className="text-sm text-gray-500 dark:text-slate-400">
                {previewTemplate.name}
              </p>
            </div>

            <Btn variant="secondary" onClick={() => setPreviewTemplate(null)}>
              Close
            </Btn>
          </div>

          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase text-gray-500">
                Description
              </p>

              <p className="text-sm text-gray-700 dark:text-slate-300 mt-1">
                {previewTemplate.description || 'No description'}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 mb-2">
                Visibility
              </p>

              <Badge color="blue">{previewTemplate.visibility}</Badge>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 mb-2">
                Report Columns
              </p>

              <div className="flex gap-2 flex-wrap">
                {(previewTemplate.configuration?.columns || []).map(
                  (column) => (
                    <Badge key={column} color="indigo">
                      {column}
                    </Badge>
                  )
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 mb-2">
                Date Range
              </p>

              <Badge color="gray">
                {previewTemplate.configuration?.dateRange || 'monthly'}
              </Badge>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase text-gray-500 mb-2">
                Report Type
              </p>

              <Badge color="blue">
                {previewTemplate.configuration?.reportType || 'custom-summary'}
              </Badge>
            </div>
          </div>
        </Card>
      )}

      {/* Version History */}

      {versionsId && (
        <Card className="p-5 mt-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800 dark:text-white">
              Version History
            </h2>

            <Btn variant="secondary" onClick={() => setVersionsId(null)}>
              Close
            </Btn>
          </div>

          {versionsQuery.isLoading ? (
            <Spinner />
          ) : versionsQuery.data?.length ? (
            <div className="space-y-3">
              {versionsQuery.data.map((version) => (
                <div
                  key={version.id}
                  className="border border-gray-200 dark:border-slate-700 rounded-lg p-4"
                >
                  <div className="flex justify-between">
                    <span className="font-semibold text-gray-800 dark:text-white">
                      Version {version.version_number}
                    </span>

                    <span className="text-xs text-gray-500">
                      {version.created_at
                        ? new Date(version.created_at).toLocaleString()
                        : ''}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No versions found.</p>
          )}
        </Card>
      )}

      {/* Delete Confirmation */}

      <ConfirmationModal
        open={!!deleteId}
        title="Delete Report Template"
        text="This template will be soft deleted. Are you sure?"
        onCancel={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
