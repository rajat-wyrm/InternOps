const crypto = require('crypto');
const config = require('../config');

const failureState = new Map();
const responseCache = new Map();

const FAILURE_LIMIT = Number(process.env.AI_PROVIDER_FAILURE_LIMIT || 3);
const COOLDOWN_MS = Number(
  process.env.AI_PROVIDER_COOLDOWN_MS || 5 * 60 * 1000
);
const CACHE_TTL_MS = Number(process.env.AI_CACHE_TTL_MS || 5 * 60 * 1000);

function isPlaceholder(value) {
  return !value || value.startsWith('your-');
}

function getProviderOrder() {
  return (
    process.env.AI_PROVIDER_ORDER || 'groq,openai,gemini,deepseek,huggingface'
  )
    .split(',')
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

function getCacheKey(payload) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex');
}

function getCachedResponse(payload) {
  const key = getCacheKey(payload);
  const cached = responseCache.get(key);

  if (!cached) return null;

  if (Date.now() > cached.expiresAt) {
    responseCache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedResponse(payload, value) {
  const key = getCacheKey(payload);
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function isProviderOpen(name) {
  const state = failureState.get(name);
  if (!state) return true;

  if (state.disabledUntil && Date.now() < state.disabledUntil) {
    return false;
  }

  if (state.disabledUntil && Date.now() >= state.disabledUntil) {
    failureState.delete(name);
  }

  return true;
}

function recordSuccess(name) {
  failureState.delete(name);
}

function recordFailure(name, error) {
  const state = failureState.get(name) || {
    failures: 0,
    lastError: null,
    disabledUntil: null,
  };

  state.failures += 1;
  state.lastError = error.message;

  if (state.failures >= FAILURE_LIMIT) {
    state.disabledUntil = Date.now() + COOLDOWN_MS;
  }

  failureState.set(name, state);
}

async function fetchWithTimeout(url, options = {}) {
  const timeout = config.ai?.timeout || 25000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(messages = []) {
  return messages
    .map((m) => `${m.role || 'user'}: ${m.content || ''}`)
    .join('\n');
}

async function callOpenAICompatible({
  name,
  baseUrl,
  apiKey,
  model,
  messages,
}) {
  const response = await fetchWithTimeout(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`${name} failed with status ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error(`${name} returned empty response`);
  }

  return text;
}

async function callGroq(messages) {
  return callOpenAICompatible({
    name: 'groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: config.ai.groqKey,
    model: process.env.GROQ_MODEL || 'llama-3.1-8b-instant',
    messages,
  });
}

async function callOpenAI(messages) {
  return callOpenAICompatible({
    name: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: config.ai.openaiKey,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    messages,
  });
}

async function callDeepSeek(messages) {
  return callOpenAICompatible({
    name: 'deepseek',
    baseUrl: config.ai.deepseekBaseUrl || 'https://api.deepseek.com',
    apiKey: config.ai.deepseekKey,
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    messages,
  });
}

async function callGemini(messages) {
  const prompt = buildPrompt(messages);

  const response = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${
      process.env.GEMINI_MODEL || 'gemini-1.5-flash'
    }:generateContent?key=${config.ai.geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`gemini failed with status ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('gemini returned empty response');
  }

  return text;
}

async function callHuggingFace(messages) {
  const prompt = buildPrompt(messages);

  const response = await fetchWithTimeout(
    `https://api-inference.huggingface.co/models/${
      process.env.HUGGINGFACE_MODEL || 'mistralai/Mistral-7B-Instruct-v0.2'
    }`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.ai.huggingfaceToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: prompt }),
    }
  );

  if (!response.ok) {
    throw new Error(`huggingface failed with status ${response.status}`);
  }

  const data = await response.json();
  const text =
    data?.[0]?.generated_text ||
    data?.generated_text ||
    data?.[0]?.summary_text;

  if (!text) {
    throw new Error('huggingface returned empty response');
  }

  return text;
}

const providerRegistry = {
  groq: {
    key: () => config.ai.groqKey,
    call: callGroq,
  },
  openai: {
    key: () => config.ai.openaiKey,
    call: callOpenAI,
  },
  gemini: {
    key: () => config.ai.geminiKey,
    call: callGemini,
  },
  deepseek: {
    key: () => config.ai.deepseekKey,
    call: callDeepSeek,
  },
  huggingface: {
    key: () => config.ai.huggingfaceToken,
    call: callHuggingFace,
  },
};

async function generateAIResponse({ messages }) {
  const payload = { messages };
  const cached = getCachedResponse(payload);

  if (cached) {
    return {
      ...cached,
      cached: true,
    };
  }

  const errors = [];
  const order = getProviderOrder();

  for (const providerName of order) {
    const provider = providerRegistry[providerName];
    if (!provider) continue;

    const key = provider.key();

    if (isPlaceholder(key)) {
      errors.push({ provider: providerName, reason: 'missing_api_key' });
      continue;
    }

    if (!isProviderOpen(providerName)) {
      errors.push({ provider: providerName, reason: 'circuit_open' });
      continue;
    }

    try {
      const content = await provider.call(messages);
      recordSuccess(providerName);

      const result = {
        provider: providerName,
        content,
        cached: false,
      };

      setCachedResponse(payload, result);
      return result;
    } catch (error) {
      recordFailure(providerName, error);
      console.warn(`[AI] Provider failed: ${providerName}`, error.message);
      errors.push({ provider: providerName, reason: error.message });
    }
  }

  const err = new Error('All AI providers unavailable');
  err.details = errors;
  throw err;
}

function getProviderHealth() {
  return getProviderOrder().map((name) => {
    const provider = providerRegistry[name];
    const state = failureState.get(name);

    return {
      name,
      configured: !!provider && !isPlaceholder(provider.key()),
      available:
        !!provider && !isPlaceholder(provider.key()) && isProviderOpen(name),
      failures: state?.failures || 0,
      lastError: state?.lastError || null,
      disabledUntil: state?.disabledUntil || null,
    };
  });
}

module.exports = {
  generateAIResponse,
  getProviderHealth,
};
