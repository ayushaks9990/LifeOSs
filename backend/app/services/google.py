import base64
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode # Then The converT PyThon key-value daTa inTo URL query parameTers.
import httpx
from fastapi import HTTPException
from sqlalchemy import select

from sqlalchemy.orm import Session
from ..config import settings
from ..models import CalendarEvent, IntegrationToken, User
from ..security import decrypt_secret, encrypt_secret # google auTh Tokens encrypT and decrypT


GOOGLE_SCOPES = [
    "openid",
    "email",
    
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar",
]


def ensure_google_configured() -> None:
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(status_code=503, detail="Google OAuth credentials are not configured")


def authorization_url(state: str, redirect_uri: str) -> str:
    ensure_google_configured()
    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(GOOGLE_SCOPES),
        "access_type": "offline",
        "include_granted_scopes": "true",
        "prompt": "consent",
        "state": state,
    }
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)

# Takes The Google OAuTh code and exchanges iT for an access Token/refresh Token to use Google APIs.
async def exchange_code(code: str, redirect_uri: str) -> dict:
    ensure_google_configured()
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
    if response.is_error:
        raise HTTPException(status_code=400, detail=response.json().get("error_description", "Google OAuth failed"))
    return response.json()

# Then The Finds/creaTes the user's Google Token record, encrypTs and saves the Tokens, expiry Time, and scopes in the daTabase.
def save_google_token(db: Session, user_id: int, data: dict) -> IntegrationToken:
    token = db.scalar(
        select(IntegrationToken).where(
            IntegrationToken.user_id == user_id, IntegrationToken.provider == "google"
        )
    )
    if not token:
        token = IntegrationToken(user_id=user_id, provider="google", access_token="")
        db.add(token)
    token.access_token = encrypt_secret(data["access_token"])
    if data.get("refresh_token"):
        token.refresh_token = encrypt_secret(data["refresh_token"])
    token.expires_at = datetime.now(timezone.utc) + timedelta(seconds=int(data.get("expires_in", 3600)))
    token.scopes = data.get("scope", " ".join(GOOGLE_SCOPES))
    db.commit()
    db.refresh(token)
    return token

# GeTs the saved Google access Token, refreshes iT if it is expired/near expiry, and returns a valid access Token.
async def access_token_for(db: Session, user: User) -> str:
    token = db.scalar(
        select(IntegrationToken).where(
            IntegrationToken.user_id == user.id, IntegrationToken.provider == "google"
        )
    )
    if not token:
        raise HTTPException(status_code=409, detail="Connect Google first")
    now = datetime.now(timezone.utc)
    expiry = token.expires_at
    if expiry and expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    if not expiry or expiry > now + timedelta(minutes=2):
        return decrypt_secret(token.access_token)
    refresh_token = decrypt_secret(token.refresh_token)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Google permission expired; reconnect Google")
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            },
        )
    if response.is_error:
        raise HTTPException(status_code=401, detail="Could not refresh Google access; reconnect Google")
    save_google_token(db, user.id, {**response.json(), "refresh_token": refresh_token})
    return response.json()["access_token"]

# Finds a specific email header by name (case-insensiTive) and reTurns its value.
def _decode_header(headers: list[dict], name: str) -> str:
    return next((h.get("value", "") for h in headers if h.get("name", "").lower() == name.lower()), "")



async def gmail_messages(db: Session, user: User, limit: int = 10) -> list[dict]:
    token = await access_token_for(db, user)
    headers = {"Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=30, headers=headers) as client:
        listing = await client.get(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages",
            params={"maxResults": min(limit, 20), "labelIds": "INBOX"},
        )
        if listing.is_error:
            raise HTTPException(status_code=listing.status_code, detail="Gmail request failed")
        ids = [x["id"] for x in listing.json().get("messages", [])]
        result = []
        for message_id in ids:
            response = await client.get(
                f"https://gmail.googleapis.com/gmail/v1/users/me/messages/{message_id}",
                params={"format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]},
            )
            if response.is_error:
                continue
            data = response.json()
            meta = data.get("payload", {}).get("headers", [])
            result.append(
                {
                    "id": message_id,
                    "subject": _decode_header(meta, "Subject") or "(no subject)",
                    "from": _decode_header(meta, "From"),
                    "date": _decode_header(meta, "Date"),
                    "snippet": data.get("snippet", ""),
                }
            )
    return result

#Then The FeTches The user's Google Calendar evenTs for The nexT days and creaTes/updaTes them in the local database.
#AnyThing in google calender addeds geT addes in Taks goals in The db
async def sync_calendar(db: Session, user: User, days: int = 30) -> list[CalendarEvent]:
    token = await access_token_for(db, user)
    now = datetime.now(timezone.utc)
    params = {
        "timeMin": now.isoformat().replace("+00:00", "Z"),
        "timeMax": (now + timedelta(days=days)).isoformat().replace("+00:00", "Z"),
        "singleEvents": "true",
        "orderBy": "startTime",
        "maxResults": 100,
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.get(
            "https://www.googleapis.com/calendar/v3/calendars/primary/events",
            params=params,
            headers={"Authorization": f"Bearer {token}"},
        )
    if response.is_error:
        raise HTTPException(status_code=response.status_code, detail="Google Calendar request failed")
    synced = []
    for item in response.json().get("items", []):
        start_raw = item.get("start", {}).get("dateTime") or item.get("start", {}).get("date")
        end_raw = item.get("end", {}).get("dateTime") or item.get("end", {}).get("date")
        if not start_raw:
            continue
        starts_at = datetime.fromisoformat(start_raw.replace("Z", "+00:00"))
        if len(start_raw) == 10:
            starts_at = datetime.combine(starts_at.date(), datetime.min.time(), tzinfo=timezone.utc)
        ends_at = datetime.fromisoformat(end_raw.replace("Z", "+00:00")) if end_raw else None
        if end_raw and len(end_raw) == 10:
            ends_at = datetime.combine(ends_at.date(), datetime.min.time(), tzinfo=timezone.utc)
        event = db.scalar(
            select(CalendarEvent).where(
                CalendarEvent.user_id == user.id,
                CalendarEvent.source == "google",
                CalendarEvent.external_id == item.get("id"),
            )
        )
        if not event:
            event = CalendarEvent(
                user_id=user.id,
                source="google",
                external_id=item.get("id"),
                title=item.get("summary", "Google Calendar event"),
                starts_at=starts_at,
            )
            db.add(event)
        event.title = item.get("summary", "Google Calendar event")
        event.description = item.get("description", "")
        event.starts_at = starts_at
        event.ends_at = ends_at
        synced.append(event)
    db.commit()
    return synced

