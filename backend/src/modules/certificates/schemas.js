const { z } = require('zod');

const templateCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  colorScheme: z.array(z.string()).optional().default([]),
  template_data: z
    .object({
      background: z.string().optional(),
      bg2: z.string().optional(),
      accent: z.string().optional(),
      text: z.string().optional(),
      titleFont: z.string().optional(),
      bodyFont: z.string().optional(),
      border: z.string().optional(),
      width: z.number().optional(),
      height: z.number().optional(),
    })
    .default({}),
  thumbnail_url: z.string().url().optional(),
  canva_design_id: z.string().optional(),
});

const templateUpdateSchema = templateCreateSchema.partial();

const certificateGenerateSchema = z.object({
  template_id: z.string().uuid().optional(),
  recipient_name: z.string().min(1).max(255),
  recipient_email: z.string().email().optional(),
  title: z.string().min(1).max(255).default('Certificate of Achievement'),
  body: z.string().optional(),
  issuer: z.string().max(255).optional(),
  issue_date: z.string().optional(),
  expiry_date: z.string().optional(),
  certificate_type: z
    .enum([
      'appreciation',
      'completion',
      'excellence',
      'participation',
      'achievement',
    ])
    .default('achievement'),
  metadata: z.record(z.any()).optional(),
});

const bulkGenerateSchema = z.object({
  template_id: z.string().uuid(),
  certificates: z
    .array(
      z.object({
        recipient_name: z.string().min(1).max(255),
        recipient_email: z.string().email().optional(),
        title: z.string().min(1).max(255).default('Certificate of Achievement'),
        body: z.string().optional(),
        issuer: z.string().max(255).optional(),
        certificate_type: z
          .enum([
            'appreciation',
            'completion',
            'excellence',
            'participation',
            'achievement',
          ])
          .default('achievement'),
        metadata: z.record(z.any()).optional(),
      })
    )
    .min(1)
    .max(500),
  send_email: z.boolean().default(false),
  email_subject: z.string().max(500).optional(),
  email_body: z.string().optional(),
});

const bulkEmailSchema = z.object({
  subject: z.string().min(1).max(500).default('Your Certificate'),
  body: z.string().min(1).default('Please find your certificate attached.'),
});

const aiGenerateContentSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  achievement: z.string().min(1),
  type: z.string().min(1),
  tone: z.string().default('formal'),
  language: z.string().default('English'),
});

const aiSuggestTemplateSchema = z.object({
  achievement: z.string().min(1),
  type: z.string().default('achievement'),
});

const aiAutoGenerateSchema = z.object({
  rawText: z.string().min(1),
  exportPdf: z.boolean().default(false),
});

module.exports = {
  templateCreateSchema,
  templateUpdateSchema,
  certificateGenerateSchema,
  bulkGenerateSchema,
  bulkEmailSchema,
  aiGenerateContentSchema,
  aiSuggestTemplateSchema,
  aiAutoGenerateSchema,
};
