from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..dependencies import get_current_user, get_db
from ..models import CalendarEvent, FinanceEntry, Goal, MemoryItem, Task, User
from ..schemas import (
    EventCreate,
    EventOut,
    FinanceCreate,
    FinanceOut,
    GoalCreate,
    GoalOut,
    GoalUpdate,
    MemoryCreate,
    MemoryOut,
    TaskCreate,
    TaskOut,
    TaskUpdate,
)


router = APIRouter(prefix="/api", tags=["life"])


def owned_or_404(db: Session, model, object_id: int, user_id: int):
    item = db.scalar(select(model).where(model.id == object_id, model.user_id == user_id))
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item


@router.get("/dashboard")
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    today = date.today()
    month_start = today.replace(day=1)
    tasks = db.scalars(select(Task).where(Task.user_id == user.id).order_by(Task.created_at.desc())).all()
    goals = db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.created_at.desc())).all()
    entries = db.scalars(
        select(FinanceEntry).where(FinanceEntry.user_id == user.id, FinanceEntry.occurred_on >= month_start)
    ).all()
    upcoming = db.scalars(
        select(CalendarEvent)
        .where(CalendarEvent.user_id == user.id, CalendarEvent.starts_at >= datetime.now(timezone.utc))
        .order_by(CalendarEvent.starts_at)
        .limit(5)
    ).all()
    expenses = sum(x.amount for x in entries if x.kind == "expense")
    income = sum(x.amount for x in entries if x.kind == "income")
    return {
        "task_total": len(tasks),
        "task_done": sum(x.status == "done" for x in tasks),
        "goal_count": len(goals),
        "goal_average": round(sum(x.progress for x in goals) / len(goals)) if goals else 0,
        "monthly_expense": round(expenses, 2),
        "monthly_income": round(income, 2),
        "upcoming": [EventOut.model_validate(x) for x in upcoming],
        "recent_tasks": [TaskOut.model_validate(x) for x in tasks[:5]],
    }


@router.get("/tasks", response_model=list[TaskOut])
def list_tasks(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Task).where(Task.user_id == user.id).order_by(Task.created_at.desc())).all()


@router.post("/tasks", response_model=TaskOut, status_code=201)
def add_task(payload: TaskCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = Task(user_id=user.id, **payload.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item


@router.patch("/tasks/{item_id}", response_model=TaskOut)
def update_task(item_id: int, payload: TaskUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = owned_or_404(db, Task, item_id, user.id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item


@router.delete("/tasks/{item_id}", status_code=204)
def delete_task(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(owned_or_404(db, Task, item_id, user.id)); db.commit()
    return Response(status_code=204)


@router.get("/goals", response_model=list[GoalOut])
def list_goals(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(select(Goal).where(Goal.user_id == user.id).order_by(Goal.created_at.desc())).all()


@router.post("/goals", response_model=GoalOut, status_code=201)
def add_goal(payload: GoalCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = Goal(user_id=user.id, **payload.model_dump()); db.add(item); db.commit(); db.refresh(item)
    return item


@router.patch("/goals/{item_id}", response_model=GoalOut)
def update_goal(item_id: int, payload: GoalUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = owned_or_404(db, Goal, item_id, user.id)
    for key, value in payload.model_dump(exclude_unset=True).items(): setattr(item, key, value)
    db.commit(); db.refresh(item)
    return item


@router.delete("/goals/{item_id}", status_code=204)
def delete_goal(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(owned_or_404(db, Goal, item_id, user.id)); db.commit(); return Response(status_code=204)


@router.get("/finance", response_model=list[FinanceOut])
def list_finance(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(FinanceEntry).where(FinanceEntry.user_id == user.id).order_by(FinanceEntry.occurred_on.desc())
    ).all()


@router.post("/finance", response_model=FinanceOut, status_code=201)
def add_finance(payload: FinanceCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = FinanceEntry(user_id=user.id, **payload.model_dump()); db.add(item); db.commit(); db.refresh(item)
    return item


@router.delete("/finance/{item_id}", status_code=204)
def delete_finance(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(owned_or_404(db, FinanceEntry, item_id, user.id)); db.commit(); return Response(status_code=204)


@router.get("/memories", response_model=list[MemoryOut])
def list_memories(q: str = "", user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    statement = select(MemoryItem).where(MemoryItem.user_id == user.id)
    if q.strip(): statement = statement.where(MemoryItem.content.ilike(f"%{q.strip()}%"))
    return db.scalars(statement.order_by(MemoryItem.pinned.desc(), MemoryItem.created_at.desc())).all()


@router.post("/memories", response_model=MemoryOut, status_code=201)
def add_memory(payload: MemoryCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = MemoryItem(user_id=user.id, **payload.model_dump()); db.add(item); db.commit(); db.refresh(item)
    return item


@router.delete("/memories/{item_id}", status_code=204)
def delete_memory(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(owned_or_404(db, MemoryItem, item_id, user.id)); db.commit(); return Response(status_code=204)


@router.get("/calendar", response_model=list[EventOut])
def list_events(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(CalendarEvent).where(CalendarEvent.user_id == user.id).order_by(CalendarEvent.starts_at)
    ).all()


@router.post("/calendar", response_model=EventOut, status_code=201)
def add_event(payload: EventCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.ends_at and payload.ends_at <= payload.starts_at:
        raise HTTPException(status_code=422, detail="Event end must be after its start")
    item = CalendarEvent(user_id=user.id, source="lifeos", **payload.model_dump())
    db.add(item); db.commit(); db.refresh(item)
    return item


@router.delete("/calendar/{item_id}", status_code=204)
def delete_event(item_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.delete(owned_or_404(db, CalendarEvent, item_id, user.id)); db.commit(); return Response(status_code=204)

