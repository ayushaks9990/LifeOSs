import hashlib
import hmac
import json
from datetime import datetime, timezone
import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response

from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..config import settings
from ..dependencies import get_current_user, get_db
from ..models import IntegrationToken, User, WhatsAppMessage
from ..security import create_oauth_state, encrypt_secret, read_oauth_state
from ..services.google import (

    authorization_url,
    exchange_code,
    gmail_messages,
    save_google_token,
    sync_calendar,
)
#This Then file handles exTernal inTegraTions
from ..services.llm import LLMUnavailable, chat


router = APIRouter(prefix="/api/integrations", tags=["integrations"])

# Finds The public url where my backend is runnings
def _public_base(request: Request) -> str:
    proto = request.headers.get("x-forwarded-proto", request.url.scheme).split(",")[0].strip()# ProTocols hTTps of hTTp
    host = request.headers.get("x-forwarded-host", request.headers.get("host", request.url.netloc)).split(",")[0].strip() #hosT or domain name
    return f"{proto}://{host}"

#After the user logs in with Google, send them back here. https://lifeos-api.onrender.com/api/integrations/google/callback 
def _google_redirect_uri(request: Request) -> str:
    return settings.google_redirect_uri or f"{_public_base(request)}/api/integrations/google/callback"


@router.get("/status")
def integration_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    providers = set(db.scalars(select(IntegrationToken.provider).where(IntegrationToken.user_id == user.id)).all())
    return {
        "google": "google" in providers,
        "whatsapp": "whatsapp" in providers,
        "youtube": bool(settings.youtube_api_key),
        "llm": bool(settings.llm_api_key),
    }


@router.get("/google/connect")
def connect_google(request: Request, user: User = Depends(get_current_user)):
    state = create_oauth_state(user.id)
    return {"authorization_url": authorization_url(state, _google_redirect_uri(request))}


@router.get("/google/callback", include_in_schema=False)
async def google_callback(request: Request, code: str = "", state: str = "", error: str = "", db: Session = Depends(get_db)):
    if error:
        return RedirectResponse(url=f"/?integration_error={error}")
    try:
        user_id = read_oauth_state(state)
        data = await exchange_code(code, _google_redirect_uri(request))
        save_google_token(db, user_id, data)
    except (jwt.InvalidTokenError, ValueError, HTTPException) as exc:
        detail = exc.detail if isinstance(exc, HTTPException) else str(exc)
        return RedirectResponse(url=f"/?integration_error={detail}")
    return RedirectResponse(url="/?google=connected")


@router.delete("/google", status_code=204)
def disconnect_google(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.scalar(select(IntegrationToken).where(IntegrationToken.user_id == user.id, IntegrationToken.provider == "google"))
    if item:
        db.delete(item); db.commit()
    return Response(status_code=204)


@router.get("/gmail/messages")
async def recent_gmail(limit: int = Query(10, ge=1, le=20), user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return await gmail_messages(db, user, limit)


@router.get("/gmail/summary")
async def gmail_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = await gmail_messages(db, user, 10)
    if not messages:
        return {"summary": "No recent inbox messages."}
    text = "\n".join(f"From: {m['from']} | Subject: {m['subject']} | {m['snippet']}" for m in messages)
    try:
        summary = await chat([
            {"role": "system", "content": "Summarize these emails in bullets. Highlight urgent items and requested actions. Do not invent facts."},
            {"role": "user", "content": text},
        ], max_tokens=600)
    except LLMUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"summary": summary, "count": len(messages)}


@router.post("/calendar/sync")
async def google_calendar_sync(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    events = await sync_calendar(db, user)
    return {"synced": len(events)}


class WhatsAppConnect(BaseModel):
    phone_number_id: str = Field(min_length=3, max_length=100)
    access_token: str = Field(min_length=10)


@router.post("/whatsapp/connect")
def connect_whatsapp(payload: WhatsAppConnect, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.scalar(select(IntegrationToken).where(IntegrationToken.user_id == user.id, IntegrationToken.provider == "whatsapp"))
    if not item:
        item = IntegrationToken(user_id=user.id, provider="whatsapp", access_token="")
        db.add(item)
    item.access_token = encrypt_secret(payload.access_token)
    item.scopes = payload.phone_number_id
    db.commit()
    return {"connected": True, "webhook_url": "/api/integrations/whatsapp/webhook"}


@router.get("/whatsapp/messages")
def whatsapp_messages(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(WhatsAppMessage).where(WhatsAppMessage.user_id == user.id).order_by(WhatsAppMessage.received_at.desc()).limit(50)
    ).all()


@router.get("/whatsapp/summary")
async def whatsapp_summary(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    messages = db.scalars(
        select(WhatsAppMessage).where(WhatsAppMessage.user_id == user.id).order_by(WhatsAppMessage.received_at.desc()).limit(30)
    ).all()
    if not messages:
        return {"summary": "No authorized WhatsApp Business messages have arrived yet.", "count": 0}
    text = "\n".join(f"From {m.sender} at {m.received_at.isoformat()}: {m.body}" for m in reversed(messages))
    try:
        summary = await chat([
            {"role": "system", "content": "Summarize these WhatsApp Business messages by sender. Highlight decisions and action items. Do not invent facts."},
            {"role": "user", "content": text},
        ], max_tokens=600)
    except LLMUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return {"summary": summary, "count": len(messages)}


@router.get("/whatsapp/webhook", include_in_schema=False)
def verify_whatsapp_webhook(
    hub_mode: str = Query("", alias="hub.mode"),
    hub_verify_token: str = Query("", alias="hub.verify_token"),
    hub_challenge: str = Query("", alias="hub.challenge"),
):
    if hub_mode == "subscribe" and settings.whatsapp_verify_token and hmac.compare_digest(hub_verify_token, settings.whatsapp_verify_token):
        return Response(content=hub_challenge, media_type="text/plain")
    raise HTTPException(status_code=403, detail="Webhook verification failed")


@router.post("/whatsapp/webhook", include_in_schema=False)
async def receive_whatsapp_webhook(request: Request, db: Session = Depends(get_db)):
    raw = await request.body()
    signature = request.headers.get("x-hub-signature-256", "")
    if settings.whatsapp_app_secret:
        expected = "sha256=" + hmac.new(settings.whatsapp_app_secret.encode(), raw, hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    try:
        body = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid webhook JSON") from exc
    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            phone_id = value.get("metadata", {}).get("phone_number_id", "")
            integration = db.scalar(
                select(IntegrationToken).where(IntegrationToken.provider == "whatsapp", IntegrationToken.scopes == phone_id)
            )
            if not integration:
                continue
            for message in value.get("messages", []):
                if message.get("type") != "text":
                    continue
                external_id = message.get("id")
                if not external_id or db.scalar(select(WhatsAppMessage).where(WhatsAppMessage.external_id == external_id)):
                    continue
                timestamp = datetime.fromtimestamp(int(message.get("timestamp", 0)), tz=timezone.utc)
                db.add(WhatsAppMessage(
                    user_id=integration.user_id,
                    external_id=external_id,
                    sender=message.get("from", "unknown"),
                    body=message.get("text", {}).get("body", ""),
                    received_at=timestamp,
                ))
    db.commit()
    return {"received": True}
