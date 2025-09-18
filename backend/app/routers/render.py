# backend/app/routers/render.py
from __future__ import annotations
import json
from fastapi import APIRouter, HTTPException, Response
from ..models.schemas import RenderRequest  # <-- Corrected import
from ..normalizers import normalize_resume
from ..rendering import render_tex, compile_pdf

router = APIRouter(prefix="/render", tags=["render"])

@router.post("/latex")
def render_latex(req: RenderRequest):
    try:
        # Use .model_dump() instead of the deprecated .dict()
        form = normalize_resume(req.form.model_dump())
        tex = render_tex(form)
        return Response(
            content=tex.encode("utf-8"),
            media_type="application/x-tex",
            headers={"Content-Disposition": "attachment; filename=resume.tex"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/pdf")
def render_pdf(req: RenderRequest):
    try:
        # Use .model_dump() instead of the deprecated .dict()
        form = normalize_resume(req.form.model_dump())
        tex = render_tex(form)
        pdf = compile_pdf(tex)
        return Response(
            content=pdf,
            media_type="application/pdf",
            headers={"Content-Disposition": "attachment; filename=resume.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/json")
def export_json(req: RenderRequest):
    try:
        # Use .model_dump() instead of the deprecated .dict()
        form = normalize_resume(req.form.model_dump())
        payload = json.dumps(form, ensure_ascii=False, indent=2).encode("utf-8")
        return Response(
            content=payload,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=resume.json"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))