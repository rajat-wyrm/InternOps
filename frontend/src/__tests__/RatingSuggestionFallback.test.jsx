import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = (file) =>
  fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');

describe('optional rating suggestion fallback', () => {
  it('supports Senior TL suggestion data', () => {
    const service = read(
      '../../backend/src/modules/ratings/suggestion.service.js'
    );
    expect(service).toContain("['SENIOR_TL', 'TL', 'CAPTAIN', 'INTERN']");
    expect(service).toContain('fallback.calculateFallbackRating(metrics)');
  });

  it('suppresses the global toast and exposes a local error state', () => {
    const form = read('components/RatingForm.jsx');
    expect(form).toContain('_suppressGlobalError: true');
    expect(form).toContain('isError: suggestionIsError');
    expect(form).toContain('error={suggestionIsError}');
    expect(form).toContain('retry: false');
  });

  it('keeps manual rating available when AI suggestions fail', () => {
    const card = read('components/RatingSuggestionCard.jsx');
    expect(card).toContain(
      'AI suggestion unavailable. You can still rate manually.'
    );
    expect(card).toContain('if (error)');
    expect(card).not.toContain('throw error');
  });
});
