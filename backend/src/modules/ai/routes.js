const auth = require('../../middleware/auth');
const {
  generateAIResponse,
  getProviderHealth,
} = require('../../services/aiProviderService');

async function routes(fastify) {
  fastify.post('/chat', { preHandler: [auth] }, async (req, reply) => {
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
        messages: finalMessages,
      });

      return {
        provider: result.provider,
        cached: result.cached,
        content: result.content,
      };
    } catch (error) {
      return reply.status(503).send({
        error: 'AI service unavailable',
        details: error.details || [],
      });
    }
  });

  fastify.get('/health', { preHandler: [auth] }, async () => {
    return {
      providers: getProviderHealth(),
    };
  });
}

module.exports = routes;
