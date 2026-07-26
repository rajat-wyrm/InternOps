from fastapi import Request, HTTPException, APIRouter
from app.core.security import sanitize_prompt

router = APIRouter() # <-- THIS LINE WAS MISSING

@router.post("/generate")
async def generate(request: Request):
    try:
        data = await request.json()
        clean_input = sanitize_prompt(data.get("user_input"))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    response = {"clean_input": clean_input, "status": "guardrail passed"}
    return response