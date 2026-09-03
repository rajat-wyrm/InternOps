import { Card } from './ui';

export default function RatingSuggestionCard({ suggestion, loading, error }) {
  if (loading) {
    return (
      <Card className="p-4 mb-4">
        <p>Generating AI recommendation...</p>
      </Card>
    );
  }

  if (error) {
    return (
      <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        AI suggestion unavailable. You can still rate manually.
      </div>
    );
  }
  if (!suggestion) {
    return null;
  }

  return (
    <Card className="p-4 mb-4">
      <h3 className="font-semibold mb-2">AI Suggested Rating</h3>

      <div className="flex items-center gap-2">
        <span className="text-2xl font-bold text-indigo-600">
          {suggestion.recommendation?.suggestedScore ?? '-'}
        </span>

        <span className="text-gray-500">/ 10</span>
      </div>

      <p className="text-sm text-gray-600 mt-2">
        {suggestion.recommendation?.reasoning}
      </p>
    </Card>
  );
}
