const service = require('./service');

async function verifyCertificate(fastify) {
  fastify.get(
    '/verify/certificate/:token',
    {
      schema: {
        tags: ['Certificates'],
        description: 'Verify certificate authenticity using verification token',
        params: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              format: 'uuid',
            },
          },
          required: ['token'],
        },
      },
    },
    async (req, reply) => {
      const result = await service.verifyCertificate(req.params.token);

      if (!result) {
        return reply.code(404).send({
          success: false,
          valid: false,
          error: 'Certificate not found',
        });
      }

      return {
        success: true,
        ...result,
      };
    }
  );
}

module.exports = { verifyCertificate };
