# backend/app/routers/health.py
from fastapi import APIRouter
from ..models.schemas import HealthResponse # <-- Corrected import

router = APIRouter()

@router.get("/health", response_model=HealthResponse, tags=["Health"])
def health_check():
    """
    Simple health check endpoint to confirm the API is running.
    """
    return HealthResponse(status="ok")