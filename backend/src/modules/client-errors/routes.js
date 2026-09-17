module.exports = async function clientErrorRoutes(fastify) {
  fastify.post(
    '/',
    {
      schema: {
        body: {
          type: 'object',
          required: ['message'],
          additionalProperties: false,
          properties: {
            message: {
              type: 'string',
              maxLength: 2000,
            },
            stack: {
              type: 'string',
              maxLength: 10000,
            },
            componentStack: {
              type: 'string',
              maxLength: 10000,
            },
            url: {
              type: 'string',
              maxLength: 2048,
            },
            userAgent: {
              type: 'string',
              maxLength: 1000,
            },
            timestamp: {
              type: 'string',
              maxLength: 100,
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { message, stack, componentStack, url, userAgent, timestamp } =
        request.body;

      request.log.error(
        {
          type: 'client_error',
          message,
          stack: stack || null,
          componentStack: componentStack || null,
          url: url || null,
          userAgent: userAgent || null,
          timestamp: timestamp || null,
        },
        'Client-side error reported'
      );

      return reply.status(204).send();
    }
  );
};
