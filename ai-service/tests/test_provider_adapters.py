import httpx
import pytest
import respx

from app.providers import (
    GeminiProvider,
    OpenAIProvider,
    GroqProvider,
    AnthropicProvider,
    DeepSeekProvider,
    HuggingFaceProvider,
    NvidiaProvider,
    ProviderAPIError,
    ProviderRateLimitError,
    ProviderTimeoutError,
)

GEMINI_URL_PREFIX = "https://generativelanguage.googleapis.com/v1beta/models/"
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations"
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
DEEPSEEK_URL = "https://api.deepseek.com/v1/chat/completions"
HUGGINGFACE_URL_PREFIX = "https://api-inference.huggingface.co/models/"
NVIDIA_URL = "https://integrate.api.nvidia.com/v1/chat/completions"


# ===========================================================================
# 1. Import sanity (issue checklist item #1)
# ===========================================================================
def test_imports_succeed():
    assert GeminiProvider is not None
    assert OpenAIProvider is not None


def test_new_provider_imports_succeed():
    assert GroqProvider is not None
    assert AnthropicProvider is not None
    assert DeepSeekProvider is not None
    assert HuggingFaceProvider is not None


# ===========================================================================
# 2. Gemini: 429 -> ProviderRateLimitError (checklist item #2)
# ===========================================================================
@pytest.mark.asyncio
@respx.mock
async def test_gemini_rate_limit_maps_to_provider_rate_limit_error():
    route = respx.post(url__startswith=GEMINI_URL_PREFIX).mock(
        return_value=httpx.Response(429, json={"error": "quota exceeded"})
    )
    provider = GeminiProvider(api_key="test-key")

    with pytest.raises(ProviderRateLimitError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])

    assert route.called


# ===========================================================================
# 3. OpenAI: timeout -> ProviderTimeoutError (checklist item #3)
# ===========================================================================
@pytest.mark.asyncio
@respx.mock
async def test_openai_timeout_maps_to_provider_timeout_error():
    respx.post(OPENAI_URL).mock(side_effect=httpx.TimeoutException("timed out"))
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(ProviderTimeoutError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


# ===========================================================================
# 4. generate_json returns a parsed dict on valid JSON (checklist item #4)
# ===========================================================================
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


# ===========================================================================
# Extra: generic non-2xx, non-429 status -> ProviderAPIError
# ===========================================================================
@pytest.mark.asyncio
@respx.mock
async def test_openai_server_error_maps_to_provider_api_error():
    respx.post(OPENAI_URL).mock(return_value=httpx.Response(503, text="unavailable"))
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


# ===========================================================================
# Extra: oversized response is rejected before full JSON parsing
# ===========================================================================
@pytest.mark.asyncio
@respx.mock
async def test_openai_oversized_response_raises_provider_api_error(monkeypatch):
    monkeypatch.setattr("app.providers.openai.MAX_RESPONSE_BYTES", 10)
    respx.post(OPENAI_URL).mock(
        return_value=httpx.Response(200, json={"choices": [{"message": {"content": "x" * 100}}]})
    )
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError, match="exceeded"):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


# ===========================================================================
# OpenAI: generate_image (issue #1801 -- AI-generated assignment visuals)
# ===========================================================================
@pytest.mark.asyncio
@respx.mock
async def test_openai_generate_image_returns_url():
    respx.post(OPENAI_IMAGE_URL).mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [
                    {
                        "url": "https://example.com/generated.png",
                        "revised_prompt": "a detailed poster about recycling",
                    }
                ]
            },
        )
    )
    provider = OpenAIProvider(api_key="test-key")

    result = await provider.generate_image("a poster about recycling")

    assert result["url"] == "https://example.com/generated.png"
    assert result["revised_prompt"] == "a detailed poster about recycling"


@pytest.mark.asyncio
@respx.mock
async def test_openai_generate_image_rate_limit_maps_to_provider_rate_limit_error():
    respx.post(OPENAI_IMAGE_URL).mock(return_value=httpx.Response(429, json={"error": "quota exceeded"}))
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(ProviderRateLimitError):
        await provider.generate_image("a poster about recycling")


@pytest.mark.asyncio
@respx.mock
async def test_openai_generate_image_timeout_maps_to_provider_timeout_error():
    respx.post(OPENAI_IMAGE_URL).mock(side_effect=httpx.TimeoutException("timed out"))
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(ProviderTimeoutError):
        await provider.generate_image("a poster about recycling")


@pytest.mark.asyncio
@respx.mock
async def test_openai_generate_image_server_error_maps_to_provider_api_error():
    respx.post(OPENAI_IMAGE_URL).mock(return_value=httpx.Response(503, text="unavailable"))
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError):
        await provider.generate_image("a poster about recycling")


@pytest.mark.asyncio
@respx.mock
async def test_openai_generate_image_malformed_payload_raises_provider_api_error():
    respx.post(OPENAI_IMAGE_URL).mock(return_value=httpx.Response(200, json={"data": []}))
    provider = OpenAIProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError):
        await provider.generate_image("a poster about recycling")


# ===========================================================================
# GROQ PROVIDER TESTS
# ===========================================================================
@pytest.mark.asyncio
@respx.mock
async def test_groq_generate_chat_success():
    respx.post(GROQ_URL).mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": "Hello from Groq!"}}]},
        )
    )
    provider = GroqProvider(api_key="test-key")
    result = await provider.generate_chat([{"role": "user", "content": "hello"}])
    assert result == "Hello from Groq!"


@pytest.mark.asyncio
@respx.mock
async def test_groq_rate_limit_maps_to_provider_rate_limit_error():
    respx.post(GROQ_URL).mock(
        return_value=httpx.Response(429, json={"error": "rate limited"})
    )
    provider = GroqProvider(api_key="test-key")

    with pytest.raises(ProviderRateLimitError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_groq_timeout_maps_to_provider_timeout_error():
    respx.post(GROQ_URL).mock(side_effect=httpx.TimeoutException("timed out"))
    provider = GroqProvider(api_key="test-key")

    with pytest.raises(ProviderTimeoutError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_groq_generate_json_returns_parsed_dict():
    respx.post(GROQ_URL).mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"status": "active"}'}}]},
        )
    )
    provider = GroqProvider(api_key="test-key")
    result = await provider.generate_json("check status", schema={"status": "str"})
    assert result == {"status": "active"}


@pytest.mark.asyncio
@respx.mock
async def test_groq_server_error_maps_to_provider_api_error():
    respx.post(GROQ_URL).mock(return_value=httpx.Response(500, text="internal error"))
    provider = GroqProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


# ===========================================================================
# ANTHROPIC PROVIDER TESTS
# ===========================================================================
@pytest.mark.asyncio
@respx.mock
async def test_anthropic_generate_chat_success():
    respx.post(ANTHROPIC_URL).mock(
        return_value=httpx.Response(
            200,
            json={"content": [{"type": "text", "text": "Hello from Claude!"}]},
        )
    )
    provider = AnthropicProvider(api_key="test-key")
    result = await provider.generate_chat([{"role": "user", "content": "hello"}])
    assert result == "Hello from Claude!"


@pytest.mark.asyncio
@respx.mock
async def test_anthropic_rate_limit_maps_to_provider_rate_limit_error():
    respx.post(ANTHROPIC_URL).mock(
        return_value=httpx.Response(429, json={"error": "rate limited"})
    )
    provider = AnthropicProvider(api_key="test-key")

    with pytest.raises(ProviderRateLimitError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_anthropic_timeout_maps_to_provider_timeout_error():
    respx.post(ANTHROPIC_URL).mock(side_effect=httpx.TimeoutException("timed out"))
    provider = AnthropicProvider(api_key="test-key")

    with pytest.raises(ProviderTimeoutError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_anthropic_generate_json_returns_parsed_dict():
    respx.post(ANTHROPIC_URL).mock(
        return_value=httpx.Response(
            200,
            json={"content": [{"type": "text", "text": '{"priority": "high"}'}]},
        )
    )
    provider = AnthropicProvider(api_key="test-key")
    result = await provider.generate_json("set priority", schema={"priority": "str"})
    assert result == {"priority": "high"}


@pytest.mark.asyncio
@respx.mock
async def test_anthropic_server_error_maps_to_provider_api_error():
    respx.post(ANTHROPIC_URL).mock(return_value=httpx.Response(503, text="overloaded"))
    provider = AnthropicProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


# ===========================================================================
# DEEPSEEK PROVIDER TESTS
# ===========================================================================
@pytest.mark.asyncio
@respx.mock
async def test_deepseek_generate_chat_success():
    respx.post(DEEPSEEK_URL).mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": "Hello from DeepSeek!"}}]},
        )
    )
    provider = DeepSeekProvider(api_key="test-key")
    result = await provider.generate_chat([{"role": "user", "content": "hello"}])
    assert result == "Hello from DeepSeek!"


@pytest.mark.asyncio
@respx.mock
async def test_deepseek_rate_limit_maps_to_provider_rate_limit_error():
    respx.post(DEEPSEEK_URL).mock(
        return_value=httpx.Response(429, json={"error": "rate limited"})
    )
    provider = DeepSeekProvider(api_key="test-key")

    with pytest.raises(ProviderRateLimitError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_deepseek_timeout_maps_to_provider_timeout_error():
    respx.post(DEEPSEEK_URL).mock(side_effect=httpx.TimeoutException("timed out"))
    provider = DeepSeekProvider(api_key="test-key")

    with pytest.raises(ProviderTimeoutError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_deepseek_generate_json_returns_parsed_dict():
    respx.post(DEEPSEEK_URL).mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"count": 42}'}}]},
        )
    )
    provider = DeepSeekProvider(api_key="test-key")
    result = await provider.generate_json("count items", schema={"count": "int"})
    assert result == {"count": 42}


@pytest.mark.asyncio
@respx.mock
async def test_deepseek_server_error_maps_to_provider_api_error():
    respx.post(DEEPSEEK_URL).mock(return_value=httpx.Response(502, text="bad gateway"))
    provider = DeepSeekProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


# ===========================================================================
# HUGGINGFACE PROVIDER TESTS
# ===========================================================================
@pytest.mark.asyncio
@respx.mock
async def test_huggingface_generate_chat_success():
    respx.post(url__startswith=HUGGINGFACE_URL_PREFIX).mock(
        return_value=httpx.Response(
            200,
            json=[{"generated_text": "Hello from HuggingFace!"}],
        )
    )
    provider = HuggingFaceProvider(api_key="test-token")
    result = await provider.generate_chat([{"role": "user", "content": "hello"}])
    assert result == "Hello from HuggingFace!"


@pytest.mark.asyncio
@respx.mock
async def test_huggingface_rate_limit_maps_to_provider_rate_limit_error():
    respx.post(url__startswith=HUGGINGFACE_URL_PREFIX).mock(
        return_value=httpx.Response(429, json={"error": "rate limited"})
    )
    provider = HuggingFaceProvider(api_key="test-token")

    with pytest.raises(ProviderRateLimitError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_huggingface_timeout_maps_to_provider_timeout_error():
    respx.post(url__startswith=HUGGINGFACE_URL_PREFIX).mock(
        side_effect=httpx.TimeoutException("timed out")
    )
    provider = HuggingFaceProvider(api_key="test-token")

    with pytest.raises(ProviderTimeoutError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_huggingface_generate_json_returns_parsed_dict():
    respx.post(url__startswith=HUGGINGFACE_URL_PREFIX).mock(
        return_value=httpx.Response(
            200,
            json=[{"generated_text": '{"language": "python"}'}],
        )
    )
    provider = HuggingFaceProvider(api_key="test-token")
    result = await provider.generate_json("detect language", schema={"language": "str"})
    assert result == {"language": "python"}


@pytest.mark.asyncio
@respx.mock
async def test_huggingface_server_error_maps_to_provider_api_error():
    respx.post(url__startswith=HUGGINGFACE_URL_PREFIX).mock(
        return_value=httpx.Response(503, text="model loading")
    )
    provider = HuggingFaceProvider(api_key="test-token")

    with pytest.raises(ProviderAPIError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_huggingface_oversized_response_raises_provider_api_error(monkeypatch):
    monkeypatch.setattr("app.providers.huggingface.MAX_RESPONSE_BYTES", 10)
    respx.post(url__startswith=HUGGINGFACE_URL_PREFIX).mock(
        return_value=httpx.Response(
            200, json=[{"generated_text": "x" * 100}]
        )
    )
    provider = HuggingFaceProvider(api_key="test-token")

    with pytest.raises(ProviderAPIError, match="exceeded"):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


# ===========================================================================
# NVIDIA PROVIDER TESTS
# ===========================================================================
@pytest.mark.asyncio
@respx.mock
async def test_nvidia_generate_chat_success():
    respx.post(NVIDIA_URL).mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": "Hello from Nvidia NIM!"}}]},
        )
    )
    provider = NvidiaProvider(api_key="test-key")
    result = await provider.generate_chat([{"role": "user", "content": "hello"}])
    assert result == "Hello from Nvidia NIM!"


@pytest.mark.asyncio
@respx.mock
async def test_nvidia_rate_limit_maps_to_provider_rate_limit_error():
    respx.post(NVIDIA_URL).mock(
        return_value=httpx.Response(429, text="Rate limit exceeded")
    )
    provider = NvidiaProvider(api_key="test-key")

    with pytest.raises(ProviderRateLimitError) as exc:
        await provider.generate_chat([{"role": "user", "content": "hello"}])
    assert exc.value.status_code == 429


@pytest.mark.asyncio
@respx.mock
async def test_nvidia_timeout_maps_to_provider_timeout_error():
    respx.post(NVIDIA_URL).mock(side_effect=httpx.TimeoutException("timed out"))
    provider = NvidiaProvider(api_key="test-key")

    with pytest.raises(ProviderTimeoutError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_nvidia_generate_json_returns_parsed_dict():
    respx.post(NVIDIA_URL).mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": '{"language": "python"}'}}]},
        )
    )
    provider = NvidiaProvider(api_key="test-key")
    result = await provider.generate_json("detect language", schema={"language": "str"})
    assert result == {"language": "python"}


@pytest.mark.asyncio
@respx.mock
async def test_nvidia_server_error_maps_to_provider_api_error():
    respx.post(NVIDIA_URL).mock(return_value=httpx.Response(502, text="bad gateway"))
    provider = NvidiaProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError):
        await provider.generate_chat([{"role": "user", "content": "hello"}])


@pytest.mark.asyncio
@respx.mock
async def test_nvidia_oversized_response_raises_provider_api_error(monkeypatch):
    monkeypatch.setattr("app.providers.nvidia.MAX_RESPONSE_BYTES", 10)
    respx.post(NVIDIA_URL).mock(
        return_value=httpx.Response(
            200,
            json={"choices": [{"message": {"content": "x" * 100}}]},
        )
    )
    provider = NvidiaProvider(api_key="test-key")

    with pytest.raises(ProviderAPIError, match="exceeded"):
        await provider.generate_chat([{"role": "user", "content": "hello"}])
