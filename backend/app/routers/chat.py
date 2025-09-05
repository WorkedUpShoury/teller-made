from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.routers.versions import get_user_id
from app.services.llm_service import generate_chat_reply

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    message: str
    resume: dict | None = None  # optional context

class ChatResponse(BaseModel):
    reply: str

@router.post("/complete", response_model=ChatResponse)
def complete(req: ChatRequest, uid: str = Depends(get_user_id)):
    try:
        # Build prompt; include resume context if available
        prompt = req.message
        if req.resume:
            prompt += f"\n\nUser's current resume JSON:\n{req.resume}"

        reply = generate_chat_reply(prompt)
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
