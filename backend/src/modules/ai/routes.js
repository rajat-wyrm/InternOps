const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const {
  generateAIResponse,
  getProviderHealth,
} = require('../../services/aiProviderService');

const AI_CHAT_RATE_LIMIT = Number(process.env.AI_CHAT_RATE_LIMIT_PER_MIN || 10);

async function routes(fastify) {
  fastify.post(
    '/chat',
    {
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL')],
      bodyLimit: 10485760,
      config: {
        rateLimit: {
          max: AI_CHAT_RATE_LIMIT,
          timeWindow: '1 minute',
          keyGenerator: (req) => req.user?.id || req.ip,
        },
      },
    },
    async (req, reply) => {
      if (req.body && JSON.stringify(req.body).length > 2000000) {
        return reply.status(400).send({ error: 'Payload too large' });
      }
      const ALLOWED_ROLES = ['user', 'assistant'];

      let finalMessages = [];
      const { messages, prompt } = req.body || {};

      if (Array.isArray(messages)) {
        for (const msg of messages) {
          if (
            !msg ||
            typeof msg !== 'object' ||
            !ALLOWED_ROLES.includes(msg.role)
          ) {
            return reply.status(400).send({
              error: 'Invalid message role',
            });
          }
        }

        finalMessages = messages.slice(0, 16).map((msg) => ({
          role: msg.role,
          content: String(msg.content || '').slice(0, 2000),
        }));
      }

      if (finalMessages.length === 0 && prompt) {
        finalMessages = [
          {
            role: 'user',
            content: String(prompt).slice(0, 2000),
          },
        ];
      }

      if (finalMessages.length === 0) {
        return reply.status(400).send({
          error: 'Prompt or valid messages are required',
        });
      }
      // if()
      //   Array.isArray(messages) && messages.length > 0
      //     ? messages
      //     : [{ role: 'user', content: prompt }];

      // if (!finalMessages[0]?.content) {
      //   return reply.status(400).send({
      //     error: 'Prompt or messages are required',
      //   });
      // }

      const MAX_MESSAGES = 32;
      const MAX_MESSAGE_CHARS = 4000;
      const MAX_TOTAL_CHARS = 32000;
      if (finalMessages.length > MAX_MESSAGES) {
        return reply.status(413).send({
          error: 'Too many messages',
        });
      }

      let totalChars = 0;

      for (const msg of finalMessages) {
        const content = String(msg.content || '');

        if (content.length > MAX_MESSAGE_CHARS) {
          return reply.status(413).send({
            error: 'Message exceeds maximum length',
          });
        }

        totalChars += content.length;
      }

      if (totalChars > MAX_TOTAL_CHARS) {
        return reply.status(413).send({
          error: 'Prompt too long',
        });
      }

      if (finalMessages.some((msg) => !msg.content || !msg.content.trim())) {
        return reply.status(400).send({
          error: 'Message content cannot be empty',
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

        req.log.error(
          { err: error.message, details: error.details },
          'AI provider failed'
        );
        return reply.status(503).send({
          error: 'AI service unavailable',
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
