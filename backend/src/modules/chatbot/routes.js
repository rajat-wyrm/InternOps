'use strict';

const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');
const auth = require('../../middleware/auth');
const {
  sanitizationMiddleware: sanitize,
} = require('../../middleware/sanitize');
const chatbotService = require('./service');

const messageBodySchema = z.object({
  message: z
    .string({
      required_error: 'Message is required',
      invalid_type_error: 'Message must be a string',
    })
    .trim()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message cannot exceed 2000 characters'),
});

async function routes(fastify) {
  fastify.post(
    '/message',
    {
      schema: {
        tags: ['Chatbot'],
        description: 'Send a message to the AIML Intern Support Chatbot',
        body: toSchema(messageBodySchema),
        response: {
          200: {
            type: 'object',
            required: ['response', 'source'],
            properties: {
              response: { type: 'string' },
              source: {
                type: 'string',
                enum: ['aiml', 'knowledge_base', 'fallback'],
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
              details: { type: 'array' },
            },
          },
        },
      },
      preHandler: [auth, sanitize],
      config: {
        rateLimit: {
          max: 60,
          timeWindow: '1 minute',
          keyGenerator: (req) => req.user?.id || req.ip,
        },
      },
    },
    async (req, reply) => {
      const parsed = messageBodySchema.safeParse(req.body);

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          message: parsed.error.issues[0]?.message || 'Invalid message',
          details: parsed.error.issues,
        });
      }

      const { message } = parsed.data;

      try {
        const canViewSensitive = ['ADMIN', 'SENIOR_TL', 'HR'].includes(
          req.user?.role
        );
        const result = await chatbotService.processMessage(message, {
          userId: req.user?.id,
          canViewSensitive,
        });

        return reply.status(200).send(result);
      } catch (err) {
        req.log.error({ err }, 'Chatbot processing error');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'An error occurred while processing your request.',
          code: 'CHATBOT_PROCESSING_ERROR',
        });
      }
    }
  );
}

module.exports = routes;
