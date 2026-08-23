'use strict';

const { generateAIResponse } = require('../../services/aiProviderService');
const repo = require('./repository');

const MAX_PROMPT_INPUT_CHARS = 2000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeItem(item) {
  return {
    title: item.title,
    description: typeof item.description === 'string' ? item.description : '',
    dueDayOffset:
      Number.isInteger(item.dueDayOffset) && item.dueDayOffset >= 0
        ? item.dueDayOffset
        : null,
    socialTaskId:
      typeof item.socialTaskId === 'string' ? item.socialTaskId : null,
  };
}

function validateItems(items) {
  if (!Array.isArray(items)) return false;
  return items.every(
    (item) =>
      item &&
      typeof item === 'object' &&
      typeof item.title === 'string' &&
      item.title.trim()
  );
}

// ── Service functions ─────────────────────────────────────────────────────────

/**
 * Generate an AI-assisted onboarding checklist for a given role/department.
 * Returns { title, role, department, items, provider, cached }.
 */
async function generateChecklist({ userId, role, department }) {
  if (typeof role !== 'string' || typeof department !== 'string') {
    const err = new Error('role and department must be strings');
    err.statusCode = 400;
    throw err;
  }

  if (
    role.length > MAX_PROMPT_INPUT_CHARS ||
    department.length > MAX_PROMPT_INPUT_CHARS
  ) {
    const err = new Error('role or department exceeds maximum length');
    err.statusCode = 400;
    throw err;
  }
  const prompt = `
Generate an onboarding checklist for a new intern.

Role: ${role}
Department: ${department}

Return ONLY valid JSON in this format:

{
  "title": "Onboarding Checklist",
  "items": [
    {
      "title": "Task title",
      "description": "Short description",
      "dueDayOffset": 1
    }
  ]
}

Requirements:
- Make the checklist specific to the role and department.
- Include relevant documents to read.
- Include people or teams to meet.
- Include initial environment/setup tasks.
- Include first tasks the intern should complete.
- dueDayOffset must be a non-negative integer.
- Return only valid JSON.
`;

  const result = await generateAIResponse({
    userId,
    messages: [{ role: 'user', content: prompt }],
  });

  let checklist;
  let content = result.content.trim();

  // Providers sometimes wrap JSON in markdown fences.
  if (content.startsWith('```')) {
    content = content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  checklist = JSON.parse(content); // throws if invalid — caller handles

  if (
    !checklist ||
    typeof checklist !== 'object' ||
    typeof checklist.title !== 'string' ||
    !Array.isArray(checklist.items)
  ) {
    const err = new Error('AI returned an invalid checklist structure');
    err.statusCode = 502;
    throw err;
  }

  const items = checklist.items
    .filter(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof item.title === 'string' &&
        item.title.trim()
    )
    .map(normalizeItem);

  return {
    title: checklist.title,
    role,
    department,
    items,
    provider: result.provider,
    cached: result.cached,
  };
}

/**
 * Save an edited checklist as a reusable template.
 */
async function saveTemplate({ title, role, departmentId, createdBy, items }) {
  if (!validateItems(items)) {
    const err = new Error('items must be a valid checklist item array');
    err.statusCode = 400;
    throw err;
  }

  return repo.createTemplate({
    title,
    role,
    departmentId,
    createdBy,
    items: items.map(normalizeItem),
  });
}

/**
 * Find a reusable template matching role + optional departmentId.
 */
async function findTemplate({ role, departmentId }) {
  return repo.findTemplate(role, departmentId || null);
}

/**
 * Get a single template by ID.
 */
async function getTemplateById(templateId) {
  return repo.getTemplateById(templateId);
}

/**
 * Attach an onboarding checklist to an intern.
 */
async function assignChecklist({
  internId,
  templateId,
  title,
  role,
  departmentId,
  assignedBy,
  items,
}) {
  if (!validateItems(items)) {
    const err = new Error('items must be a valid checklist item array');
    err.statusCode = 400;
    throw err;
  }

  return repo.createChecklist({
    internId,
    templateId: templateId || null,
    title,
    role,
    departmentId: departmentId || null,
    assignedBy,
    items: items.map(normalizeItem),
  });
}

/**
 * Get a checklist by ID.
 */
async function getChecklistById(checklistId) {
  return repo.getChecklistById(checklistId);
}

/**
 * Get all checklists assigned to an intern.
 */
async function getChecklistsForIntern(internId) {
  return repo.getChecklistsForIntern(internId);
}

/**
 * Mark a checklist item complete or incomplete.
 */
async function updateItemCompletion({ itemId, checklistId, completed }) {
  return repo.updateChecklistItemCompletion({ itemId, checklistId, completed });
}

module.exports = {
  generateChecklist,
  saveTemplate,
  findTemplate,
  getTemplateById,
  assignChecklist,
  getChecklistById,
  getChecklistsForIntern,
  updateItemCompletion,
  // Exported for use in routes and tests
  normalizeItem,
  validateItems,
};
