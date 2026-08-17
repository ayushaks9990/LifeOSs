from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import assistant, auth, data, integrations, music


@asynccontextmanager
async def lifespan(_app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="LifeOS API",
    version="1.0.0",
    description="Voice-first personal AI operating system backend",
    lifespan=lifespan,
)

origins = [x.strip() for x in settings.allowed_origins.split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if "*" in origins else origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(data.router)
app.include_router(assistant.router)
app.include_router(music.router)
app.include_router(integrations.router)


@app.get("/")
def root():
    return {"name": settings.app_name, "status": "online", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
