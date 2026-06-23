import { Card } from './ui';

export default function RatingSuggestionCard({ suggestion, loading }) {
  if (loading) {
    return (
      <Card className="p-4 mb-4">
        <p>Generating AI recommendation...</p>
      </Card>
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
