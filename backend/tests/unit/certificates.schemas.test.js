const {
  certificateGenerateSchema,
} = require('../../src/modules/certificates/schemas');

describe('certificateGenerateSchema', () => {
  const baseData = {
    recipient_name: 'Test Recipient',
  };

  it('accepts a valid date range', () => {
    const result = certificateGenerateSchema.safeParse({
      ...baseData,
      issue_date: '2026-07-20',
      expiry_date: '2026-07-21',
    });

    expect(result.success).toBe(true);
  });

  it('accepts the same issue and expiry date', () => {
    const result = certificateGenerateSchema.safeParse({
      ...baseData,
      issue_date: '2026-07-20',
      expiry_date: '2026-07-20',
    });

    expect(result.success).toBe(true);
  });

  it('rejects an expiry date before the issue date', () => {
    const result = certificateGenerateSchema.safeParse({
      ...baseData,
      issue_date: '2026-07-20',
      expiry_date: '2026-07-09',
    });

    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['expiry_date'],
          message: 'Expiry date cannot be before the issue date',
        }),
      ])
    );
  });

  it('rejects malformed date strings', () => {
    const result = certificateGenerateSchema.safeParse({
      ...baseData,
      issue_date: '2026-02-30',
      expiry_date: '2026-03-01',
    });

    expect(result.success).toBe(false);
    expect(result.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ['issue_date'],
          message: 'Invalid calendar date',
        }),
      ])
    );
  });
});
