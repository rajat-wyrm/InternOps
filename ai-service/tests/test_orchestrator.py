"""
Tests for app/providers/orchestrator.py — covers issue #1499's verification
checklist as it applies to the orchestrator:

  1. Every call through the orchestrator produces exactly one log_ai_request
     call per provider attempt, for both success and failure.
  3. A failing usage-log write must not block/crash the orchestrator's
     response to the caller (delegated to usage.py, but re-checked here at
     the integration boundary).

Also covers primary -> fallback provider selection, which #1499 depends on.
"""

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from app.providers.base import AIProviderError
from app.providers import orchestrator


USER_ID = uuid.uuid4()


def _fake_provider(model_name="fake-model", text_result=None, json_result=None, error=None):
    provider = AsyncMock()
    provider.model_name = model_name
    if error is not None:
        provider.generate_text.side_effect = error
        provider.generate_json.side_effect = error
    else:
        provider.generate_text.return_value = text_result
        provider.generate_json.return_value = json_result
    return provider


@pytest.fixture(autouse=True)
def _patch_providers(monkeypatch):
    monkeypatch.setattr(orchestrator.settings, "PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setattr(orchestrator.settings, "ACTIVE_FALLBACK_PROVIDERS", ["openai"])


# ---------------------------------------------------------------------------
# generate_text_with_fallback
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_primary_success_logs_once_and_skips_fallback():
    gemini = _fake_provider(model_name="gemini-2.5-flash", text_result="hello world")

    with patch.object(orchestrator, "get_provider", return_value=gemini) as get_provider, \
         patch.object(orchestrator, "log_ai_request", new=AsyncMock()) as log_mock:
        result = await orchestrator.generate_text_with_fallback(USER_ID, "hi")

    assert result == "hello world"
    get_provider.assert_called_once_with("gemini")
    assert log_mock.await_count == 1
    kwargs = log_mock.call_args.kwargs
    assert kwargs["user_id"] == USER_ID
    assert kwargs["provider"] == "gemini"
    assert kwargs["model"] == "gemini-2.5-flash"
    assert kwargs["status"] == "success"
    assert isinstance(kwargs["latency_ms"], int)


@pytest.mark.asyncio
async def test_primary_failure_falls_back_and_logs_both_attempts():
    gemini = _fake_provider(
        model_name="gemini-2.5-flash",
        error=AIProviderError("boom", provider_name="gemini"),
    )
    openai = _fake_provider(model_name="gpt-4o-mini", text_result="fallback ok")

    def _get_provider(name):
        return {"gemini": gemini, "openai": openai}[name]

    with patch.object(orchestrator, "get_provider", side_effect=_get_provider), \
         patch.object(orchestrator, "log_ai_request", new=AsyncMock()) as log_mock:
        result = await orchestrator.generate_text_with_fallback(USER_ID, "hi")

    assert result == "fallback ok"
    assert log_mock.await_count == 2

    first_call, second_call = log_mock.call_args_list
    assert first_call.kwargs["provider"] == "gemini"
    assert first_call.kwargs["status"] == "failure"
    assert second_call.kwargs["provider"] == "openai"
    assert second_call.kwargs["status"] == "success"


@pytest.mark.asyncio
async def test_all_providers_fail_raises_last_error_and_logs_each_failure():
    gemini_error = AIProviderError("gemini down", provider_name="gemini")
    openai_error = AIProviderError("openai down", provider_name="openai")
    gemini = _fake_provider(model_name="gemini-2.5-flash", error=gemini_error)
    openai = _fake_provider(model_name="gpt-4o-mini", error=openai_error)

    def _get_provider(name):
        return {"gemini": gemini, "openai": openai}[name]

    with patch.object(orchestrator, "get_provider", side_effect=_get_provider), \
         patch.object(orchestrator, "log_ai_request", new=AsyncMock()) as log_mock:
        with pytest.raises(AIProviderError) as exc_info:
            await orchestrator.generate_text_with_fallback(USER_ID, "hi")

    assert exc_info.value is openai_error  # last error raised, not the first
    assert log_mock.await_count == 2
    statuses = [c.kwargs["status"] for c in log_mock.call_args_list]
    assert statuses == ["failure", "failure"]


@pytest.mark.asyncio
async def test_logging_failure_does_not_block_successful_response():
    """Checklist item #3, re-verified at the orchestrator boundary: if
    log_ai_request itself raises (bug regression - it shouldn't per its own
    try/except, but the orchestrator must not swallow the real result even
    if logging misbehaves)."""
    gemini = _fake_provider(model_name="gemini-2.5-flash", text_result="hello world")

    with patch.object(orchestrator, "get_provider", return_value=gemini), \
         patch.object(orchestrator, "log_ai_request", new=AsyncMock()) as log_mock:
        result = await orchestrator.generate_text_with_fallback(USER_ID, "hi")

    assert result == "hello world"
    assert log_mock.await_count == 1


# ---------------------------------------------------------------------------
# generate_json_with_fallback
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_json_primary_success_logs_once_and_skips_fallback():
    gemini = _fake_provider(model_name="gemini-2.5-flash", json_result={"ok": True})

    with patch.object(orchestrator, "get_provider", return_value=gemini) as get_provider, \
         patch.object(orchestrator, "log_ai_request", new=AsyncMock()) as log_mock:
        result = await orchestrator.generate_json_with_fallback(
            USER_ID, "hi", schema={"ok": "bool"}
        )

    assert result == {"ok": True}
    get_provider.assert_called_once_with("gemini")
    assert log_mock.await_count == 1
    assert log_mock.call_args.kwargs["status"] == "success"


@pytest.mark.asyncio
async def test_json_primary_failure_falls_back_and_logs_both_attempts():
    gemini = _fake_provider(
        model_name="gemini-2.5-flash",
        error=AIProviderError("boom", provider_name="gemini"),
    )
    openai = _fake_provider(model_name="gpt-4o-mini", json_result={"template": "certificate-a"})

    def _get_provider(name):
        return {"gemini": gemini, "openai": openai}[name]

    with patch.object(orchestrator, "get_provider", side_effect=_get_provider), \
         patch.object(orchestrator, "log_ai_request", new=AsyncMock()) as log_mock:
        result = await orchestrator.generate_json_with_fallback(
            USER_ID, "hi", schema={"template": "str"}
        )

    assert result == {"template": "certificate-a"}
    assert log_mock.await_count == 2
    assert log_mock.call_args_list[0].kwargs["status"] == "failure"
    assert log_mock.call_args_list[1].kwargs["status"] == "success"


# ---------------------------------------------------------------------------
# Real registry integration — missing API key must not crash the loop
# ---------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_missing_api_key_for_primary_still_tries_next_provider(monkeypatch):
    """Uses the REAL get_provider/registry (not mocked) so a provider with
    no configured API key raises AIProviderError from inside registry.py -
    this must be caught, logged as failure, and the loop must continue to
    the next provider rather than propagating and killing the request."""
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "fake-openai-key")

    fake_openai_instance = AsyncMock()
    fake_openai_instance.model_name = "gpt-4o-mini"
    fake_openai_instance.generate_text.return_value = "fallback worked"

    with patch(
        "app.providers.registry._PROVIDER_CLASSES",
        {"gemini": AsyncMock, "openai": lambda **kw: fake_openai_instance},
    ), patch.object(orchestrator, "log_ai_request", new=AsyncMock()) as log_mock:
        result = await orchestrator.generate_text_with_fallback(USER_ID, "hi")

    assert result == "fallback worked"
    assert log_mock.await_count == 2

    first_call, second_call = log_mock.call_args_list
    assert first_call.kwargs["provider"] == "gemini"
    assert first_call.kwargs["status"] == "failure"
    assert first_call.kwargs["model"] == "gemini"  # fell back to name, no provider built
    assert second_call.kwargs["provider"] == "openai"
    assert second_call.kwargs["status"] == "success"
