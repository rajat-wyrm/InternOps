const { z } = require('zod');

const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
  .refine((value) => {
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Invalid calendar date');

function toUtcTimestamp(dateOnly) {
  return new Date(`${dateOnly}T00:00:00.000Z`).getTime();
}

const templateCreateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
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
  colorScheme: z.array(z.string()).optional(),
  thumbnail_url: z.string().url().optional(),
  canva_design_id: z.string().optional(),
});

const templateUpdateSchema = templateCreateSchema.partial();

const certificateGenerateSchema = z
  .object({
    template_id: z.string().uuid().optional(),
    recipient_name: z.string().min(1).max(255),
    recipient_email: z.string().email().optional(),
    title: z.string().min(1).max(255).default('Certificate of Achievement'),
    body: z.string().optional(),
    issuer: z.string().max(255).optional(),
    issue_date: dateOnlySchema.optional(),
    expiry_date: dateOnlySchema.optional(),
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
  .refine(
    (data) => {
      if (!data.issue_date || !data.expiry_date) {
        return true;
      }

      const issueDate = toUtcTimestamp(data.issue_date);
      const expiryDate = toUtcTimestamp(data.expiry_date);

      return expiryDate >= issueDate;
    },
    {
      message: 'Expiry date cannot be before the issue date',
      path: ['expiry_date'],
    }
  );

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
    .max(100),

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
  dateOnlySchema,
  templateCreateSchema,
  templateUpdateSchema,
  certificateGenerateSchema,
  bulkGenerateSchema,
  bulkEmailSchema,
  aiGenerateContentSchema,
  aiSuggestTemplateSchema,
  aiAutoGenerateSchema,
};
