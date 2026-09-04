import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../components/RatingForm.jsx'),
  'utf8'
);

describe('RatingForm responsive layout', () => {
  it('places Department and Team Member in one row on desktop', () => {
    expect(source).toContain("roster ? '' : 'md:grid-cols-2'");
    expect(source.match(/className="min-w-0"/g)).toHaveLength(2);
  });

  it('keeps a single-column mobile layout', () => {
    expect(source).toContain('grid grid-cols-1 gap-4');
  });

  it('uses a clear responsive submit action', () => {
    expect(source).toContain("'Submit Rating'");
    expect(source).toContain('sm:w-auto');
    expect(source).toContain('disabled:opacity-50');
  });
});
