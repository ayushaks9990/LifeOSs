from contextlib import asynccontextmanager# startup/shutdown lifecycle function

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine
from .routers import assistant, auth, data, integrations, music


@asynccontextmanager
async def lifespan(_app: FastAPI):# Life cycle FuncTions
    Base.metadata.create_all(bind=engine) # CreaTe or check DB
    yield


app = FastAPI(
    title="LifeOS API",
    version="1.0.0",
    description="Voice-first personal AI operating system backend",
    lifespan=lifespan,
)
#ConnecTs To fornTend deployed aT render by converTing iTs hTTps url To sTring
origins = [x.strip() for x in settings.allowed_origins.split(",") if x.strip()]
app.add_middleware(
    CORSMiddleware, # Takes The hTTps requesT incoming
    allow_origins=["*"] if "*" in origins else origins,
    allow_credentials=False,
    allow_methods=["*"], # which Then fronTend orgins are alloweds
    allow_headers=["*"], #  which Then check if This fronTend websiTe is allowed To comm wiTh backends
)

app.include_router(auth.router) # Take all api in auTh.py and 
app.include_router(data.router)
app.include_router(assistant.router)
app.include_router(music.router)
app.include_router(integrations.router)


@app.get("/") # When someone sTaTs The app homepage sTarTs(rooT)
def root():
    return {"name": settings.app_name, "status": "online", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
