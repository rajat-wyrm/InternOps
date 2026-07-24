import os

# Maximum AI requests allowed per minute for a user/client
RATE_LIMIT_PER_MINUTE = int(
    os.getenv("RATE_LIMIT_PER_MINUTE", "15")
)