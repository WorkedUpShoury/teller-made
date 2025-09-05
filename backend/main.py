from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import health, workspace, render, patch, versions, files, chat, resumes

app = FastAPI(title="Smart Editor Backend", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

api = APIRouter(prefix="/api")
api.include_router(health.router)      # /api/health
api.include_router(workspace.router)   # /api/workspace/*
api.include_router(render.router)      # /api/render/*
api.include_router(patch.router)       # /api/resume/*
api.include_router(versions.router)    # /api/versions/*
api.include_router(files.router)       # /api/files/*
api.include_router(chat.router)        # /api/chat/*   <-- chat mounted
api.include_router(resumes.router)  
app.include_router(api)
