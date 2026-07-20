const repo = require('./repository');

async function verifyCertificate(fastify) {
  fastify.get(
    '/verify/:id',
    {
      schema: {
        tags: ['Certificates'],
        description: 'Verify certificate authenticity (public)',
      },
    },
    async (req, reply) => {
      const cert = await repo.getCertificateById(req.params.id);
      if (!cert) {
        return reply.code(404).send({
          success: false,
          valid: false,
          error: 'Certificate not found',
        });
      }

      return {
        success: true,
        valid: true,
        data: {
          id: cert.id,
          recipient_name: cert.recipient_name,
          title: cert.title,
          issuer: cert.issuer,
          issue_date: cert.issue_date,
          certificate_type: cert.certificate_type,
          status: cert.status,
          template_name: cert.template_name,
        },
      };
    }
  );
}

module.exports = { verifyCertificate };
