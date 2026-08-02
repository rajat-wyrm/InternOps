import os
import sys
import importlib
import pytest
from unittest import mock
from pydantic_settings import SettingsConfigDict

# Ensure ai-service root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    # Mock dotenv.load_dotenv to do nothing
    import dotenv
    monkeypatch.setattr(dotenv, "load_dotenv", lambda *args, **kwargs: None)
    
    # Mock DotEnvSettingsSource.__call__ to return an empty dict to bypass physical .env reading
    import pydantic_settings
    monkeypatch.setattr(pydantic_settings.sources.DotEnvSettingsSource, "__call__", lambda self: {})

    # Keep track of and remove any AI-service environment variables before each test
    prefix_keys = ("GEMINI_", "GROQ_", "OPENAI_", "ANTHROPIC_", "DEEPSEEK_", "HUGGINGFACE_", "PRIMARY_", "FALLBACK_")
    original = {k: os.environ.get(k) for k in os.environ if k.startswith(prefix_keys)}
    for k in original:
        if k in os.environ:
            del os.environ[k]
    yield
    # Restore original environment variables after test
    for k, v in original.items():
        if v is not None:
            os.environ[k] = v
        elif k in os.environ:
            del os.environ[k]

def reload_config():
    from app.core import config
    return importlib.reload(config)

def test_success_single_provider():
    # Configure exactly one provider (gemini) with credentials
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key_123"

    cfg = reload_config()
    assert cfg.PRIMARY_AI_PROVIDER == "gemini"
    assert cfg.GEMINI_API_KEY == "valid_gemini_key_123"
    # Fallback configuration options are preserved but active filtered out
    assert cfg.FALLBACK_AI_PROVIDERS == ["groq", "openai", "anthropic"]
    assert cfg.ACTIVE_FALLBACK_PROVIDERS == []

def test_startup_fail_zero_providers(monkeypatch):
    import importlib
    import app.core.config as config

    monkeypatch.setenv("PRIMARY_AI_PROVIDER", "gemini")
    monkeypatch.setenv("GEMINI_API_KEY", "")

    with pytest.raises(Exception) as exc_info:
        importlib.reload(config)

    assert "Startup validation failed" in str(exc_info.value)

def test_invalid_primary_provider():
    os.environ["PRIMARY_AI_PROVIDER"] = "invalid_provider"
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key"

    with pytest.raises(Exception) as exc_info:
        reload_config()
    
    assert "PRIMARY_AI_PROVIDER" in str(exc_info.value)

def test_invalid_fallback_provider():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key"
    os.environ["FALLBACK_AI_PROVIDERS"] = "groq,invalid_provider"

    with pytest.raises(Exception) as exc_info:
        reload_config()
    
    assert "Fallback provider 'invalid_provider' is not supported" in str(exc_info.value)

def test_duplicate_fallback_providers():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key"
    os.environ["FALLBACK_AI_PROVIDERS"] = "groq, openai, groq"
    os.environ["GROQ_API_KEY"] = "valid_groq_key"
    os.environ["OPENAI_API_KEY"] = "valid_openai_key"

    cfg = reload_config()
    # Duplicates should be removed while preserving order in config
    assert cfg.FALLBACK_AI_PROVIDERS == ["groq", "openai"]
    assert cfg.ACTIVE_FALLBACK_PROVIDERS == ["groq", "openai"]

def test_mixed_case_and_whitespace():
    os.environ["PRIMARY_AI_PROVIDER"] = " Gemini "
    os.environ["FALLBACK_AI_PROVIDERS"] = " Groq , OpenAI "
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key"
    os.environ["GROQ_API_KEY"] = "valid_groq_key"
    os.environ["OPENAI_API_KEY"] = "valid_openai_key"

    cfg = reload_config()
    assert cfg.PRIMARY_AI_PROVIDER == "gemini"
    assert cfg.FALLBACK_AI_PROVIDERS == ["groq", "openai"]
    assert cfg.ACTIVE_FALLBACK_PROVIDERS == ["groq", "openai"]

def test_empty_fallback_list():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key"
    os.environ["FALLBACK_AI_PROVIDERS"] = "   "

    cfg = reload_config()
    assert cfg.FALLBACK_AI_PROVIDERS == []
    assert cfg.ACTIVE_FALLBACK_PROVIDERS == []

def test_placeholder_validation():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "your_gemini_api_key"  # Exactly the placeholder

    with pytest.raises(Exception) as exc_info:
        reload_config()
    
    assert "missing or set to a placeholder" in str(exc_info.value)

def test_fallback_credential_filtering():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini"
    os.environ["FALLBACK_AI_PROVIDERS"] = "groq,openai"
    os.environ["GROQ_API_KEY"] = "valid_groq"
    os.environ["OPENAI_API_KEY"] = "your_openai_api_key"  # placeholder key for openai

    cfg = reload_config()
    # Configuration lists original fallback list
    assert cfg.FALLBACK_AI_PROVIDERS == ["groq", "openai"]
    # Runtime state reflects only the active ones
    assert cfg.ACTIVE_FALLBACK_PROVIDERS == ["groq"]

def test_model_validation_and_defaults():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini"
    os.environ["FALLBACK_AI_PROVIDERS"] = "groq"
    os.environ["GROQ_API_KEY"] = "valid_groq"

    # Don't set models, they should resolve to default values
    cfg = reload_config()
    assert cfg.GEMINI_MODEL == "gemini-2.0-flash"
    assert cfg.GROQ_MODEL == "llama-3.3-70b-versatile"

    # Set override for gemini model
    os.environ["GEMINI_MODEL"] = "custom-gemini-model"
    cfg = reload_config()
    assert cfg.GEMINI_MODEL == "custom-gemini-model"

def test_conflict_primary_in_fallback_list():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini"
    os.environ["FALLBACK_AI_PROVIDERS"] = "groq,gemini"

    with pytest.raises(Exception) as exc_info:
        reload_config()
    
    assert "cannot also be listed in FALLBACK_AI_PROVIDERS" in str(exc_info.value)

def test_get_provider_key_success():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key"
    os.environ["FALLBACK_AI_PROVIDERS"] = "groq"
    os.environ["GROQ_API_KEY"] = "valid_groq_key"

    cfg = reload_config()
    assert cfg.settings.get_provider_key("gemini") == "valid_gemini_key"
    # Case-insensitive / whitespace tolerant
    assert cfg.settings.get_provider_key(" Groq ") == "valid_groq_key"

def test_get_provider_key_missing_raises_descriptive_error():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key"
    # OPENAI_API_KEY intentionally left unset

    cfg = reload_config()
    with pytest.raises(ValueError) as exc_info:
        cfg.settings.get_provider_key("openai")

    assert "Missing or invalid API key for provider 'openai'" in str(exc_info.value)

def test_get_provider_key_placeholder_raises_descriptive_error():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key"
    os.environ["ANTHROPIC_API_KEY"] = "your_anthropic_api_key"  # placeholder

    cfg = reload_config()
    with pytest.raises(ValueError) as exc_info:
        cfg.settings.get_provider_key("anthropic")

    assert "Missing or invalid API key" in str(exc_info.value)

def test_get_provider_key_unsupported_provider_raises_error():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key"

    cfg = reload_config()
    with pytest.raises(ValueError) as exc_info:
        cfg.settings.get_provider_key("not_a_real_provider")

    assert "not a supported provider" in str(exc_info.value)

def test_get_provider_key_huggingface():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini_key"
    os.environ["HUGGINGFACE_TOKEN"] = "valid_hf_token"

    cfg = reload_config()
    assert cfg.settings.get_provider_key("huggingface") == "valid_hf_token"
    assert cfg.settings.get_provider_key("HuggingFace") == "valid_hf_token"

def test_backward_compatibility():
    os.environ["PRIMARY_AI_PROVIDER"] = "gemini"
    os.environ["GEMINI_API_KEY"] = "valid_gemini"
    os.environ["GROQ_API_KEY"] = "valid_groq"

    cfg = reload_config()
    # Check variables exported at module-level are correct
    assert cfg.PRIMARY_AI_PROVIDER == "gemini"
    assert cfg.GEMINI_API_KEY == "valid_gemini"
    assert cfg.GROQ_API_KEY == "valid_groq"