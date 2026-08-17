from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db
from ..models import User
from ..schemas import AssistantRequest, AssistantResponse
from ..services.agents import run_assistant


router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.post("/chat", response_model=AssistantResponse)
async def assistant_chat(payload: AssistantRequest, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await run_assistant(payload.message, db, user)

