from openai import AsyncOpenAI
from app.core.config import NVIDIA_API_KEY, NVIDIA_MODEL

MAX_MESSAGES = 32
MAX_MESSAGE_CHARS = 4000

async def call_nvidia(messages: list[dict]) -> str:
    """
    Send messages to Nvidia NIM API using the openai SDK.
    """
    client = AsyncOpenAI(
        base_url="https://integrate.api.nvidia.com/v1",
        api_key=NVIDIA_API_KEY
    )
    
    # We pass the messages array directly since it conforms to standard OpenAI chat completion schema
    response = await client.chat.completions.create(
        model=NVIDIA_MODEL,
        messages=messages,
        temperature=0.7,
        max_tokens=1024,
    )

    if not response.choices or not response.choices[0].message.content:
        raise ValueError("Nvidia returned an empty response")

    return response.choices[0].message.content
