const mockGetRedisClient = jest.fn();
const mockConfig = {
  ai: {
    groqKey: 'groq-key',
    openaiKey: 'openai-key',
    geminiKey: 'gemini-key',
    deepseekKey: 'deepseek-key',
    huggingfaceToken: 'huggingface-token',
    timeout: 1000,
  },
};

class MockLRUCache {
  constructor(options = {}) {
    this.options = options;
    this.store = new Map();
  }

  get(key) {
    return this.store.get(key) || undefined;
  }

  set(key, value) {
    this.store.set(key, value);
    return this;
  }

  delete(key) {
    this.store.delete(key);
  }

  clear() {
    this.store.clear();
  }
}

jest.mock('lru-cache', () => ({
  LRUCache: jest
    .fn()
    .mockImplementation((options) => new MockLRUCache(options)),
}));

jest.mock('../../src/config', () => mockConfig);

jest.mock('../../src/config/redis', () => ({
  getRedisClient: mockGetRedisClient,
}));

const mockFetch = jest.fn();
jest.spyOn(global, 'fetch').mockImplementation(mockFetch);

describe('AI Provider Service', () => {
  let aiService;

  const createJsonResponse = (body, ok = true, status = 200) => ({
    ok,
    status,
    headers: { get: jest.fn().mockReturnValue(null) },
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
    json: jest.fn().mockResolvedValue(body),
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    process.env.AI_PROVIDER_ORDER = 'groq,openai';
    process.env.AI_PROVIDER_FAILURE_LIMIT = '3';
    process.env.AI_PROVIDER_COOLDOWN_MS = '1000';
    process.env.AI_CACHE_TTL_MS = '60000';
    process.env.AI_CACHE_MAX_ENTRIES = '50';
    process.env.AI_MAX_RESPONSE_BYTES = '1048576';

    mockConfig.ai.groqKey = 'groq-key';
    mockConfig.ai.openaiKey = 'openai-key';
    mockConfig.ai.geminiKey = 'gemini-key';
    mockConfig.ai.deepseekKey = 'deepseek-key';
    mockConfig.ai.huggingfaceToken = 'huggingface-token';
    mockConfig.ai.timeout = 1000;

    mockGetRedisClient.mockReset();
    mockFetch.mockReset();
    jest.spyOn(global, 'fetch').mockImplementation(mockFetch);

    aiService = require('../../src/services/aiProviderService');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.AI_PROVIDER_ORDER;
    delete process.env.AI_PROVIDER_FAILURE_LIMIT;
    delete process.env.AI_PROVIDER_COOLDOWN_MS;
    delete process.env.AI_CACHE_TTL_MS;
    delete process.env.AI_CACHE_MAX_ENTRIES;
    delete process.env.AI_MAX_RESPONSE_BYTES;
    delete process.env.AI_USER_CACHE_MAX;
  });

  it('should return a successful AI response from the primary provider', async () => {
    const redis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
    };
    mockGetRedisClient.mockResolvedValue(redis);
    mockFetch.mockResolvedValueOnce(
      createJsonResponse({
        choices: [{ message: { content: 'Primary response' } }],
      })
    );

    const result = await aiService.generateAIResponse({
      userId: 'user-1',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(result).toEqual({
      provider: 'groq',
      content: 'Primary response',
      cached: false,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.groq.com/openai/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer groq-key',
          'Content-Type': 'application/json',
        }),
      })
    );
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('ai:cache:user-1:'),
      expect.any(String),
      { PX: 60000 }
    );
  });

  it('should use the Redis cache on a repeated request and avoid a second provider call', async () => {
    const redis = {
      get: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(
          JSON.stringify({
            provider: 'groq',
            content: 'Cached answer',
            cached: false,
          })
        ),
      set: jest.fn().mockResolvedValue('OK'),
    };
    mockGetRedisClient.mockResolvedValue(redis);
    mockFetch.mockResolvedValueOnce(
      createJsonResponse({
        choices: [{ message: { content: 'Fresh answer' } }],
      })
    );

    const first = await aiService.generateAIResponse({
      userId: 'user-1',
      messages: [{ role: 'user', content: 'Hello' }],
    });
    const second = await aiService.generateAIResponse({
      userId: 'user-1',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(first).toEqual({
      provider: 'groq',
      content: 'Fresh answer',
      cached: false,
    });
    expect(second).toEqual({
      provider: 'groq',
      content: 'Cached answer',
      cached: true,
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(redis.get).toHaveBeenCalledTimes(2);
  });

  it('should fail over to the backup provider when the primary provider fails', async () => {
    mockGetRedisClient.mockResolvedValue(null);
    mockFetch
      .mockRejectedValueOnce(new Error('groq down'))
      .mockResolvedValueOnce(
        createJsonResponse({
          choices: [{ message: { content: 'Backup answer' } }],
        })
      );

    const result = await aiService.generateAIResponse({
      userId: 'user-2',
      messages: [{ role: 'user', content: 'Fallback please' }],
    });

    expect(result).toEqual({
      provider: 'openai',
      content: 'Backup answer',
      cached: false,
    });
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[1][0]).toBe(
      'https://api.openai.com/v1/chat/completions'
    );
  });

  it('should open the circuit breaker after repeated provider failures', async () => {
    jest.resetModules();
    process.env.AI_PROVIDER_ORDER = 'groq';
    process.env.AI_PROVIDER_FAILURE_LIMIT = '3';
    mockGetRedisClient.mockResolvedValue(null);
    mockFetch.mockRejectedValue(new Error('groq down'));

    aiService = require('../../src/services/aiProviderService');

    for (let i = 0; i < 4; i++) {
      const res = await aiService.generateAIResponse({
        userId: 'user-3',
        messages: [{ role: 'user', content: 'Will fail' }],
      });
      expect(res).toMatchObject({
        cached: false,
        content: expect.stringContaining('temporarily unavailable'),
        error: {
          code: 'AI_SERVICE_UNAVAILABLE',
          message: expect.any(String),
          providers: expect.any(Array),
        },
      });
    }

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should reject invalid input that exceeds the prompt size limit', async () => {
    jest.resetModules();
    process.env.AI_PROVIDER_ORDER = 'gemini';
    mockConfig.ai.geminiKey = '';
    mockGetRedisClient.mockResolvedValue(null);
    aiService = require('../../src/services/aiProviderService');

    const hugeMessage = { role: 'user', content: 'x'.repeat(40000) };

    const res = await aiService.generateAIResponse({
      userId: 'user-4',
      messages: [hugeMessage],
    });
    expect(res.error?.code).toBeDefined();
  });

  it('should recover and close the circuit breaker after the cooldown period (half-open)', async () => {
    jest.useFakeTimers();
    try {
      jest.resetModules();
      process.env.AI_PROVIDER_ORDER = 'groq';
      process.env.AI_PROVIDER_FAILURE_LIMIT = '2';
      process.env.AI_PROVIDER_COOLDOWN_MS = '5000';

      mockGetRedisClient.mockResolvedValue(null);
      mockFetch.mockRejectedValue(new Error('groq down'));

      aiService = require('../../src/services/aiProviderService');

      let res = await aiService.generateAIResponse({
        userId: 'u1',
        messages: [],
      });
      expect(res.error).toBeDefined();
      res = await aiService.generateAIResponse({ userId: 'u1', messages: [] });
      expect(res.error).toBeDefined();

      mockFetch.mockClear();

      res = await aiService.generateAIResponse({ userId: 'u1', messages: [] });
      expect(res.error).toBeDefined();
      expect(mockFetch).not.toHaveBeenCalled();

      jest.advanceTimersByTime(5001);

      mockFetch.mockResolvedValueOnce(
        createJsonResponse({
          choices: [{ message: { content: 'Recovered!' } }],
        })
      );

      const result = await aiService.generateAIResponse({
        userId: 'u1',
        messages: [{ role: 'user', content: 'hello' }],
      });

      expect(result.content).toBe('Recovered!');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should skip a provider entirely if its circuit breaker is open and use the fallback', async () => {
    jest.resetModules();
    process.env.AI_PROVIDER_ORDER = 'groq,openai';
    process.env.AI_PROVIDER_FAILURE_LIMIT = '1';

    mockGetRedisClient.mockResolvedValue(null);

    mockFetch
      .mockRejectedValueOnce(new Error('groq down'))
      .mockResolvedValueOnce(
        createJsonResponse({
          choices: [{ message: { content: 'OpenAI Fallback' } }],
        })
      );

    aiService = require('../../src/services/aiProviderService');

    const firstRes = await aiService.generateAIResponse({
      userId: 'u2',
      messages: [],
    });
    expect(firstRes.provider).toBe('openai');

    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce(
      createJsonResponse({
        choices: [{ message: { content: 'OpenAI Second Try' } }],
      })
    );

    const secondRes = await aiService.generateAIResponse({
      userId: 'u2',
      messages: [{ role: 'user', content: 'Different message' }],
    });

    expect(secondRes.provider).toBe('openai');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain('api.openai.com');
  });

  it('should attach per-provider failure reasons to the thrown error for diagnostics (#1795)', async () => {
    jest.resetModules();
    process.env.AI_PROVIDER_ORDER = 'gemini,groq';
    mockConfig.ai.geminiKey = 'your-placeholder-key'; // treated as unconfigured
    mockConfig.ai.groqKey = 'groq-key';
    mockGetRedisClient.mockResolvedValue(null);
    mockFetch.mockRejectedValue(new Error('groq unreachable'));

    aiService = require('../../src/services/aiProviderService');

    const res = await aiService.generateAIResponse({
      userId: 'user-diag',
      messages: [{ role: 'user', content: 'hello' }],
    });

    expect(res.error).toBeDefined();
    expect(res.error.message).toBe(
      'All configured AI providers are unavailable.'
    );
    expect(Array.isArray(res.error.providers)).toBe(true);
    expect(res.error.providers).toEqual([
      { provider: 'gemini', reason: 'missing_api_key' },
      {
        provider: 'groq',
        reason: 'groq unreachable',
        code: 'AI_PROVIDER_NETWORK_ERROR',
        statusCode: null,
      },
    ]);

    mockConfig.ai.geminiKey = 'gemini-key';
  });

  it('should enforce LRU cache eviction limits and TTL configurations', async () => {
    jest.clearAllMocks();
    jest.resetModules();

    process.env.AI_USER_CACHE_MAX = '100';
    process.env.AI_CACHE_MAX_ENTRIES = '50';
    process.env.AI_CACHE_TTL_MS = '300000';

    const { LRUCache } = require('lru-cache');
    aiService = require('../../src/services/aiProviderService');

    expect(LRUCache).toHaveBeenCalledWith(
      expect.objectContaining({ max: 100 })
    );

    aiService._caches.get = jest.fn().mockReturnValue(undefined);

    const res = await aiService.generateAIResponse({
      userId: 'cache-test-user',
      messages: [],
    });
    expect(res.error).toBeDefined();

    expect(LRUCache).toHaveBeenCalledWith(
      expect.objectContaining({
        max: 50,
        ttl: 300000,
        ttlAutopurge: true,
      })
    );
  });

  it('should handle concurrent requests safely without state corruption', async () => {
    jest.resetModules();
    process.env.AI_PROVIDER_ORDER = 'groq';
    mockGetRedisClient.mockResolvedValue(null);

    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => {
            resolve(
              createJsonResponse({
                choices: [{ message: { content: 'Concurrent Success' } }],
              })
            );
          }, 10)
        )
    );

    aiService = require('../../src/services/aiProviderService');

    const promises = Array.from({ length: 10 }).map((_, i) =>
      aiService.generateAIResponse({
        userId: 'concurrent-user',
        messages: [{ role: 'user', content: `Message ${i}` }],
      })
    );

    const results = await Promise.all(promises);

    expect(results).toHaveLength(10);
    results.forEach((res) => {
      expect(res.content).toBe('Concurrent Success');
    });

    expect(mockFetch).toHaveBeenCalledTimes(10);
  });
  it('should enforce the default 5MB response size limit when AI_MAX_RESPONSE_BYTES is not set', async () => {
    jest.resetModules();
    delete process.env.AI_MAX_RESPONSE_BYTES;
    process.env.AI_PROVIDER_ORDER = 'groq';
    mockGetRedisClient.mockResolvedValue(null);

    // Default is 5MB
    const oversizedLength = 5 * 1024 * 1024 + 1;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: jest.fn().mockReturnValue(String(oversizedLength)) },
      text: jest.fn().mockResolvedValue(''),
    });

    aiService = require('../../src/services/aiProviderService');

    await expect(
      aiService.generateAIResponse({
        userId: 'size-test-user',
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow('Content-Length exceeds 5242880 bytes');
  });

  it('should enforce the custom AI_MAX_RESPONSE_BYTES limit when it is set', async () => {
    jest.resetModules();
    process.env.AI_MAX_RESPONSE_BYTES = '1024'; // 1KB
    process.env.AI_PROVIDER_ORDER = 'groq';
    mockGetRedisClient.mockResolvedValue(null);

    // Larger than 1KB
    const oversizedLength = 2048;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: jest.fn().mockReturnValue(String(oversizedLength)) },
      text: jest.fn().mockResolvedValue(''),
    });

    aiService = require('../../src/services/aiProviderService');

    await expect(
      aiService.generateAIResponse({
        userId: 'size-test-user',
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow('Content-Length exceeds 1024 bytes');
  });
});
