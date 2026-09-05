const repo = require('./repository');

async function createTemplate(data) {
  return repo.createTemplate(data);
}

async function getTemplates(filters = {}) {
  return repo.getAll(filters);
}

async function getTemplate(id) {
  const template = await repo.getById(id);

  if (!template) {
    const error = new Error('Report template not found');
    error.status = 404;
    throw error;
  }

  return template;
}

async function updateTemplate(id, data) {
  const existing = await repo.getById(id);

  if (!existing) {
    const error = new Error('Report template not found');
    error.status = 404;
    throw error;
  }

  return repo.updateTemplate(id, data);
}

async function deleteTemplate(id) {
  const existing = await repo.getById(id);

  if (!existing) {
    const error = new Error('Report template not found');
    error.status = 404;
    throw error;
  }

  return repo.deleteTemplate(id);
}

async function getVersions(templateId) {
  const existing = await repo.getById(templateId);

  if (!existing) {
    const error = new Error('Report template not found');
    error.status = 404;
    throw error;
  }

  return repo.getVersions(templateId);
}

async function createVersion(templateId, configuration, createdBy) {
  const existing = await repo.getById(templateId);

  if (!existing) {
    const error = new Error('Report template not found');
    error.status = 404;
    throw error;
  }

  const versionNumber = await repo.getNextVersionNumber(templateId);

  return repo.createVersion({
    templateId,
    versionNumber,
    configuration,
    createdBy,
  });
}

module.exports = {
  createTemplate,
  getTemplates,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  getVersions,
  createVersion,
};
