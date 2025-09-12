from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.routers import health, workspace, render, patch, versions, files, chat, resumes

# Enhanced metadata for auto-generated API docs
tags_metadata = [
    {"name": "Health", "description": "API health and status checks."},
    {"name": "Workspace", "description": "Operations for managing user workspaces."},
    {"name": "Rendering", "description": "Endpoints for rendering resumes to PDF and LaTeX."},
    {"name": "Resumes", "description": "Core endpoints for creating and managing resumes."},
    {"name": "Versions", "description": "Manage different versions of a resume."},
    {"name": "Files", "description": "File upload and management operations."},
    {"name": "Chat", "description": "Endpoints for the AI chat assistant."},
]

# Initialize the main FastAPI application with enhanced metadata
app = FastAPI(
    title="Smart Editor Backend",
    version="3.0.0",
    description="The backend API for the Smart Resume Editor application.",
    openapi_tags=tags_metadata
)

# --- Middleware ---
# CORS middleware is essential for allowing the frontend to communicate with the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

# --- Application Lifecycle Events ---
# Use these events to manage resources like database connections
@app.on_event("startup")
async def startup_event():
    print("Application startup: Initializing resources...")
    # Example: await database.connect()

@app.on_event("shutdown")
async def shutdown_event():
    print("Application shutdown: Cleaning up resources...")
    # Example: await database.disconnect()

# --- Global Exception Handler ---
# Catches any unhandled exceptions and returns a standardized 500 error
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # In production, you would log the exception `exc` here
    return JSONResponse(
        status_code=500,
        content={"message": "An unexpected server error occurred."},
    )

# --- API Routers ---
# Health check is mounted at the root for easy access by monitoring services
app.include_router(health.router, tags=["Health"])

# All other business logic routers are prefixed with /api
app.include_router(workspace.router, prefix="/api", tags=["Workspace"])
app.include_router(render.router, prefix="/api", tags=["Rendering"])
app.include_router(patch.router, prefix="/api", tags=["Resumes"]) # Renamed tag for clarity
app.include_router(versions.router, prefix="/api", tags=["Versions"])
app.include_router(files.router, prefix="/api", tags=["Files"])
app.include_router(chat.router, prefix="/api", tags=["Chat"])
app.include_router(resumes.router, prefix="/api", tags=["Resumes"])