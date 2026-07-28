import re

# Block common injection patterns
INJECTION_PATTERNS = [
    r"ignore (all )?previous instructions",
    r"system prompt",
    r"you are now",
    r"<\|im_start\|>",
]

def sanitize_prompt(user_input: str) -> str:
    # 1. Check length
    if len(user_input) > 2000:  # adjust limit
        raise ValueError("Input too long")
    
    # 2. Check for injection patterns
    for pattern in INJECTION_PATTERNS:
        if re.search(pattern, user_input, re.IGNORECASE):
            raise ValueError("Potential prompt injection detected")
    
    # 3. Escape special chars if needed
    return user_input.strip()