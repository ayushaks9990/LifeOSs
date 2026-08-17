from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class OwnedMixin:
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Task(OwnedMixin, Base):
    __tablename__ = "tasks"
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(30), default="todo")
    priority: Mapped[str] = mapped_column(String(20), default="medium")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Goal(OwnedMixin, Base):
    __tablename__ = "goals"
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text, default="")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    target_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class FinanceEntry(OwnedMixin, Base):
    __tablename__ = "finance_entries"
    title: Mapped[str] = mapped_column(String(200))
    amount: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="INR")
    category: Mapped[str] = mapped_column(String(60), default="other")
    kind: Mapped[str] = mapped_column(String(20), default="expense")
    occurred_on: Mapped[date] = mapped_column(Date, default=date.today)


class MemoryItem(OwnedMixin, Base):
    __tablename__ = "memories"
    content: Mapped[str] = mapped_column(Text)
    tag: Mapped[str] = mapped_column(String(60), default="general")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)


class CalendarEvent(OwnedMixin, Base):
    __tablename__ = "calendar_events"
    title: Mapped[str] = mapped_column(String(240))
    description: Mapped[str] = mapped_column(Text, default="")
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    source: Mapped[str] = mapped_column(String(30), default="lifeos")
    external_id: Mapped[str | None] = mapped_column(String(300), nullable=True)


class Conversation(OwnedMixin, Base):
    __tablename__ = "conversations"
    role: Mapped[str] = mapped_column(String(20))
    content: Mapped[str] = mapped_column(Text)
    agent: Mapped[str] = mapped_column(String(40), default="assistant")


class IntegrationToken(OwnedMixin, Base):
    __tablename__ = "integration_tokens"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_user_provider"),)
    provider: Mapped[str] = mapped_column(String(30))
    access_token: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str] = mapped_column(Text, default="")
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    scopes: Mapped[str] = mapped_column(Text, default="")


class WhatsAppMessage(OwnedMixin, Base):
    __tablename__ = "whatsapp_messages"
    __table_args__ = (UniqueConstraint("external_id", name="uq_whatsapp_external_id"),)
    external_id: Mapped[str] = mapped_column(String(200))
    sender: Mapped[str] = mapped_column(String(80))
    body: Mapped[str] = mapped_column(Text)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

