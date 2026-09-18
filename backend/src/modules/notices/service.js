const aiProvider = require('../../services/aiProviderService');
const { safeParseJSON } = require('../../utils/promptCleaner');

function safeSandbox(value, maxLen = 4000) {
  if (!value || typeof value !== 'string') return '';
  return value.slice(0, maxLen);
}

async function analyzeNoticeContent(content, userId) {
  const sanitizedContent = safeSandbox(content);

  const prompt = `You are an expert AI Notice Assistant.
Your task is to analyze the following notice content and extract structured information.

Notice Content:
"""
${sanitizedContent}
"""

Output ONLY a valid JSON object matching the exact schema below. Do not include markdown fences (\`\`\`json) or any conversational text.

{
  "category": "String. Must be exactly one of: GENERAL, REMINDER, ALERT, NEWS, INTERNSHIP, ANNOUNCEMENT, EVENT, IMPORTANT, DEADLINE",
  "title": "String. A short, professional title suitable for the notice.",
  "summary": "String. A concise 1-2 sentence summary of the entire notice.",
  "deadline": "String or null. Extracted deadline date/time if present, otherwise null.",
  "eligibility": "String or null. Extracted eligibility criteria if present, otherwise null.",
  "date_time": "String or null. Extracted event or relevant date/time if present, otherwise null.",
  "action_button_text": "String or null. A short suggested call-to-action (e.g. 'Apply Now', 'Register Here', 'View Details'), or null if not applicable.",
  "improved_content": "String. A professionally rewritten and clearly formatted version of the original content."
}`;

  const response = await aiProvider.generateAIResponse({
    userId,
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.fallback || response.error) {
    throw new Error(response.content || 'AI service unavailable');
  }

  const parsed = safeParseJSON(response.content);
  if (!parsed) {
    throw new Error('AI returned invalid JSON');
  }

  // Ensure category is mapped correctly to enum if it hallucinates
  const validCategories = [
    'GENERAL',
    'REMINDER',
    'ALERT',
    'NEWS',
    'INTERNSHIP',
    'ANNOUNCEMENT',
    'EVENT',
    'IMPORTANT',
    'DEADLINE',
  ];

  if (parsed.category) {
    const uppercaseCat = parsed.category.toUpperCase();
    parsed.category = validCategories.includes(uppercaseCat)
      ? uppercaseCat
      : 'GENERAL';
  } else {
    parsed.category = 'GENERAL';
  }

  return { success: true, data: parsed };
}

module.exports = {
  analyzeNoticeContent,
};
