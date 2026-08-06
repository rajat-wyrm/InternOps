const { z } = require('zod');

const githubIssuePayloadSchema = z.object({
  action: z.string(),
  issue: z.object({
    id: z.number(),
    number: z.number(),
    title: z.string(),
    body: z.string().nullable().optional(),
    state: z.string(),
    html_url: z.string().url(),
    labels: z
      .array(
        z.object({
          id: z.number(),
          name: z.string(),
          color: z.string().optional(),
          description: z.string().nullable().optional(),
        })
      )
      .optional()
      .default([]),
    assignees: z
      .array(
        z.object({
          id: z.number(),
          login: z.string(),
          email: z.string().email().nullable().optional(),
        })
      )
      .optional()
      .default([]),
    created_at: z.string(),
    updated_at: z.string(),
    closed_at: z.string().nullable().optional(),
    user: z.object({
      id: z.number(),
      login: z.string(),
      email: z.string().email().nullable().optional(),
    }),
  }),
  repository: z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    html_url: z.string().url(),
    owner: z.object({
      login: z.string(),
      email: z.string().email().nullable().optional(),
    }),
  }),
  sender: z.object({
    id: z.number(),
    login: z.string(),
    email: z.string().email().nullable().optional(),
  }),
});

const webhookHeadersSchema = z.object({
  'x-github-event': z.string(),
  'x-hub-signature-256': z.string(),
  'x-github-delivery': z.string().uuid(),
});

const syncRequestSchema = z.object({
  repo: z.string().min(1).max(255).optional(),
  assignOnSync: z.boolean().optional().default(false),
});

const syncStatusResponseSchema = z.object({
  configured: z.boolean(),
  repo: z.string().nullable(),
  webhookRegistered: z.boolean(),
  lastSyncAt: z.string().nullable(),
  totalSynced: z.number(),
  failedSyncs: z.number(),
  recentLogs: z.array(z.any()),
});

const webhookResponseSchema = z.object({
  received: z.boolean(),
  event: z.string(),
  action: z.string().nullable(),
  processed: z.boolean(),
  taskId: z.string().uuid().nullable(),
  message: z.string(),
});

module.exports = {
  githubIssuePayloadSchema,
  webhookHeadersSchema,
  syncRequestSchema,
  syncStatusResponseSchema,
  webhookResponseSchema,
};
