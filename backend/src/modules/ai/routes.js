const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const {
  generateAIResponse,
  getProviderHealth,
} = require('../../services/aiProviderService');

async function routes(fastify) {
  fastify.post(
    '/chat',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
          keyGenerator: (req) => req.ip,
        },
      },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN')],
    },
    async (req, reply) => {
      const { messages, prompt } = req.body || {};

      const finalMessages =
        Array.isArray(messages) && messages.length > 0
          ? messages
          : [{ role: 'user', content: prompt }];

      if (!finalMessages[0]?.content) {
        return reply.status(400).send({
          error: 'Prompt or messages are required',
        });
      }

      try {
        const result = await generateAIResponse({
          userId: req.user.id,
          messages: finalMessages,
        });
        return {
          provider: result.provider,
          cached: result.cached,
          content: result.content,
        };
      } catch (error) {
        if (error.statusCode === 413) {
          return reply.status(413).send({
            error: 'AI provider response too large',
          });
        }

        return reply.status(503).send({
          error: 'AI service unavailable',
          details: error.details || [],
        });
      }
    }
  );

  fastify.get(
    '/health',
    {
      preHandler: [auth, rbac('ADMIN')],
    },
    async () => {
      return {
        providers: getProviderHealth(),
      };
    }
  );
}

module.exports = routes;
