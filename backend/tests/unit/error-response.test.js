const fs = require('node:fs');
const path = require('node:path');

describe('shared backend error response contract', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../../src/app.js'),
    'utf8'
  );

  test('validation responses include actionable and traceable fields', () => {
    expect(source).toContain("code: 'VALIDATION_ERROR'");
    expect(source).toContain('message: validationMessage');
    expect(source).toContain('requestId: request.id');
    expect(source).toContain('details: validationDetails');
  });

  test('unexpected errors remain private and traceable', () => {
    expect(source).toContain('const responseCode =');
    expect(source).toContain("'INTERNAL_ERROR'");
    expect(source).toContain('code: responseCode');
    expect(source).toContain("'Internal Server Error'");
    expect(source).toContain('requestId: request.id');
  });
});
