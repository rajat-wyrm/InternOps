const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const repo = require('./repository');
const { extractRequestInfo } = require('../../utils/audit');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const { generateAIResponse } = require('../../services/aiProviderService');
const aiRepo = require('../ai/repository');

const NOTICE_CATEGORY_ALIASES = {
  GENERAL: 'GENERAL',
  REMINDER: 'REMINDER',
  ALERT: 'ALERT',
  NEWS: 'NEWS',
  IMPORTANT: 'IMPORTANT',
  ANNOUNCEMENT: 'ANNOUNCEMENT',
  EVENT: 'EVENT',
  INTERNSHIP: 'INTERNSHIP',
  OPPORTUNITY: 'INTERNSHIP',
  CAREER: 'INTERNSHIP',
};

function normalizeNoticeCategory(rawValue) {
  const value = String(rawValue || '')
    .trim()
    .toUpperCase();
  if (!value) return 'GENERAL';

  const directMatch = NOTICE_CATEGORY_ALIASES[value];
  if (directMatch) return directMatch;

  if (
    value.includes('INTERNSHIP') ||
    value.includes('JOB') ||
    value.includes('OPPORTUNITY')
  ) {
    return 'INTERNSHIP';
  }
  if (
    value.includes('EVENT') ||
    value.includes('WEBINAR') ||
    value.includes('SEMINAR')
  ) {
    return 'EVENT';
  }
  if (value.includes('REMINDER')) return 'REMINDER';
  if (value.includes('IMPORTANT') || value.includes('URGENT'))
    return 'IMPORTANT';
  if (value.includes('ANNOUNCEMENT') || value.includes('NOTICE'))
    return 'ANNOUNCEMENT';
  if (value.includes('ALERT')) return 'ALERT';
  if (value.includes('NEWS')) return 'NEWS';
  return 'GENERAL';
}

function normalizeText(value) {
  const text = String(value || '').trim();
  return text.replace(/\s+/g, ' ');
}

function extractDeadline(content) {
  const patterns = [
    /(\b(?:by|before|till|until)\s+)?(?:on\s+)?(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-zA-Z]*\s*,?\s*\d{2,4})/i,
    /(\b(?:by|before|till|until)\s+)?(?:on\s+)?(\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4})/i,
    /(\b(?:by|before|till|until)\s+)?(?:on\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{2,4})/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const candidate = normalizeText(match[2] || match[0]);
      if (candidate && candidate.length < 120) return candidate;
    }
  }

  return 'Not specified';
}

function extractLink(content) {
  const match = content.match(/https?:\/\/[^\s)]+/i);
  return match ? match[0] : '';
}

function extractEligibility(content) {
  const patterns = [
    /eligib(?:ility|le).*?:\s*([^\n.]+(?:\.[^\n.]+)*)/i,
    /required.*?:\s*([^\n.]+(?:\.[^\n.]+)*)/i,
    /students?\s+with\s+([^\n.]+(?:\.[^\n.]+)*)/i,
    /knowledge\s+of\s+([^\n.]+(?:\.[^\n.]+)*)/i,
  ];

  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match) {
      const candidate = normalizeText(match[1] || match[0]);
      if (candidate && candidate.length < 220) return candidate;
    }
  }

  return 'Not specified';
}

function extractAction(content) {
  if (/apply|application|register|registration/i.test(content))
    return 'Apply Now';
  if (/join|register|sign up|enroll/i.test(content)) return 'Register Now';
  if (/learn more|details|more information/i.test(content)) return 'Learn More';
  if (/view|details|read more/i.test(content)) return 'View Details';
  return 'Learn More';
}

function extractTitleFromContent(content) {
  const cleaned = normalizeText(content).replace(/\s+/g, ' ');
  const firstSentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  const compact = firstSentence.replace(
    /^(we are inviting all students to|we invite all students to|students are invited to|interested candidates should|applications are open for|join us for)\s+/i,
    ''
  );
  const trimmed = compact.replace(/\s*[-–—]\s*.*$/, '');
  return trimmed.length > 100
    ? `${trimmed.slice(0, 97).trim()}...`
    : trimmed || 'Notice';
}

function buildFallbackNoticeSuggestion(content) {
  const cleaned = normalizeText(content || '');
  const category = normalizeNoticeCategory(cleaned);
  const title = extractTitleFromContent(cleaned);
  const summary =
    cleaned.length > 160 ? `${cleaned.slice(0, 157).trim()}...` : cleaned;

  return {
    title: title || 'Notice',
    category,
    summary: summary || 'Please review the notice details.',
    deadline: extractDeadline(cleaned),
    eligibility: extractEligibility(cleaned),
    dateTime: 'Not specified',
    link: extractLink(cleaned),
    action: extractAction(cleaned),
    importantDetails: [
      extractDeadline(cleaned),
      extractEligibility(cleaned),
    ].filter((value) => value && value !== 'Not specified'),
    improvedContent: cleaned,
  };
}

function parseAiSuggestionResponse(rawText) {
  if (!rawText) return {};

  let text = rawText.trim();
  text = text
    .replace(/^```json\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  try {
    return JSON.parse(text);
  } catch {
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex >= 0 && endIndex > startIndex) {
      try {
        return JSON.parse(text.slice(startIndex, endIndex + 1));
      } catch {
        return {};
      }
    }
    return {};
  }
}

function normalizeSuggestionOutput(raw, fallbackContent) {
  const parsed = parseAiSuggestionResponse(raw) || {};
  const fallback = buildFallbackNoticeSuggestion(fallbackContent);
  const title = normalizeText(parsed.title || fallback.title);
  const category = normalizeNoticeCategory(
    parsed.category || fallback.category
  );
  const summary = normalizeText(parsed.summary || fallback.summary);
  const deadline = normalizeText(parsed.deadline || fallback.deadline);
  const eligibility = normalizeText(parsed.eligibility || fallback.eligibility);
  const dateTime = normalizeText(
    parsed.dateTime || parsed.datetime || fallback.dateTime
  );
  const link = normalizeText(parsed.link || fallback.link);
  const action = normalizeText(parsed.action || fallback.action);
  const improvedContent = normalizeText(
    parsed.improvedContent || parsed.content || fallback.improvedContent
  );

  return {
    title: title || fallback.title,
    category,
    summary: summary || fallback.summary,
    deadline: deadline || 'Not specified',
    eligibility: eligibility || 'Not specified',
    dateTime: dateTime || 'Not specified',
    link: link || '',
    action: action || fallback.action,
    improvedContent: improvedContent || fallbackContent,
    importantDetails: Array.isArray(parsed.importantDetails)
      ? parsed.importantDetails
          .map((item) => normalizeText(item))
          .filter(Boolean)
      : [deadline, eligibility].filter(
          (item) => item && item !== 'Not specified'
        ),
  };
}

async function noticesRoutes(fastify) {
  //
  fastify.get(
    '/notices',
    {
      schema: {
        tags: ['Notices'],
        description: 'Get all notices (admin)',

        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 50,
            },
          },
        },
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL')],
    },
    async (req, reply) => {
      try {
        const notices = await repo.getAllNotices({
          page: req.query.page,
          limit: req.query.limit,
        });
        return reply.send(notices);
      } catch (err) {
        // If the notices table does not yet exist (migration pending on production)
        // return an empty list with 503 rather than crashing with 500.
        req.log.error({ err }, 'notices table unavailable in GET /notices');
        if (err.code === '42P01') {
          // NOTE: send a bare array here (not { error, notices: [] }) so the
          // response shape always matches the success path — the frontend
          // expects `data` to be an array it can call .map() on directly.
          return reply.status(503).send([]);
        }
        return reply.status(500).send({ error: 'Failed to fetch notices' });
      }
    }
  );

  // PUBLIC — no auth
  fastify.get(
    '/notices/public',
    {
      schema: { tags: ['Notices'], description: 'Get active notices (public)' },
    },
    async (_req, reply) => {
      try {
        const notices = await repo.getActiveNotices();
        return reply.send(notices);
      } catch (err) {
        // If the notices table does not yet exist (migration pending), return an
        // empty list rather than a 500 so the Login page still loads correctly.
        _req.log.warn(
          { err },
          'notices table unavailable – returning empty list'
        );
        return reply.send([]);
      }
    }
  );

  fastify.post(
    '/notices/ai-suggest',
    {
      schema: {
        tags: ['Notices'],
        description: 'Generate AI-powered suggestions for notice content',
        body: toSchema(
          z.object({
            content: z.string().trim().min(1, 'Content is required'),
          })
        ),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
    },
    async (req, reply) => {
      const { content } = req.body;
      const trimmedContent = content?.trim();

      if (!trimmedContent) {
        return reply.status(400).send({ error: 'content is required' });
      }

      const usage = await aiRepo.getTodayUsage(req.user.id);
      if (usage >= Number(process.env.AI_CHAT_DAILY_LIMIT || 100)) {
        return reply.status(429).send({
          error: 'Daily AI usage limit exceeded',
        });
      }

      try {
        const prompt = `You are an expert notice writer for an internship platform. Analyze the following notice content and return ONLY valid JSON with keys: title, category, summary, deadline, eligibility, dateTime, link, action, improvedContent, importantDetails. Use concise, professional wording. If details are missing, set them to "Not specified" or an empty string. Category values should be one of: GENERAL, REMINDER, ALERT, NEWS, IMPORTANT, ANNOUNCEMENT, EVENT, INTERNSHIP. Notice content:\n${trimmedContent}`;

        const result = await generateAIResponse({
          userId: req.user.id,
          messages: [
            {
              role: 'system',
              content:
                'You extract structured notice data. Return only valid JSON in the exact schema requested. Never add extra text outside JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        await aiRepo.incrementUsage(req.user.id);

        const suggestion = normalizeSuggestionOutput(
          result?.content,
          trimmedContent
        );

        return reply.send(suggestion);
      } catch (error) {
        const fallback = buildFallbackNoticeSuggestion(trimmedContent);

        req.log.warn(
          { err: error?.message || error },
          'notice AI suggestion failed; using fallback suggestion'
        );

        return reply.send(fallback);
      }
    }
  );

  // PROTECTED — admin + senior_tl
  fastify.post(
    '/notices',
    {
      schema: {
        tags: ['Notices'],
        description: 'Create a notice',
        body: toSchema(
          z.object({
            title: z.string().trim().min(1, 'Title is required'),
            content: z.string().trim().min(1, 'Content is required'),
            category: z
              .enum([
                'GENERAL',
                'REMINDER',
                'ALERT',
                'NEWS',
                'IMPORTANT',
                'ANNOUNCEMENT',
                'EVENT',
                'INTERNSHIP',
                'DEADLINE',
              ])
              .optional(),
            image_url: z
              .string()
              .url()
              .or(z.string().startsWith('/'))
              .optional(),
            action_button_text: z.string().max(50).optional(),
            action_button_link: z
              .string()
              .url()
              .or(z.string().startsWith('/'))
              .optional(),
            is_featured: z.boolean().optional(),
          })
        ),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
    },
    async (req, reply) => {
      const {
        title,
        content,
        category,
        image_url,
        action_button_text,
        action_button_link,
        is_featured,
      } = req.body;
      if (!title?.trim())
        return reply.status(400).send({ error: 'title is required' });
      if (!content?.trim())
        return reply.status(400).send({ error: 'content is required' });

      const notice = await repo.createNotice({
        title: title.trim(),
        content: content.trim(),
        category: normalizeNoticeCategory(category ?? 'GENERAL'),
        image_url,
        action_button_text,
        action_button_link,
        is_featured,
        createdBy: req.user.id,
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'NOTICE_CREATED',
        resourceType: 'notice',
        resourceId: notice.id,
        details: { title: notice.title, category: notice.category },
        ...extractRequestInfo(req),
      };
      return reply.status(201).send(notice);
    }
  );

  fastify.patch(
    '/notices/:id',
    {
      schema: {
        tags: ['Notices'],
        description: 'Update a notice',
        params: toSchema(z.object({ id: z.string() })),
        body: toSchema(
          z.object({
            title: z.string().trim().min(1, 'Title cannot be empty').optional(),
            content: z
              .string()
              .trim()
              .min(1, 'Content cannot be empty')
              .optional(),
            category: z
              .enum([
                'GENERAL',
                'REMINDER',
                'ALERT',
                'NEWS',
                'IMPORTANT',
                'ANNOUNCEMENT',
                'EVENT',
                'INTERNSHIP',
                'DEADLINE',
              ])
              .optional(),
            image_url: z
              .string()
              .url()
              .or(z.string().startsWith('/'))
              .optional(),
            action_button_text: z.string().max(50).optional(),
            action_button_link: z
              .string()
              .url()
              .or(z.string().startsWith('/'))
              .optional(),
            is_featured: z.boolean().optional(),
            is_active: z.boolean().optional(),
          })
        ),
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL'), sanitize],
    },
    async (req, reply) => {
      const { id } = req.params;
      const {
        title,
        content,
        category,
        image_url,
        action_button_text,
        action_button_link,
        is_featured,
        is_active,
      } = req.body;

      if (title !== undefined && !title.trim()) {
        return reply.status(400).send({
          error: 'title cannot be empty',
        });
      }

      if (content !== undefined && !content.trim()) {
        return reply.status(400).send({
          error: 'content cannot be empty',
        });
      }
      const updated = await repo.updateNotice(id, {
        title,
        content,
        category: category ? normalizeNoticeCategory(category) : category,
        image_url,
        action_button_text,
        action_button_link,
        is_featured,
        is_active,
      });
      if (!updated)
        return reply.status(404).send({ error: 'Notice not found' });
      const action =
        is_active === false ? 'NOTICE_DEACTIVATED' : 'NOTICE_UPDATED';
      req.auditOnResponse = {
        userId: req.user.id,
        action,
        resourceType: 'notice',
        resourceId: updated.id,
        details: { title: updated.title },
        ...extractRequestInfo(req),
      };
      return reply.send(updated);
    }
  );

  fastify.delete(
    '/notices/:id',
    {
      schema: {
        tags: ['Notices'],
        description: 'Soft-delete a notice',
        params: toSchema(z.object({ id: z.string() })),
      },
      preHandler: [auth, rbac('ADMIN')],
    },
    async (req, reply) => {
      const { id } = req.params;
      const deleted = await repo.softDeleteNotice(id);
      if (!deleted)
        return reply.status(404).send({ error: 'Notice not found' });
      req.auditOnResponse = {
        userId: req.user.id,
        action: 'NOTICE_DELETED',
        resourceType: 'notice',
        resourceId: deleted.id,
        ...extractRequestInfo(req),
      };
      return reply.status(204).send();
    }
  );
}

module.exports = noticesRoutes;
