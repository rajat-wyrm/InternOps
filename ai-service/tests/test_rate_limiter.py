import pytest
from unittest.mock import AsyncMock, patch
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.core.auth import User, get_current_user
import app.core.rate_limit as rate_limit_module
import app.core.rate_limiter as rate_limiter_module
from app.core.rate_limiter import RateLimiter, ai_rate_limiter, chat_rate_limiter
from app.main import app

class DummyClient:
    host = "127.0.0.1"

class DummyRequest:
    def __init__(self):
        self.headers = {}
        self.client = DummyClient()

@pytest.mark.asyncio
async def test_rate_limiter_blocks_after_limit():
    """Test the in-memory fallback logic"""
    limiter = RateLimiter(requests_per_minute=2)
    request = DummyRequest()

    # First request -> allowed
    await limiter.check_rate_limit(request)

    # Second request -> allowed
    await limiter.check_rate_limit(request)

    # Third request -> blocked
    with pytest.raises(HTTPException):
        await limiter.check_rate_limit(request)

@pytest.mark.asyncio
@patch("app.core.rate_limiter.redis_client", new_callable=AsyncMock)
async def test_rate_limiter_blocks_with_redis(mock_redis):
    """Test the Redis fixed-window logic"""
    limiter = RateLimiter(requests_per_minute=2)
    request = DummyRequest()

    # Make the mock Redis pretend the counter is at 3 (over the limit of 2)
    mock_redis.incr.return_value = 3

    with pytest.raises(HTTPException):
        await limiter.check_rate_limit(request)

    # Verify that the new code's correct Redis method was called
    mock_redis.incr.assert_called_once()


def test_rate_limiter_singleton_identity():
    """Verify that rate_limit.py and rate_limiter.py share the exact same RateLimiter instances."""
    # Only ONE shared ai_rate_limiter instance exists across both modules
    assert rate_limit_module.ai_rate_limiter is rate_limiter_module.ai_rate_limiter

    # Only ONE shared chat_rate_limiter instance exists across both modules
    assert rate_limit_module.chat_rate_limiter is rate_limiter_module.chat_rate_limiter

    # ai_rate_limiter and chat_rate_limiter refer to the exact same shared instance
    assert rate_limiter_module.chat_rate_limiter is rate_limiter_module.ai_rate_limiter
    assert rate_limit_module.chat_rate_limiter is rate_limit_module.ai_rate_limiter

    # Both modules share the exact same in-memory _hits dictionary
    assert rate_limit_module.ai_rate_limiter._hits is rate_limiter_module.ai_rate_limiter._hits
    assert rate_limit_module.chat_rate_limiter._hits is rate_limiter_module.ai_rate_limiter._hits


@pytest.mark.asyncio
async def test_shared_in_memory_state_between_limiters(monkeypatch):
    """When Redis is unavailable:
    1. A request through the limiter used by /ai/chat increments the shared in-memory state.
    2. A request through the limiter used by /generate sees that same state.
    3. The two modules do NOT maintain separate _hits dictionaries.
    4. The configured rate limit is enforced collectively across both limiters.
    """
    monkeypatch.setattr(rate_limiter_module, "redis_client", None)
    monkeypatch.setattr(rate_limit_module, "get_redis_client", lambda: None)

    orig_limit = ai_rate_limiter.requests_per_minute
    ai_rate_limiter.requests_per_minute = 3
    ai_rate_limiter._hits.clear()

    user = User(id="test-shared-user", roles=["ADMIN"])
    request = DummyRequest()

    try:
        # Verify 3: the two modules do NOT maintain separate _hits dictionaries
        assert rate_limit_module.chat_rate_limiter._hits is rate_limiter_module.ai_rate_limiter._hits

        # 1. Request through limiter used by /ai/chat (enforce_rate_limit)
        await rate_limit_module.enforce_rate_limit(request=request, user=user)
        assert len(ai_rate_limiter._hits["test-shared-user"]) == 1
        assert len(rate_limit_module.chat_rate_limiter._hits["test-shared-user"]) == 1

        # 2. Request through limiter used by /generate (ai_rate_limiter.check_rate_limit)
        await rate_limiter_module.ai_rate_limiter.check_rate_limit(request=request, current_user=user)
        assert len(ai_rate_limiter._hits["test-shared-user"]) == 2
        assert len(rate_limit_module.chat_rate_limiter._hits["test-shared-user"]) == 2

        # 3. Third request through enforce_rate_limit (/ai/chat)
        await rate_limit_module.enforce_rate_limit(request=request, user=user)
        assert len(ai_rate_limiter._hits["test-shared-user"]) == 3

        # 4. Fourth request through /generate limiter must be blocked by rate limit
        with pytest.raises(HTTPException) as exc_info:
            await rate_limiter_module.ai_rate_limiter.check_rate_limit(request=request, current_user=user)
        assert exc_info.value.status_code == 429
        assert "rate limit exceeded" in exc_info.value.detail.lower()

        # And fifth request through /ai/chat limiter is also blocked by rate limit
        with pytest.raises(HTTPException) as exc_info_chat:
            await rate_limit_module.enforce_rate_limit(request=request, user=user)
        assert exc_info_chat.value.status_code == 429
        assert "rate limit exceeded" in exc_info_chat.value.detail.lower()
    finally:
        ai_rate_limiter.requests_per_minute = orig_limit
        ai_rate_limiter._hits.clear()


def test_endpoints_collectively_enforce_rate_limit_when_redis_unavailable(monkeypatch):
    """Test full HTTP requests to /ai/chat and /generate using TestClient:
    They must share the same in-memory rate-limit state when Redis is unavailable.
    """
    monkeypatch.setattr(rate_limiter_module, "redis_client", None)
    monkeypatch.setattr(rate_limit_module, "get_redis_client", lambda: None)

    # Mock provider responses for /ai/chat and /generate
    from app.models.ai import ProviderResult
    import app.api.ai_routes as ai_routes_module
    from app.providers.orchestrator import ai_orchestrator

    async def fake_call_provider(user_id, messages):
        return ProviderResult(provider="mock-provider", cached=False, content="chat reply")

    async def fake_generate_chat(messages, **kwargs):
        return "generate reply", "mock-provider"

    monkeypatch.setattr(ai_routes_module, "call_provider", fake_call_provider)
    monkeypatch.setattr(ai_orchestrator, "generate_chat_with_fallback", fake_generate_chat)

    orig_limit = ai_rate_limiter.requests_per_minute
    ai_rate_limiter.requests_per_minute = 3
    ai_rate_limiter._hits.clear()

    user_id = "cross-endpoint-user"
    app.dependency_overrides[get_current_user] = lambda: User(id=user_id, roles=["ADMIN"])

    try:
        client = TestClient(app, raise_server_exceptions=False)

        # 1. /ai/chat request 1 -> allowed (200)
        r1 = client.post("/ai/chat", json={"prompt": "hello 1"})
        assert r1.status_code == 200

        # Shared in-memory hit count is 1
        assert len(ai_rate_limiter._hits[user_id]) == 1

        # 2. /generate request 2 -> allowed (200)
        r2 = client.post("/generate", json={"prompt": "hello 2"})
        assert r2.status_code == 200

        # Shared in-memory hit count is 2
        assert len(ai_rate_limiter._hits[user_id]) == 2

        # 3. /ai/chat request 3 -> allowed (200)
        r3 = client.post("/ai/chat", json={"prompt": "hello 3"})
        assert r3.status_code == 200

        # Shared in-memory hit count is 3 (limit reached)
        assert len(ai_rate_limiter._hits[user_id]) == 3

        # 4. /generate request 4 -> blocked with 429
        r4 = client.post("/generate", json={"prompt": "hello 4"})
        assert r4.status_code == 429
        assert "rate limit exceeded" in r4.json()["detail"].lower()

        # 5. /ai/chat request 5 -> also blocked with 429
        r5 = client.post("/ai/chat", json={"prompt": "hello 5"})
        assert r5.status_code == 429
        assert "rate limit exceeded" in r5.json()["detail"].lower()
    finally:
        ai_rate_limiter.requests_per_minute = orig_limit
        ai_rate_limiter._hits.clear()
        app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_shared_limiter_with_redis(monkeypatch):
    """Verify that both /ai/chat (enforce_rate_limit) and /generate (ai_rate_limiter)
    increment the exact same Redis key when Redis is configured.
    """
    class MockRedis:
        def __init__(self):
            self.keys_hit = []
            self.count = 0

        async def incr(self, key):
            self.keys_hit.append(key)
            self.count += 1
            return self.count

        async def expire(self, key, seconds):
            pass

    mock_redis = MockRedis()
    monkeypatch.setattr(rate_limiter_module, "redis_client", mock_redis)
    monkeypatch.setattr(rate_limit_module, "get_redis_client", lambda: mock_redis)

    user = User(id="redis-shared-user", roles=["ADMIN"])
    request = DummyRequest()

    # Request 1 via enforce_rate_limit (/ai/chat)
    await rate_limit_module.enforce_rate_limit(request=request, user=user)

    # Request 2 via ai_rate_limiter (/generate)
    await rate_limiter_module.ai_rate_limiter.check_rate_limit(request=request, current_user=user)

    # Both must have targeted the exact same Redis key
    expected_key = "ai:ratelimit:redis-shared-user"
    assert mock_redis.keys_hit == [expected_key, expected_key]
    assert mock_redis.count == 2
