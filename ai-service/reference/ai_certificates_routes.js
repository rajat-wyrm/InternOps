const auth = require('../../middleware/auth');
const rbac = require('../../middleware/rbac');
const featureFlagMiddleware = require('../../middleware/featureFlag');
const service = require('./service');

async function routes(fastify) {
  // All routes require authentication + admin role
  fastify.addHook('onRequest', auth);
  fastify.addHook('onRequest', rbac('ADMIN'));
  // Gate entire module behind AI_CERT_GENERATOR flag
  fastify.addHook('preHandler', featureFlagMiddleware('AI_CERT_GENERATOR'));

  // ============================================================
  // Validation (Group 3 functionality)
  // ============================================================

  fastify.post(
    '/validate',
    {
      schema: {
        tags: ['AI Certificates'],
        description:
          'Validate certificate fields and clean text with optional AI beautification',
      },
    },
    async (req) => {
      const { name, company, achievement, date, use_ai } = req.body;

      const result = await service.validateCertificate({
        name,
        company,
        achievement,
        date,
        use_ai: use_ai !== false, // Default to true
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'AI_CERTIFICATE_VALIDATE',
        resourceType: 'ai_certificate',
        details: { name, company, use_ai },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return { success: true, data: result };
    }
  );

  // ============================================================
  // Text Generation (Group 1 functionality)
  // ============================================================

  fastify.post(
    '/generate-achievement',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'Generate achievement statement using Gemini AI',
      },
    },
    async (req) => {
      const {
        recipient_name,
        recognition_type,
        core_achievement,
        desired_tone,
      } = req.body;

      const result = await service.generateAchievementStatement({
        recipient_name,
        recognition_type,
        core_achievement,
        desired_tone: desired_tone || 'Professional',
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'AI_CERTIFICATE_GENERATE_ACHIEVEMENT',
        resourceType: 'ai_certificate',
        details: { recipient_name, recognition_type },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return { success: true, data: result };
    }
  );

  fastify.post(
    '/generate-content',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'Generate general content using GPT-2',
      },
    },
    async (req) => {
      const { prompt, tone, content_type } = req.body;

      const result = await service.generateContent({
        prompt,
        tone: tone || 'formal',
        content_type: content_type || 'blog post',
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'AI_CERTIFICATE_GENERATE_CONTENT',
        resourceType: 'ai_certificate',
        details: { content_type },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return { success: true, data: result };
    }
  );

  // ============================================================
  // Template Matching (Group 2 functionality)
  // ============================================================

  fastify.post(
    '/match-template',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'AI template matcher with semantic ranking',
      },
    },
    async (req) => {
      const {
        certificate_type,
        tone,
        industry,
        style,
        audience,
        language,
        user_text,
      } = req.body;

      const result = await service.matchTemplate({
        certificate_type,
        tone,
        industry,
        style,
        audience,
        language,
        user_text,
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'AI_CERTIFICATE_MATCH_TEMPLATE',
        resourceType: 'ai_certificate',
        details: { certificate_type, style },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return { success: true, data: result };
    }
  );

  // ============================================================
  // Certificate Rendering (Group 2 functionality)
  // ============================================================

  fastify.get(
    '/certificate-png',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'Render PNG certificate using layout engine',
      },
    },
    async (req) => {
      const { name, task } = req.query;

      if (!name || !name.trim()) {
        return { success: false, error: 'Name parameter is required' };
      }

      const result = await service.renderCertificatePNG({
        name: name.trim(),
        task: (task || 'Internship').trim(),
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'AI_CERTIFICATE_RENDER_PNG',
        resourceType: 'ai_certificate',
        details: { name, task },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return { success: true, data: result };
    }
  );

  // ============================================================
  // Full Pipeline (All Groups combined)
  // ============================================================

  fastify.post(
    '/pipeline',
    {
      schema: {
        tags: ['AI Certificates'],
        description:
          'Run complete certificate pipeline: validate → generate text → match template',
      },
    },
    async (req) => {
      const {
        name,
        company,
        achievement,
        date,
        tone,
        certificate_type,
        industry,
        style,
        audience,
        language,
        use_ai_beautify,
      } = req.body;

      const result = await service.runFullPipeline({
        name,
        company,
        achievement,
        date,
        tone: tone || 'Professional',
        certificate_type: certificate_type || 'Internship',
        industry: industry || 'Technology',
        style: style || 'Modern',
        audience: audience || 'Professional',
        language: language || 'English',
        use_ai_beautify: use_ai_beautify !== false,
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'AI_CERTIFICATE_FULL_PIPELINE',
        resourceType: 'ai_certificate',
        details: { name, company, certificate_type },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return { success: true, data: result };
    }
  );

  // ============================================================
  // Bulk AI Generation (Admin only)
  // ============================================================

  fastify.post(
    '/bulk-generate',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'Bulk generate certificates with AI content generation',
      },
    },
    async (req, reply) => {
      const {
        template_id,
        certificates,
        send_email,
        email_subject,
        email_body,
      } = req.body;

      const result = await service.startBulkAIGeneration(
        {
          template_id,
          certificates,
          send_email,
          email_subject,
          email_body,
        },
        req.user.id
      );

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'AI_CERTIFICATE_BULK_GENERATE',
        resourceType: 'bulk_ai_job',
        resourceId: result.job_id,
        details: { total: certificates.length },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return reply.code(201).send({ success: true, data: result });
    }
  );

  fastify.get(
    '/bulk-generate/:jobId',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'Get bulk AI generation job status',
      },
    },
    async (req) => {
      const job = await service.getBulkAIJobStatus(req.params.jobId);
      if (!job) {
        return { success: false, error: 'Job not found' };
      }
      return { success: true, data: job };
    }
  );

  // ============================================================
  // Tone Customizer (from toneCustomizer.js)
  // ============================================================

  const AVAILABLE_TONES = [
    'Professional',
    'Formal',
    'Friendly',
    'Motivational',
    'Casual',
  ];

  fastify.post(
    '/tone-customize',
    {
      schema: {
        tags: ['AI Certificates'],
        description:
          'Generate certificate content with specific tone (title, body, closing)',
      },
    },
    async (req) => {
      const {
        recipient_name,
        company_name,
        certificate_type,
        achievement,
        tone,
      } = req.body;

      if (!AVAILABLE_TONES.includes(tone)) {
        return {
          success: false,
          error: `Invalid tone. Choose from: ${AVAILABLE_TONES.join(', ')}`,
        };
      }

      const result = await service.generateWithTone({
        recipient_name,
        company_name,
        certificate_type,
        achievement,
        tone,
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'AI_CERTIFICATE_TONE_CUSTOMIZE',
        resourceType: 'ai_certificate',
        details: { recipient_name, tone, certificate_type },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return { success: true, data: result };
    }
  );

  fastify.get(
    '/tones',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'List available tones for certificate generation',
      },
    },
    async () => {
      return { success: true, data: AVAILABLE_TONES };
    }
  );

  // ============================================================
  // Multi-Language Support (from multiLanguageSupport.js)
  // ============================================================

  const SUPPORTED_LANGUAGES = [
    'English',
    'Hindi',
    'Tamil',
    'Telugu',
    'Malayalam',
    'Kannada',
    'Bengali',
    'Marathi',
    'Gujarati',
    'French',
    'Spanish',
    'Arabic',
    'German',
    'Japanese',
    'Chinese (Simplified)',
  ];

  fastify.post(
    '/generate-multilanguage',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'Generate certificate content in specified language',
      },
    },
    async (req) => {
      const {
        recipient_name,
        company_name,
        certificate_type,
        achievement,
        language,
      } = req.body;

      if (!SUPPORTED_LANGUAGES.includes(language)) {
        return {
          success: false,
          error: `Unsupported language. Choose from: ${SUPPORTED_LANGUAGES.join(', ')}`,
        };
      }

      const result = await service.generateInLanguage({
        recipient_name,
        company_name,
        certificate_type,
        achievement,
        language,
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'AI_CERTIFICATE_MULTILANGUAGE',
        resourceType: 'ai_certificate',
        details: { recipient_name, language, certificate_type },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return { success: true, data: result };
    }
  );

  fastify.get(
    '/languages',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'List supported languages for certificate generation',
      },
    },
    async () => {
      return { success: true, data: SUPPORTED_LANGUAGES };
    }
  );

  // ============================================================
  // Design Suggestions (from design_suggestion/app.py)
  // ============================================================

  fastify.post(
    '/design-suggest',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'AI-powered design suggestions for certificate styling',
      },
    },
    async (req) => {
      const { certificate_type, industry, style, tone, audience } = req.body;

      const result = await service.suggestDesign({
        certificate_type,
        industry,
        style,
        tone,
        audience,
      });

      req.auditOnResponse = {
        userId: req.user.id,
        action: 'AI_CERTIFICATE_DESIGN_SUGGEST',
        resourceType: 'ai_certificate',
        details: { certificate_type, industry, style },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      };

      return { success: true, data: result };
    }
  );

  fastify.get(
    '/design-templates',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'List available design templates with styling info',
      },
    },
    async () => {
      const templates = service.getDesignTemplates();
      return { success: true, data: templates };
    }
  );

  // ============================================================
  // Certificate Preview (HTML rendering with templates)
  // ============================================================

  fastify.post(
    '/preview',
    {
      schema: {
        tags: ['AI Certificates'],
        description: 'Generate HTML certificate preview using design templates',
      },
    },
    async (req) => {
      const { recipient_name, title, body, closing, template_name, logo_url } =
        req.body;

      const result = await service.renderCertificatePreview({
        recipient_name,
        title,
        body,
        closing,
        template_name,
        logo_url,
      });

      return { success: true, data: result };
    }
  );
}

module.exports = routes;
