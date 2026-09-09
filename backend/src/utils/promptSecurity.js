const ZERO_WIDTH_CHARS = /[\u200B-\u200D\u2060\uFEFF]/g;

// These signals are intentionally combined instead of blocking topic words
// such as "system prompt" on their own.
const INJECTION_PATTERNS = [
  /\b(?:ignore|disregard|forget|override|bypass)\b[\s\p{P}\p{S}]{0,40}\b(?:all\s+)?(?:the\s+)?(?:previous|prior|above|earlier|system)\s+(?:instructions?|rules?|prompt)\b/iu,
  /\b(?:ignore|disregard|forget)\b[\s\p{P}\p{S}]{0,30}\b(?:everything|all)\b[\s\p{P}\p{S}]{0,30}\b(?:above|before|earlier)\b/iu,
  /\b(?:reveal|show|print|repeat|provide|output| disclose)\b[\s\p{P}\p{S}]{0,40}\b(?:the\s+)?(?:system|hidden|secret)\s+(?:prompt|instructions?|message)\b/iu,
  /\b(?:you(?:'|’)re|you\s+are|act\s+as|pretend\s+to\s+be|assume\s+the\s+role\s+of)\b[\s\p{P}\p{S}]{0,50}\b(?:now|an?\s+unrestricted|without\s+restrictions?|a\s+different)\b/iu,
  /(?:<\|\s*(?:im_start|im_end|system|assistant|user)\s*\|>|\[\s*(?:INST|SYS)\s*\])/iu,
  /\b(?:jailbreak|developer\s+mode|dan\s+mode|do\s+anything\s+now)\b/iu,
];

function normalizePrompt(prompt) {
  return String(prompt || '')
    .normalize('NFKC')
    .replace(ZERO_WIDTH_CHARS, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPromptInjection(prompt) {
  const normalized = normalizePrompt(prompt);
  return INJECTION_PATTERNS.some((pattern) => pattern.test(normalized));
}

function sanitizePrompt(prompt, { maxLength = 4000 } = {}) {
  const normalized = normalizePrompt(prompt);

  if (!normalized) {
    throw new Error('Prompt cannot be empty');
  }

  if (normalized.length > maxLength) {
    throw new Error('Prompt exceeds maximum length');
  }

  if (isPromptInjection(normalized)) {
    throw new Error('Potential prompt injection detected');
  }

  return normalized;
}

module.exports = {
  INJECTION_PATTERNS,
  normalizePrompt,
  isPromptInjection,
  sanitizePrompt,
};
