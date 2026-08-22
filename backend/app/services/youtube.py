import httpx
from ..config import settings
from ..schemas import YouTubeTrack
class YouTubeError(RuntimeError):
    pass


async def search_tracks(query: str, limit: int = 6) -> list[YouTubeTrack]:
    if not settings.youtube_api_key:
        raise YouTubeError("YOUTUBE_API_KEY is not configured on the backend")
    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "videoCategoryId": "10",
        "videoEmbeddable": "true",
        
        "safeSearch": "moderate",
        "maxResults": min(max(limit, 1), 12),
        "regionCode": settings.youtube_region,
        "key": settings.youtube_api_key,
    }
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get("https://www.googleapis.com/youtube/v3/search", params=params)
            response.raise_for_status()
            items = response.json().get("items", [])
    except (httpx.HTTPError, ValueError) as exc:
        detail = str(exc)
        if isinstance(exc, httpx.HTTPStatusError):
            try:
                detail = exc.response.json()["error"]["message"]
            except (ValueError, KeyError):
                pass
        raise YouTubeError(f"YouTube search failed: {detail}") from exc

    tracks = []
    for item in items:
        video_id = item.get("id", {}).get("videoId")
        snippet = item.get("snippet", {})
        if not video_id:
            continue
        thumbs = snippet.get("thumbnails", {})
        thumb = (thumbs.get("medium") or thumbs.get("default") or {}).get("url", "")
        tracks.append(
            YouTubeTrack(
                video_id=video_id,
                title=snippet.get("title", "Untitled").replace("&amp;", "&"),
                channel=snippet.get("channelTitle", "YouTube"),
                thumbnail=thumb,
            )
        )
    if not tracks:
        raise YouTubeError("No playable YouTube videos matched that search")
   
    return tracks
