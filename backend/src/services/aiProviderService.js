const crypto = require('crypto');
const config = require('../config');
const { getRedisClient } = require('../config/redis');

class BoundedCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
    this.cache = new Map();
  }

  get(key) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Refresh position to implement LRU (delete and re-insert)
    this.cache.delete(key);
    this.cache.set(key, cached);

    return cached.value;
  }

  set(key, value, ttlMs) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }
}

const failureState = new Map();
const responseCache = new BoundedCache(1000);

const FAILURE_LIMIT = Number(process.env.AI_PROVIDER_FAILURE_LIMIT || 3);
const COOLDOWN_MS = Number(
  process.env.AI_PROVIDER_COOLDOWN_MS || 5 * 60 * 1000
);
const CACHE_TTL_MS = Number(process.env.AI_CACHE_TTL_MS || 5 * 60 * 1000);

const MAX_AI_RESPONSE_BYTES = Number(
  process.env.AI_MAX_RESPONSE_BYTES || 5 * 1024 * 1024
);

class ResponseSizeLimitError extends Error {
  constructor(message = 'AI provider response exceeded size cap') {
    super(message);
    this.name = 'ResponseSizeLimitError';
    this.statusCode = 413;
  }
}

function isPlaceholder(value) {
  return !value || String(value).startsWith('your-');
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
  const cacheInput = {
    userId: payload.userId,
    messages: payload.messages,
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(cacheInput))
    .digest('hex');
}

async function getCachedResponse(payload) {
  const key = getCacheKey(payload);

  try {
    const redis = await getRedisClient();
    if (redis) {
      const cached = await redis.get(`ai:cache:${key}`);
      if (cached) {
        return JSON.parse(cached);
      }
      return null;
    }
  } catch (error) {
    console.warn('[AI Cache] Redis read error:', error.message);
  }

  return responseCache.get(key);
}

async function setCachedResponse(payload, value) {
  const key = getCacheKey(payload);

  try {
    const redis = await getRedisClient();
    if (redis) {
      await redis.set(`ai:cache:${key}`, JSON.stringify(value), {
        PX: CACHE_TTL_MS,
      });
      return;
    }
  } catch (error) {
    console.warn('[AI Cache] Redis write error:', error.message);
  }

  responseCache.set(key, value, CACHE_TTL_MS);
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

async function readResponseTextWithLimit(response) {
  const contentLength = response.headers.get('content-length');

  if (contentLength) {
    const parsedLength = Number(contentLength);

    if (Number.isFinite(parsedLength) && parsedLength > MAX_AI_RESPONSE_BYTES) {
      throw new ResponseSizeLimitError(
        `AI provider response Content-Length exceeds ${MAX_AI_RESPONSE_BYTES} bytes`
      );
    }
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    throw new Error('Streaming response body is not supported');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      received += value.byteLength;

      if (received > MAX_AI_RESPONSE_BYTES) {
        await reader.cancel();

        throw new ResponseSizeLimitError(
          `AI provider response exceeded ${MAX_AI_RESPONSE_BYTES} bytes`
        );
      }

      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks).toString('utf8');
}

async function parseJsonResponseWithLimit(response, providerName) {
  const text = await readResponseTextWithLimit(response);

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${providerName} returned invalid JSON`);
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

  const data = await parseJsonResponseWithLimit(response, name);
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
      headers: {
        'Content-Type': 'application/json',
      },
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

  const data = await parseJsonResponseWithLimit(response, 'gemini');
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
      body: JSON.stringify({
        inputs: prompt,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`huggingface failed with status ${response.status}`);
  }

  const data = await parseJsonResponseWithLimit(response, 'huggingface');

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

async function generateAIResponse({ userId, messages }) {
  const payload = { userId, messages };
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
      errors.push({
        provider: providerName,
        reason: 'missing_api_key',
      });
      continue;
    }

    if (!isProviderOpen(providerName)) {
      errors.push({
        provider: providerName,
        reason: 'circuit_open',
      });
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

      await setCachedResponse(payload, result);
      return result;
    } catch (error) {
      if (error instanceof ResponseSizeLimitError || error.statusCode === 413) {
        throw error;
      }

      recordFailure(providerName, error);

      console.warn(`[AI] Provider failed: ${providerName}`, error.message);

      errors.push({
        provider: providerName,
        reason: error.message,
      });
    }
  }

  const err = new Error('All AI providers unavailable');
  err.details = errors;
  throw err;
}

function getProviderHealth() {
  const order = getProviderOrder();

  return order.map((name) => {
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
  ResponseSizeLimitError,
};
