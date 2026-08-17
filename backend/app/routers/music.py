from fastapi import APIRouter, Depends, HTTPException, Query

from ..dependencies import get_current_user
from ..models import User
from ..schemas import YouTubeTrack
from ..services.youtube import YouTubeError, search_tracks


router = APIRouter(prefix="/api/music", tags=["music"])


@router.get("/search", response_model=list[YouTubeTrack])
async def search_music(q: str = Query(min_length=1, max_length=200), _user: User = Depends(get_current_user)):
    try:
        return await search_tracks(q)
    except YouTubeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

