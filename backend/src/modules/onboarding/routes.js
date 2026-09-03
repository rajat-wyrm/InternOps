'use strict';

const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { extractRequestInfo } = require('../../utils/audit');
const { generateAIResponse } = require('../../services/aiProviderService');

const itemSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  due_day_offset: z.number().int().optional(),
  social_task_id: z.string().uuid().optional(),
  position: z.number().int().optional(),
});

const generateSchema = z.object({
  role: z.string().min(1).max(255),
  department: z.string().max(255).optional(),
});

const saveTemplateSchema = z.object({
  role: z.string().min(1).max(255),
  department: z.string().max(255).optional(),
  title: z.string().min(1).max(255),
  items: z.array(itemSchema).min(1),
});

const createChecklistSchema = z.object({
  internId: z.string().uuid(),
  title: z.string().min(1).max(255),
  role: z.string().min(1).max(255),
  department: z.string().max(255).optional(),
  items: z.array(itemSchema).min(1),
});

const updateChecklistSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  role: z.string().min(1).max(255).optional(),
  department: z.string().max(255).optional(),
  items: z.array(itemSchema).optional(),
});

const completeItemSchema = z.object({
  completed: z.boolean(),
});

const MANAGER_ROLES = ['ADMIN', 'SENIOR_TL', 'TL'];

async function buildChecklistWithAI(role, department, userId) {
  const prompt = `Generate an onboarding checklist for a new intern joining as "${role}"${
    department ? ` in the "${department}" department` : ''
  }. Return ONLY valid JSON, no markdown, no commentary, in this exact shape:
{"title": string, "items": [{"title": string, "description": string, "due_day_offset": number}]}
Include 5 to 10 items covering docs to read, people to meet, and first tasks. due_day_offset is the number of days after the intern's join date the item is due (0 = day one).`;

  const result = await generateAIResponse({
    userId,
    messages: [{ role: 'user', content: prompt }],
  });

  let parsed;

  try {
    const cleaned = result.content.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const error = new Error('AI returned an invalid checklist format');
    error.statusCode = 502;
    throw error;
  }

  if (!parsed.title || !Array.isArray(parsed.items)) {
    const error = new Error('AI returned an invalid checklist format');
    error.statusCode = 502;
    throw error;
  }

  return {
    title: parsed.title,
    items: parsed.items.map((item, i) => ({
      title: String(item.title || '').slice(0, 255),
      description: item.description
        ? String(item.description).slice(0, 2000)
        : null,
      due_day_offset: Number.isInteger(item.due_day_offset)
        ? item.due_day_offset
        : null,
      position: i,
    })),
  };
}

module.exports = async function onboardingRoutes(fastify) {
  // Generate an AI-assisted onboarding checklist.
  fastify.post(
    '/generate',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 minute',
          keyGenerator: (req) => req.user?.id || req.ip,
        },
      },
      schema: {
        tags: ['Onboarding'],
        description: 'Generate an onboarding checklist draft via AI',
        body: toSchema(generateSchema),
      },
      preHandler: [auth, rbac(...MANAGER_ROLES), sanitize],
    },
    async (req, reply) => {
      const parsed = generateSchema.safeParse(req.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }

      const { role, department } = parsed.data;

      const existing = await repo.findTemplate(
        role,
        department || req.user.departmentId || null
      );

      if (existing) {
        return { source: 'template', ...existing };
      }

      try {
        const draft = await buildChecklistWithAI(role, department, req.user.id);

        return {
          source: 'ai',
          role,
          department: department || null,
          ...draft,
        };
      } catch (error) {
        req.log.error(
          { err: error.message },
          'Onboarding AI generation failed'
        );

        return reply
          .status(error.statusCode || 503)
          .send({ error: error.message || 'AI service unavailable' });
      }
    }
  );

  // Save an edited draft as a reusable template.
  fastify.post(
    '/templates',
    {
      schema: {
        tags: ['Onboarding'],
        description: 'Save a checklist as a reusable per-role template',
        body: toSchema(saveTemplateSchema),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
    },
    async (req, reply) => {
      const parsed = saveTemplateSchema.safeParse(req.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }

      const { role, department, title, items } = parsed.data;

      const template = await repo.createTemplate({
        role,
        departmentId: department || req.user.departmentId || null,
        title,
        createdBy: req.user.id,
        items,
      });

      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'ONBOARDING_TEMPLATE_SAVED',
        resourceType: 'onboarding_template',
        resourceId: template.id,
        details: { role, department },
      };

      return reply.status(201).send(template);
    }
  );

  // Find reusable template for role + department.
  fastify.get(
    '/templates/match',
    {
      schema: {
        tags: ['Onboarding'],
        description: 'Find a reusable onboarding template',
      },
      preHandler: [auth, rbac(...MANAGER_ROLES)],
    },
    async (req, reply) => {
      const { role, departmentId } = req.query || {};

      if (typeof role !== 'string' || !role.trim()) {
        return reply.status(400).send({ error: 'role is required' });
      }

      const template = await repo.findTemplate(
        role.trim(),
        departmentId || req.user.departmentId || null
      );

      if (!template) {
        return reply
          .status(404)
          .send({ error: 'No onboarding template found' });
      }

      return template;
    }
  );

  // Get a template by ID.
  fastify.get(
    '/templates/:templateId',
    {
      preHandler: [auth, rbac(...MANAGER_ROLES)],
      schema: {
        tags: ['Onboarding'],
        description: 'Get an onboarding template by ID',
      },
    },
    async (req, reply) => {
      const template = await repo.getTemplateById(req.params.templateId);

      if (!template) {
        return reply
          .status(404)
          .send({ error: 'Onboarding template not found' });
      }

      return template;
    }
  );

  // Attach an onboarding checklist to an intern.
  fastify.post(
    '/',
    {
      schema: {
        tags: ['Onboarding'],
        description: 'Attach an onboarding checklist to an intern',
        body: toSchema(createChecklistSchema),
      },
      preHandler: [auth, rbac(...MANAGER_ROLES), sanitize],
    },
    async (req, reply) => {
      const parsed = createChecklistSchema.safeParse(req.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }

      const { internId, title, role, department, items } = parsed.data;

      const checklist = await repo.createChecklist({
        internId,
        title,
        role,
        departmentId: department || req.user.departmentId || null,
        assignedBy: req.user.id,
        items,
      });

      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'ONBOARDING_CHECKLIST_CREATED',
        resourceType: 'onboarding_checklist',
        resourceId: checklist.id,
        details: { internId, role, department },
      };

      return reply.status(201).send(checklist);
    }
  );

  // Edit an existing checklist.
  fastify.patch(
    '/:id',
    {
      schema: {
        tags: ['Onboarding'],
        description: 'Edit an onboarding checklist',
        body: toSchema(updateChecklistSchema),
      },
      preHandler: [auth, rbac(...MANAGER_ROLES), sanitize],
    },
    async (req, reply) => {
      const parsed = updateChecklistSchema.safeParse(req.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }

      const { title, role, department, items } = parsed.data;

      const checklist = await repo.updateChecklist(
        req.params.id,
        { title, role, department },
        items
      );

      if (!checklist) {
        return reply.status(404).send({ error: 'Checklist not found' });
      }

      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'ONBOARDING_CHECKLIST_UPDATED',
        resourceType: 'onboarding_checklist',
        resourceId: checklist.id,
        details: {},
      };

      return checklist;
    }
  );

  // Get an intern's onboarding checklists.
  fastify.get(
    '/intern/:internId',
    {
      schema: {
        tags: ['Onboarding'],
        description: "Get an intern's onboarding checklist",
      },
      preHandler: [auth],
    },
    async (req, reply) => {
      const { internId } = req.params;
      const isSelf = req.user.id === internId;
      const isManager = MANAGER_ROLES.includes(req.user.role);

      if (!isSelf && !isManager) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const checklists = await repo.getChecklistsForIntern(internId);

      if (!checklists.length) {
        return reply.status(404).send({ error: 'No checklist found' });
      }

      return checklists;
    }
  );

  // Mark a checklist item complete/incomplete.
  fastify.patch(
    '/items/:itemId/complete',
    {
      schema: {
        tags: ['Onboarding'],
        description: 'Toggle a checklist item as completed',
        body: toSchema(completeItemSchema),
      },
      preHandler: [auth, sanitize],
    },
    async (req, reply) => {
      const parsed = completeItemSchema.safeParse(req.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: parsed.error.issues,
        });
      }

      const item = await repo.updateChecklistItemCompletion({
        itemId: req.params.itemId,
        checklistId: req.body.checklistId,
        completed: parsed.data.completed,
      });

      if (!item) {
        return reply.status(404).send({ error: 'Checklist item not found' });
      }

      req.auditOnResponse = {
        userId: req.user.id,
        ...extractRequestInfo(req),
        action: 'ONBOARDING_ITEM_TOGGLED',
        resourceType: 'onboarding_checklist_item',
        resourceId: item.id,
        details: { completed: parsed.data.completed },
      };

      return item;
    }
  );
};
