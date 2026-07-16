import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  ExternalLink,
  Download,
  Palette,
  Check,
  X,
  RefreshCw,
} from 'lucide-react';
import { PageHeader, Card, Badge, Spinner } from '../../components/ui';
import {
  useCanvaStatus,
  useCanvaAuthUrl,
  useCanvaDesigns,
  useCanvaImport,
} from '../../hooks/useCanva';
import {
  useTemplates,
  useCreateTemplate,
  useDeleteTemplate,
} from '../../hooks/useCertificates';

export default function CanvaTemplates() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    colorScheme: ['#3B82F6', '#10B981', '#F59E0B'],
  });

  useEffect(() => {
    if (!showCreateModal) return;
    const handleKey = (e) => e.key === 'Escape' && setShowCreateModal(false);
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [showCreateModal]);

  useEffect(() => {
    if (!showCreateModal) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [showCreateModal]);

  const { data: canvaStatusResp, isLoading: statusLoading } = useCanvaStatus();
  const canvaStatus = canvaStatusResp?.data || {};
  const { data: authUrlResp } = useCanvaAuthUrl();
  const authUrlData = authUrlResp?.data || {};
  const {
    data: canvaDesignsResp,
    isLoading: designsLoading,
    refetch: refetchDesigns,
  } = useCanvaDesigns();
  const canvaDesigns = canvaDesignsResp?.data || [];
  const {
    data: templatesResp,
    isLoading: templatesLoading,
    refetch: refetchTemplates,
  } = useTemplates();
  const templates = templatesResp?.data || [];
  const importMutation = useCanvaImport();
  const createMutation = useCreateTemplate();
  const deleteMutation = useDeleteTemplate();

  const isConnected = canvaStatus?.connected;

  const handleConnectCanva = () => {
    if (authUrlData?.url) {
      window.open(authUrlData.url, '_blank', 'width=600,height=700');
    }
  };

  const handleImportDesign = async (design) => {
    try {
      await importMutation.mutateAsync(design.id);
      refetchTemplates();
    } catch (error) {
      console.error('Failed to import design:', error);
    }
  };

  const handleCreateTemplate = async (e) => {
    e.preventDefault();
    try {
      await createMutation.mutateAsync(newTemplate);
      setShowCreateModal(false);
      setNewTemplate({
        name: '',
        description: '',
        colorScheme: ['#3B82F6', '#10B981', '#F59E0B'],
      });
      refetchTemplates();
    } catch (error) {
      console.error('Failed to create template:', error);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      try {
        await deleteMutation.mutateAsync(templateId);
        refetchTemplates();
      } catch (error) {
        console.error('Failed to delete template:', error);
      }
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await createMutation.mutateAsync({ seed: true });
      refetchTemplates();
    } catch (error) {
      console.error('Failed to seed templates:', error);
    }
  };

  const addColorToScheme = () => {
    const colors = ['#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    setNewTemplate((prev) => ({
      ...prev,
      colorScheme: [...prev.colorScheme, randomColor],
    }));
  };

  const removeColorFromScheme = (index) => {
    setNewTemplate((prev) => ({
      ...prev,
      colorScheme: prev.colorScheme.filter((_, i) => i !== index),
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <PageHeader
        title="Templates & Canva"
        icon="🎨"
        description="Manage certificate templates and connect to Canva for design imports"
      />

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Connection Status Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                <Palette className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Canva Integration
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Connect to Canva to import designs as certificate templates
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {statusLoading ? (
                <Spinner size="sm" />
              ) : (
                <Badge variant={isConnected ? 'success' : 'danger'}>
                  {isConnected ? (
                    <span className="flex items-center gap-1">
                      <Check className="w-3 h-3" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <X className="w-3 h-3" />
                      Not Connected
                    </span>
                  )}
                </Badge>
              )}

              {!isConnected && (
                <button
                  onClick={handleConnectCanva}
                  disabled={!authUrlData?.url}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                >
                  <ExternalLink className="w-4 h-4" />
                  Connect to Canva
                </button>
              )}
            </div>
          </div>
        </Card>

        {/* Canva Designs Section */}
        {isConnected && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Canva Designs
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Import your Canva designs as certificate templates
                </p>
              </div>
              <button
                onClick={() => refetchDesigns()}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>

            {designsLoading ? (
              <div className="flex justify-center py-12">
                <Spinner size="lg" />
              </div>
            ) : canvaDesigns?.length === 0 ? (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No designs found in your Canva account</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {canvaDesigns?.map((design) => (
                  <div
                    key={design.id}
                    className="group relative bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-all hover:shadow-lg"
                  >
                    <div className="aspect-video bg-gray-200 dark:bg-gray-700">
                      {design.thumbnail ? (
                        <img
                          src={design.thumbnail}
                          alt={design.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex items-center justify-center h-full">
                          <Palette className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate mb-2">
                        {design.title || 'Untitled Design'}
                      </h4>
                      <button
                        onClick={() => handleImportDesign(design)}
                        disabled={importMutation.isPending}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                      >
                        {importMutation.isPending ? (
                          <Spinner size="sm" />
                        ) : (
                          <>
                            <Download className="w-4 h-4" />
                            Import as Template
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Local Templates Section */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Local Templates
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage your certificate templates
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSeedDefaults}
                disabled={createMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                <Palette className="w-4 h-4" />
                Seed Default Templates
              </button>
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Palette className="w-4 h-4" />
                Create Template
              </button>
            </div>
          </div>

          {templatesLoading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : templates?.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No templates yet. Create one or seed default templates.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {templates?.map((template) => (
                <div
                  key={template.id}
                  className="group relative bg-white dark:bg-gray-800 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-lg"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {template.name}
                      </h4>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {template.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 line-clamp-2">
                        {template.description}
                      </p>
                    )}

                    {/* Color Scheme Preview */}
                    <div className="flex items-center gap-1">
                      {template.colorScheme?.slice(0, 5).map((color, index) => (
                        <div
                          key={index}
                          className="w-6 h-6 rounded-full border-2 border-white dark:border-gray-900 shadow-sm"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      {template.colorScheme?.length > 5 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                          +{template.colorScheme.length - 5}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="px-4 pb-4">
                    <div className="text-xs text-gray-400 dark:text-gray-500">
                      Created{' '}
                      {new Date(template.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Create Template Modal */}
      {showCreateModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
              <div
                className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75 dark:bg-gray-900 dark:bg-opacity-75"
                onClick={() => setShowCreateModal(false)}
              />

              <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-bottom transition-all transform bg-white dark:bg-gray-800 shadow-xl rounded-2xl sm:my-8 sm:align-middle sm:max-w-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3
                    id="modal-title"
                    className="text-lg font-semibold text-gray-900 dark:text-white"
                  >
                    Create New Template
                  </h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleCreateTemplate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Template Name
                    </label>
                    <input
                      type="text"
                      value={newTemplate.name}
                      onChange={(e) =>
                        setNewTemplate((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter template name"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Description
                    </label>
                    <textarea
                      value={newTemplate.description}
                      onChange={(e) =>
                        setNewTemplate((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter template description"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Color Scheme
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {newTemplate.colorScheme.map((color, index) => (
                        <div key={index} className="relative group">
                          <input
                            type="color"
                            value={color}
                            onChange={(e) => {
                              const newColors = [...newTemplate.colorScheme];
                              newColors[index] = e.target.value;
                              setNewTemplate((prev) => ({
                                ...prev,
                                colorScheme: newColors,
                              }));
                            }}
                            className="w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-200 dark:border-gray-600"
                          />
                          <button
                            type="button"
                            onClick={() => removeColorFromScheme(index)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addColorToScheme}
                        className="w-10 h-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-6">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={
                        createMutation.isPending || !newTemplate.name.trim()
                      }
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {createMutation.isPending ? (
                        <Spinner size="sm" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Create Template
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
