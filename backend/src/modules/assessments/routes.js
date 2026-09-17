const auth = require('../../middleware/auth');
const service = require('./service');
const { z } = require('zod');
const { toSchema } = require('../../utils/schemaHelper');

async function routes(fastify) {
  fastify.get(
    '/my-assessment',
    {
      schema: {
        tags: ['Assessments'],
        description: "Get the authenticated user's latest assessment",
      },
      preHandler: [auth],
    },
    async (req, reply) => {
      try {
        const assessment = await service.getLatestAssessment(req.user.id);
        if (!assessment) {
          return reply.status(404).send({ error: 'No assessment found' });
        }
        return reply.send(assessment);
      } catch (err) {
        req.log.error({ err }, 'Error fetching own assessment');
        return reply.status(500).send({ error: 'Failed to fetch assessment' });
      }
    }
  );

  fastify.get(
    '/user/:userId',
    {
      schema: {
        tags: ['Assessments'],
        description: "Get a user's latest assessment",
        params: toSchema(z.object({ userId: z.string().uuid() })),
      },
      preHandler: [auth],
    },
    async (req, reply) => {
      const { userId } = req.params;
      const isSelf = req.user.id === userId;
      const isManager = ['ADMIN', 'SENIOR_TL', 'TL', 'CAPTAIN'].includes(
        req.user.role
      );

      if (!isSelf && !isManager) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      try {
        const assessment = await service.getLatestAssessment(userId);
        if (!assessment) {
          return reply.status(404).send({ error: 'No assessment found' });
        }
        return reply.send(assessment);
      } catch (err) {
        req.log.error({ err }, 'Error fetching user assessment');
        return reply.status(500).send({ error: 'Failed to fetch assessment' });
      }
    }
  );
}

module.exports = routes;
