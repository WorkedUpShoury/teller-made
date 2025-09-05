from __future__ import annotations

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Response
from app.services.resume_parser import parse_pdf
from app.services.llm_service import extract_resume_info
from ..normalizers import normalize_resume
from ..rendering import render_tex, compile_pdf

router = APIRouter(prefix="/resumes", tags=["resumes"])

@router.post("/pdf")
async def optimize_resume_pdf(
    file: UploadFile = File(...),
    jd: str = Form("")  # job description (optional for now)
):
    """
    Accept a resume file (PDF/DOC/DOCX*), extract text, convert to structured JSON via LLM,
    normalize to our schema, render LaTeX and return a compiled PDF.

    *Note: parse_pdf is PDF-focused; for DOC/DOCX support, either convert client-side
    or extend parse_pdf to handle those types with python-docx.
    """
    try:
        # 1) Extract raw text (pdfminer pipeline)
        text = await parse_pdf(file)  # your existing helper

        if not text or not text.strip():
            raise ValueError("Could not extract text from the uploaded file.")

        # 2) Convert text -> structured JSON using Gemini helper you already have
        structured = extract_resume_info(text)  # Dict[str, Any]

        if not isinstance(structured, dict) or not structured:
            raise ValueError("LLM did not return valid structured JSON.")

        # 3) Optional: use JD to tweak content (future enhancement)

        # 4) Normalize -> TeX -> PDF
        form = normalize_resume(structured)
        tex = render_tex(form)
        pdf_bytes = compile_pdf(tex)

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="optimized_resume.pdf"'},
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
