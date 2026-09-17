import re
import unicodedata


INJECTION_PATTERNS = [
    # Attempts to discard or replace existing instructions.
    r"\b(?:ignore|disregard|forget|dismiss|override)\b.{0,80}"
    r"\b(?:all\s+)?(?:previous|prior|above|earlier|existing)\b"
    r"\s+\b(?:instructions?|rules?|prompts?)\b",

    # Paraphrased attempts to discard earlier context.
    r"\b(?:ignore|disregard|forget|dismiss)\b.{0,80}"
    r"\b(?:everything|anything|all)\b.{0,30}"
    r"\b(?:above|before|earlier|previous|prior)\b",

    # Common Hindi prompt-injection phrasing.
    r"(?:पिछले|पूर्व)\s+(?:सभी\s+)?निर्देशों?\s+(?:को\s+)?"
    r"(?:अनदेखा|भूल)\w*",

    # Attempts to assume a privileged/unrestricted mode.
    r"\b(?:you(?:'re|\s+are)|we\s+are)\b.{0,50}"
    r"\b(?:now|henceforth)\b.{0,50}"
    r"\b(?:developer|admin|dan|jailbreak|unrestricted|unfiltered|operating)\b"
    r"(?:\s+mode)?\b",

    # Direct system/safety override requests.
    r"\b(?:override|bypass|disable|ignore)\b.{0,50}"
    r"\b(?:system|safety|security)\b.{0,50}"
    r"\b(?:instructions?|rules?|settings?|guardrails?)\b",

    # Explicit prompt extraction attempts.
    r"\b(?:reveal|show|print|output|display|repeat|leak|expose)\b"
    r".{0,50}\b(?:system|hidden|secret|internal)\b"
    r".{0,50}\b(?:prompt|instructions?|message)\b",

    # Common prompt-boundary markers.
    r"<\|(?:im_start|im_end|system|assistant|user)\|>",
    r"```(?:system|assistant|developer)\b",
]


def _normalize_for_detection(text: str) -> str:
    """Normalize text so simple obfuscation cannot bypass detection."""
    normalized = unicodedata.normalize("NFKC", text)

    # Remove zero-width and other Unicode format characters.
    normalized = "".join(
        char for char in normalized
        if unicodedata.category(char) != "Cf"
    )

    # Collapse whitespace so split phrases remain detectable.
    return re.sub(r"\s+", " ", normalized).strip()


def sanitize_user_input(text: str, max_length: int = 2000) -> str:
    if not text or not text.strip():
        raise ValueError("Prompt text cannot be empty.")

    cleaned = text.strip()

    if len(cleaned) > max_length:
        raise ValueError("Input too long")

    detection_text = _normalize_for_detection(cleaned)

    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, detection_text, re.IGNORECASE | re.DOTALL):
            raise ValueError(
                "Security Violation: Input contains forbidden system override instructions."
            )

    # Preserve the existing boundary-marker neutralization.
    cleaned = cleaned.replace("```", "'''")
    return cleaned


def sanitize_prompt(text: str, max_length: int = 2000) -> str:
    return sanitize_user_input(text, max_length)
