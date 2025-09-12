# app/routers/files.py
from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from .versions import get_user_id, _udir
from ..services.parser import parse_resume_file
from pathlib import Path
import shutil

router = APIRouter(prefix="/files", tags=["files"])

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    uid: str = Depends(get_user_id),
):
    try:
        # Decide what to do based on type. For now: save the raw file, and
        # if it's a PDF also extract text so the assistant can use it.
        saved_dir = _udir(uid) / "uploads"
        saved_dir.mkdir(parents=True, exist_ok=True)
        dest = saved_dir / (file.filename or "upload.bin")

        # persist the raw upload
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)

        extracted_text = ""
        if (file.content_type or "").lower() in {"application/pdf", "application/x-pdf"} or str(dest).lower().endswith(".pdf"):
            from pdfminer.high_level import extract_text
            extracted_text = extract_text(str(dest)) or ""

        return {
            "ok": True,
            "filename": file.filename,
            "contentType": file.content_type,
            "size": dest.stat().st_size,
            "savedPath": str(dest),
            "textPreview": extracted_text[:2000],  # small preview; keep response light
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
