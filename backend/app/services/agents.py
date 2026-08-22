import re
from datetime import date, datetime, timedelta, timezone
from dateparser.search import search_dates
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..models import CalendarEvent, Conversation, FinanceEntry, Goal, MemoryItem, Task, User, WhatsAppMessage

from ..schemas import AssistantAction, AssistantResponse
from .google import gmail_messages
from .llm import LLMUnavailable, chat

# Then The creaTes a new ConversaTion daTabase objecT and adds iT To the currenT SQLAlchemy session
def _store_message(db: Session, user_id: int, role: str, content: str, agent: str) -> None:
    db.add(Conversation(user_id=user_id, role=role, content=content, agent=agent))



# sTores answers add in db reTurn respaose To fronTends
def _response(db: Session, user: User, answer: str, agent: str, action: AssistantAction | None = None):
    _store_message(db, user.id, "assistant", answer, agent)
    db.commit()
    return AssistantResponse(answer=answer, agent=agent, action=action)

# Then The finds daTe and Time from inpuTs
def _extract_future_datetime(text: str) -> tuple[datetime | None, str]:
    matches = search_dates(
        text,
        settings={
            "PREFER_DATES_FROM": "future",
            "RETURN_AS_TIMEZONE_AWARE": True,
            "TIMEZONE": "Asia/Kolkata",
        },
    )
    if not matches:
        return None, text.strip(" .")
    phrase, parsed = matches[-1]
    clean = re.sub(re.escape(phrase), "", text, flags=re.IGNORECASE).strip(" ,.-")
    return parsed, clean or text.strip(" .")

# Then The finds conTexT of inpuTs
def _life_context(db: Session, user: User) -> str:
    tasks = db.scalars(
        select(Task).where(Task.user_id == user.id, Task.status != "done").order_by(Task.due_at, Task.created_at).limit(12)
    ).all()
    goals = db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.created_at.desc()).limit(8)).all()
    memories = db.scalars(
        select(MemoryItem).where(MemoryItem.user_id == user.id).order_by(MemoryItem.pinned.desc(), MemoryItem.created_at.desc()).limit(10)
    ).all()
    events = db.scalars(
        select(CalendarEvent)
        .where(CalendarEvent.user_id == user.id, CalendarEvent.starts_at >= datetime.now(timezone.utc))
        .order_by(CalendarEvent.starts_at)
        .limit(8)
    ).all()
    return "\n".join(
        [
            "Open tasks: " + ("; ".join(f"{x.title} [{x.priority}]" for x in tasks) or "none"),
            "Goals: " + ("; ".join(f"{x.title} ({x.progress}%)" for x in goals) or "none"),
            "Upcoming events: " + ("; ".join(f"{x.title} at {x.starts_at.isoformat()}" for x in events) or "none"),
            "Saved memories: " + ("; ".join(x.content for x in memories) or "none"),
        ]
    )


async def run_assistant(message: str, db: Session, user: User) -> AssistantResponse:
    original = message.strip()
    lower = original.lower().strip()
    _store_message(db, user.id, "user", original, "router")

    # Music uses official YouTube search + IFrame playback in the browser.
    control_match = re.match(r"^(?:please\s+)?(pause|resume|continue|stop)(?:\s+(?:the\s+)?(?:music|song|track))?\s*$", lower)
    if control_match:
        command = control_match.group(1)
        if command == "continue":
            command = "resume"
        return _response(
            db, user, f"Okay, I’ll {command} the music.", "music-agent",
            AssistantAction(type="music_control", payload={"command": command}),
        )
    play_match = re.match(r"^(?:please\s+)?(?:play|listen to)\s+(.+?)(?:\s+(?:on youtube|music))?$", original, re.I)
    if play_match:
        query = play_match.group(1).strip()
        return _response(
            db, user, f"Searching YouTube for {query}.", "music-agent",
            AssistantAction(type="music_search", payload={"query": query}),
        )

    task_match = re.match(r"^(?:add|create)\s+(?:a\s+)?task(?:\s+to)?\s+(.+)$", original, re.I)
    reminder_match = re.match(r"^remind me to\s+(.+)$", original, re.I)
    if task_match or reminder_match:
        raw = (task_match or reminder_match).group(1)
        due_at, title = _extract_future_datetime(raw)
        priority = "high" if re.search(r"\b(urgent|important|high priority)\b", title, re.I) else "medium"
        title = re.sub(r"\b(urgent|important|high priority)\b", "", title, flags=re.I).strip(" ,.-")
        item = Task(user_id=user.id, title=title, due_at=due_at, priority=priority)
        db.add(item); db.flush()
        due_text = f" for {due_at.strftime('%d %b at %I:%M %p')}" if due_at else ""
        return _response(db, user, f"Task added: {title}{due_text}.", "task-agent", AssistantAction(type="refresh", payload={"resource": "tasks"}))

    complete_match = re.match(r"^(?:complete|finish|mark done)\s+(?:task\s+)?(.+)$", original, re.I)
    if complete_match:
        term = complete_match.group(1).strip()
        item = db.scalar(
            select(Task).where(Task.user_id == user.id, Task.status != "done", Task.title.ilike(f"%{term}%")).order_by(Task.created_at.desc())
        )
        if not item:
            return _response(db, user, f"I couldn’t find an open task matching “{term}”.", "task-agent")
        item.status = "done"
        return _response(db, user, f"Completed: {item.title}.", "task-agent", AssistantAction(type="refresh", payload={"resource": "tasks"}))

    memory_match = re.match(r"^(?:remember(?: that)?|save (?:this|a note)(?: that)?)\s+(.+)$", original, re.I)
    if memory_match:
        content = memory_match.group(1).strip()
        db.add(MemoryItem(user_id=user.id, content=content, tag="voice"))
        return _response(db, user, "I’ve saved that to your LifeOS memory.", "memory-agent", AssistantAction(type="refresh", payload={"resource": "memories"}))

    goal_match = re.match(r"^(?:set|add|create)\s+(?:a\s+)?goal(?:\s+to)?\s+(.+)$", original, re.I)
    if goal_match:
        target, title = _extract_future_datetime(goal_match.group(1))
        item = Goal(user_id=user.id, title=title, target_date=target.date() if target else None)
        db.add(item)
        return _response(db, user, f"Goal created: {title}.", "goal-agent", AssistantAction(type="refresh", payload={"resource": "goals"}))

    money_match = re.search(
        r"\b(spent|paid|expense|earned|received|income)\b.*?(?:₹|rs\.?|inr|\$)?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*(?:on|for|from)?\s*(.*)",
        original, re.I,
    )
    if money_match:
        verb, amount_raw, title = money_match.groups()
        kind = "income" if verb.lower() in {"earned", "received", "income"} else "expense"
        title = title.strip(" .") or ("Income" if kind == "income" else "Expense")
        currency = "USD" if "$" in original else "INR"
        item = FinanceEntry(user_id=user.id, title=title, amount=float(amount_raw), currency=currency, kind=kind, category="voice")
        db.add(item)
        return _response(db, user, f"Recorded {kind}: {currency} {float(amount_raw):.2f} for {title}.", "finance-agent", AssistantAction(type="refresh", payload={"resource": "finance"}))

    event_match = re.match(r"^(?:schedule|add event|create event)\s+(.+)$", original, re.I)
    if event_match:
        starts_at, title = _extract_future_datetime(event_match.group(1))
        if not starts_at:
            return _response(db, user, "Tell me a date or time too—for example, “schedule project review tomorrow at 4 PM”.", "calendar-agent")
        db.add(CalendarEvent(user_id=user.id, title=title, starts_at=starts_at, source="lifeos"))
        return _response(db, user, f"Scheduled {title} for {starts_at.strftime('%d %b at %I:%M %p')}.", "calendar-agent", AssistantAction(type="refresh", payload={"resource": "calendar"}))

    if any(x in lower for x in ("summarize gmail", "summarise gmail", "read my email", "read my gmail", "email summary")):
        try:
            emails = await gmail_messages(db, user, limit=8)
            if not emails:
                return _response(db, user, "Your Gmail inbox has no recent messages to summarize.", "mail-agent")
            email_text = "\n".join(f"From: {x['from']} | Subject: {x['subject']} | {x['snippet']}" for x in emails)
            answer = await chat([
                {"role": "system", "content": "Summarize these emails briefly. Highlight urgent items and actions. Never invent details."},
                {"role": "user", "content": email_text},
            ], max_tokens=500)
            return _response(db, user, answer, "mail-agent")
        except LLMUnavailable as exc:
            return _response(db, user, f"I accessed Gmail, but couldn’t generate the summary. {exc}", "mail-agent")

    if any(x in lower for x in ("summarize whatsapp", "summarise whatsapp", "whatsapp summary", "read my whatsapp")):
        messages = db.scalars(
            select(WhatsAppMessage).where(WhatsAppMessage.user_id == user.id).order_by(WhatsAppMessage.received_at.desc()).limit(30)
        ).all()
        if not messages:
            return _response(db, user, "I don’t have any authorized WhatsApp Business messages to summarize yet.", "message-agent")
        message_text = "\n".join(f"From {x.sender} at {x.received_at.isoformat()}: {x.body}" for x in reversed(messages))
        try:
            answer = await chat([
                {"role": "system", "content": "Summarize these authorized WhatsApp Business messages. Group by sender, highlight decisions and action items, and never invent details."},
                {"role": "user", "content": message_text},
            ], max_tokens=600)
        except LLMUnavailable as exc:
            return _response(db, user, f"I found the WhatsApp messages, but couldn’t summarize them. {exc}", "message-agent")
        return _response(db, user, answer, "message-agent")

    if any(x in lower for x in ("plan my day", "daily plan", "today's plan", "today plan")):
        context = _life_context(db, user)
        try:
            answer = await chat([
                {"role": "system", "content": "You are a practical daily planning agent. Create a concise time-blocked plan for today, prioritizing deadlines and including breaks. Use only the supplied facts."},
                {"role": "user", "content": context},
            ], max_tokens=650)
        except LLMUnavailable:
            tasks = db.scalars(select(Task).where(Task.user_id == user.id, Task.status != "done").limit(5)).all()
            answer = "Today’s focus:\n" + ("\n".join(f"• {i + 1}. {x.title}" for i, x in enumerate(tasks)) or "• No open tasks—add one and I’ll organize it.")
        return _response(db, user, answer, "planner-agent")

    # Everything else is genuine general question answering with the configured LLM.
    recent = db.scalars(
        select(Conversation).where(Conversation.user_id == user.id).order_by(Conversation.created_at.desc()).limit(8)
    ).all()
    history = [{"role": x.role, "content": x.content} for x in reversed(recent) if x.role in {"user", "assistant"}]
    system = (
        "You are LifeOS, a voice-first personal AI assistant. Answer the user's question accurately and directly. "
        "You may use the personal context below when relevant, but never pretend to have performed an action. "
        "Keep spoken answers clear and reasonably concise.\n\n" + _life_context(db, user)
    )
    try:
        answer = await chat([{"role": "system", "content": system}, *history], max_tokens=800)
    except LLMUnavailable as exc:
        answer = f"I can handle LifeOS commands, but general question answering needs a configured LLM key. {exc}."
    return _response(db, user, answer, "knowledge-agent")
