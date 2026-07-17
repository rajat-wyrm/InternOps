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
global.fetch = mockFetch;

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
    global.fetch = mockFetch;

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

    await expect(
      aiService.generateAIResponse({
        userId: 'user-3',
        messages: [{ role: 'user', content: 'Will fail' }],
      })
    ).rejects.toThrow('All AI providers unavailable');

    await expect(
      aiService.generateAIResponse({
        userId: 'user-3',
        messages: [{ role: 'user', content: 'Will fail' }],
      })
    ).rejects.toThrow('All AI providers unavailable');

    await expect(
      aiService.generateAIResponse({
        userId: 'user-3',
        messages: [{ role: 'user', content: 'Will fail' }],
      })
    ).rejects.toThrow('All AI providers unavailable');

    await expect(
      aiService.generateAIResponse({
        userId: 'user-3',
        messages: [{ role: 'user', content: 'Will fail' }],
      })
    ).rejects.toThrow('All AI providers unavailable');

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('should reject invalid input that exceeds the prompt size limit', async () => {
    jest.resetModules();
    process.env.AI_PROVIDER_ORDER = 'gemini';
    mockConfig.ai.geminiKey = '';
    mockGetRedisClient.mockResolvedValue(null);
    aiService = require('../../src/services/aiProviderService');

    const hugeMessage = { role: 'user', content: 'x'.repeat(40000) };

    await expect(
      aiService.generateAIResponse({
        userId: 'user-4',
        messages: [hugeMessage],
      })
    ).rejects.toThrow('All AI providers unavailable');
  });
});
