from datetime import date, datetime
from typing import Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field
class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(ORMModel):
    id: int
    email: EmailStr
    full_name: str


class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RegisterRequest(AuthRequest):
    full_name: str = Field(min_length=2, max_length=120)


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    description: str = ""
    priority: Literal["low", "medium", "high"] = "medium"
    due_at: datetime | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    priority: Literal["low", "medium", "high"] | None = None
    status: Literal["todo", "doing", "done"] | None = None
    due_at: datetime | None = None


class TaskOut(TaskCreate, ORMModel):
    id: int
    status: str
    created_at: datetime


class GoalCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    description: str = ""
    progress: int = Field(default=0, ge=0, le=100)
    target_date: date | None = None


class GoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    target_date: date | None = None


class GoalOut(GoalCreate, ORMModel):
    id: int
    created_at: datetime


class FinanceCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    amount: float = Field(gt=0)
    currency: str = "INR"
    category: str = "other"
    kind: Literal["expense", "income"] = "expense"
    occurred_on: date = Field(default_factory=date.today)


class FinanceOut(FinanceCreate, ORMModel):
    id: int
    created_at: datetime


class MemoryCreate(BaseModel):
    content: str = Field(min_length=1)
    tag: str = "general"
    pinned: bool = False


class MemoryOut(MemoryCreate, ORMModel):
    id: int
    created_at: datetime


class EventCreate(BaseModel):
    title: str = Field(min_length=1, max_length=240)
    description: str = ""
    starts_at: datetime
    ends_at: datetime | None = None


class EventOut(EventCreate, ORMModel):
    id: int
    source: str
    external_id: str | None = None
    created_at: datetime


class AssistantRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)


class AssistantAction(BaseModel):
    type: str
    payload: dict = Field(default_factory=dict)


class AssistantResponse(BaseModel):
    answer: str
    agent: str
    action: AssistantAction | None = None


class YouTubeTrack(BaseModel):
    video_id: str
    title: str
    channel: str
    thumbnail: str

