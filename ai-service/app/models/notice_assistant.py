import json
from app.providers.llm_provider import get_llm_client # check how other models do it - ex: certificates.py
from app.schemas import NoticeAssistRequest

SYSTEM_PROMPT = """... your prompt you already have..."""

async def analyze_notice(content: str):
    client = get_llm_client()
    response = await client.chat.completions.create(
        model="gpt-4o-mini", # or gemini-1.5-flash whatever is in.env
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Notice Content: {content}"}
        ],
        response_format={"type": "json_object"},
        temperature=0.3
    )
    result = json.loads(response.choices[0].message.content)
    return result