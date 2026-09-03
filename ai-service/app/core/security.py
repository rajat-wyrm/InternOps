import re

INJECTION_PATTERNS = [
    r"ignore (all )?previous instructions",
    r"forget (all )?(prior|previous) (rules|prompts)",
    r"you are now in (developer|dan|jailbreak) mode",
    r"override (system|safety) settings",
    r"system prompt:",
    r"```system",
]

def sanitize_user_input(text: str, max_length: int = 2000) -> str:
    if not text or not text.strip():
        raise ValueError("Prompt text cannot be empty.")

    cleaned = text.strip()

    if len(cleaned) > max_length:
        raise ValueError("Input too long")

    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, cleaned, re.IGNORECASE):
            raise ValueError("Security Violation: Input contains forbidden system override instructions.")

    cleaned = cleaned.replace("```", "'''")
    return cleaned


def sanitize_prompt(text: str, max_length: int = 2000) -> str:
    return sanitize_user_input(text, max_length)
