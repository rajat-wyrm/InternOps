import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../components/RatingForm.jsx'),
  'utf8'
);

describe('RatingForm score selection', () => {
  it('starts without a preselected score', () => {
    expect(source).toContain('const [score, setScore] = useState(null);');
    expect(source).not.toContain('const [score, setScore] = useState(10);');
    expect(source).toContain("score == null ? 'Not selected' : `${score}/10`");
  });

  it('clears score when member or department changes and after submission', () => {
    expect(source.split('setScore(null);').length - 1).toBeGreaterThanOrEqual(
      3
    );
    expect(source).toContain('onChange={(nextUserId) => {');
  });

  it('requires both a member and score before submission', () => {
    expect(source).toContain('if (!userId || score == null) return;');
    expect(source).toContain(
      'disabled={rateMutation.isPending || !userId || score == null}'
    );
  });

  it('still applies a valid AI suggestion', () => {
    expect(source).toContain('Number.isFinite(suggestedScore)');
    expect(source).toContain(
      'setScore(Math.min(10, Math.max(1, Math.round(suggestedScore))))'
    );
  });
});
