const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const service = require('./service');
const execution = require('./execution');

const XLSX_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
]);
const MAX_WORKBOOK_SIZE = 10 * 1024 * 1024;
function hasZipSignature(buffer) {
  return buffer?.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b;
}
async function routes(fastify) {
  fastify.post(
    '/preview',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL')],
      schema: {
        tags: ['Workbook Imports'],
        description:
          'Preview an anonymized XLSX workbook without writing to the database',
        querystring: {
          type: 'object',
          properties: {
            departmentId: { type: 'string', format: 'uuid' },
            managerId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const uploads = {};
      try {
        for await (const part of request.parts({
          limits: { fileSize: MAX_WORKBOOK_SIZE, files: 2 },
        })) {
          if (part.type !== 'file') continue;
          if (!['workbook', 'emailWorkbook'].includes(part.fieldname)) {
            part.file.resume();
            continue;
          }
          const filename = String(part.filename || '');
          if (
            !filename.toLowerCase().endsWith('.xlsx') ||
            !XLSX_MIMES.has(part.mimetype)
          ) {
            return reply
              .status(400)
              .send({ error: 'Only .xlsx workbooks are supported' });
          }
          const buffer = await part.toBuffer();
          if (part.file.truncated || buffer.length > MAX_WORKBOOK_SIZE) {
            return reply
              .status(413)
              .send({ error: 'Workbook exceeds the 10MB limit' });
          }
          if (!hasZipSignature(buffer)) {
            return reply
              .status(400)
              .send({ error: 'Workbook contents are not a valid XLSX file' });
          }
          uploads[part.fieldname] = buffer;
        }
        if (!uploads.workbook) {
          return reply
            .status(400)
            .send({ error: 'Attendance workbook is required' });
        }
        return await service.preview(
          uploads.workbook,
          {
            departmentId: request.query?.departmentId,
            managerId: request.query?.managerId,
            requesterId: request.user.id,
            requesterRole: request.user.role,
            requesterDepartmentId: request.user.departmentId,
            log: request.log,
          },
          uploads.emailWorkbook || null
        );
      } catch (error) {
        request.log.warn({ err: error }, 'Workbook preview parsing failed');
        return reply
          .status(400)
          .send({ error: `Could not parse workbook: ${error.message}` });
      }
    }
  );
  fastify.post(
    '/execute',
    {
      config: { rateLimit: { max: 2, timeWindow: '5 minutes' } },
      preHandler: [auth, rbac('ADMIN', 'SENIOR_TL', 'TL')],
      schema: {
        tags: ['Workbook Imports'],
        description:
          'Create current intern accounts and import current attendance',
        querystring: {
          type: 'object',
          additionalProperties: false,
          required: [
            'departmentId',
            'managerId',
            'previewFingerprint',
            'emailPreviewFingerprint',
          ],
          properties: {
            departmentId: { type: 'string', format: 'uuid' },
            managerId: { type: 'string', format: 'uuid' },
            previewFingerprint: {
              type: 'string',
              pattern: '^[a-f0-9]{64}$',
            },
            emailPreviewFingerprint: {
              type: 'string',
              pattern: '^[a-f0-9]{64}$',
            },
          },
        },
      },
    },
    async (request, reply) => {
      const uploads = {};
      let attendanceResolutions = {};
      for await (const part of request.parts({
        limits: { fileSize: MAX_WORKBOOK_SIZE, files: 2 },
      })) {
        if (part.type === 'field') {
          if (part.fieldname === 'attendanceResolutions') {
            try {
              attendanceResolutions = JSON.parse(String(part.value || '{}'));
            } catch {
              return reply
                .status(400)
                .send({ error: 'Attendance resolutions must be valid JSON' });
            }
          }
          continue;
        }
        if (part.type !== 'file') continue;
        if (!['workbook', 'emailWorkbook'].includes(part.fieldname)) {
          part.file.resume();
          continue;
        }
        const buffer = await part.toBuffer();
        if (part.file.truncated || !hasZipSignature(buffer))
          return reply.status(400).send({ error: 'Invalid XLSX upload' });
        uploads[part.fieldname] = buffer;
      }
      if (!uploads.workbook || !uploads.emailWorkbook)
        return reply.status(400).send({ error: 'Both workbooks are required' });
      try {
        return await execution.execute(
          uploads.workbook,
          uploads.emailWorkbook,
          {
            ...request.query,
            requesterId: request.user.id,
            requesterRole: request.user.role,
            requesterDepartmentId: request.user.departmentId,
            attendanceResolutions,
          }
        );
      } catch (error) {
        request.log.warn({ err: error }, 'Workbook import failed');
        return reply.status(error.statusCode || 409).send({
          error: error.message,
          code: error.code,
          duplicates: error.duplicates,
        });
      }
    }
  );
}
module.exports = routes;
module.exports.hasZipSignature = hasZipSignature;
