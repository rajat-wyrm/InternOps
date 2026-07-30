import httpx
import pytest
import respx

from app.providers import (
    GeminiProvider,
    OpenAIProvider,
    ProviderAPIError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)

GEMINI_URL_PREFIX = "https://generativelanguage.googleapis.com/v1beta/models/"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"


# ---------------------------------------------------------------------------
# 1. Import sanity (issue checklist item #1)
# ---------------------------------------------------------------------------
def test_imports_succeed():
    assert GeminiProvider is not None
    assert OpenAIProvider is not None


# ---------------------------------------------------------------------------
# 2. Gemini: 429 -> ProviderRateLimitError (checklist item #2)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_gemini_rate_limit_maps_to_provider_rate_limit_error():
    route = respx.post(url__startswith=GEMINI_URL_PREFIX).mock(
        return_value=httpx.Response(429, json={"error": "quota exceeded"})
    )
    provider = GeminiProvider(api_key="test-key")

    with pytest.raises(ProviderRateLimitError):
        await provider.generate_text("hello")

    assert route.called


# ---------------------------------------------------------------------------
# 3. OpenAI: timeout -> ProviderTimeoutError (checklist item #3)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_openai_timeout_maps_to_provider_timeout_error():
    respx.post(OPENAI_URL).mock(side_effect=httpx.TimeoutException("timed out"))
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(ProviderTimeoutError):
        await provider.generate_text("hello")


# ---------------------------------------------------------------------------
# 4. generate_json returns a parsed dict on valid JSON (checklist item #4)
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_openai_generate_json_returns_parsed_dict():
    respx.post(OPENAI_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "choices": [
                    {"message": {"content": '{"result": "ok", "score": 5}'}}
                ]
            },
        )
    )
    provider = OpenAIProvider(api_key="test-key")

    result = await provider.generate_json("rate this", schema={"result": "str", "score": "int"})

    assert result == {"result": "ok", "score": 5}


@pytest.mark.asyncio
@respx.mock
async def test_gemini_generate_json_returns_parsed_dict():
    respx.post(url__startswith=GEMINI_URL_PREFIX).mock(
        return_value=httpx.Response(
            200,
            json={
                "candidates": [
                    {"content": {"parts": [{"text": '{"template": "certificate-a"}'}]}}
                ]
            },
        )
    )
    provider = GeminiProvider(api_key="test-key")

    result = await provider.generate_json("suggest a template", schema={"template": "str"})

    assert result == {"template": "certificate-a"}


# ---------------------------------------------------------------------------
# Extra: generic non-2xx, non-429 status -> ProviderAPIError
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_openai_server_error_maps_to_provider_api_error():
    respx.post(OPENAI_URL).mock(return_value=httpx.Response(503, text="unavailable"))
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError):
        await provider.generate_text("hello")


# ---------------------------------------------------------------------------
# Extra: oversized response is rejected before full JSON parsing
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
@respx.mock
async def test_openai_oversized_response_raises_provider_api_error(monkeypatch):
    monkeypatch.setattr("app.providers.openai.MAX_RESPONSE_BYTES", 10)
    respx.post(OPENAI_URL).mock(
        return_value=httpx.Response(200, json={"choices": [{"message": {"content": "x" * 100}}]})
    )
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError, match="exceeded"):
        await provider.generate_text("hello")
