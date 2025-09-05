# app/routers/files.py
from __future__ import annotations

from fastapi import APIRouter, Depends, File, UploadFile, HTTPException
from .versions import get_user_id, _udir
from ..services.resume_parser import parse_pdf
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
            # re-open a fresh UploadFile stream for parse_pdf if needed
            # parse_pdf expects UploadFile, but we can just return text from saved path
            # quick reuse: wrap the path as UploadFile-like by re-reading
            # simpler: call pdfminer directly via the helper
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
