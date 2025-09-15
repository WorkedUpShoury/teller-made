from __future__ import annotations
import json
from fastapi import APIRouter, HTTPException, Response, Depends
from ..models import RenderRequest
from ..normalizers import normalize_resume
from ..rendering import render_tex, compile_pdf

router = APIRouter(prefix="/render", tags=["render"])

@router.post("/latex")
def render_latex(req: RenderRequest):
    try:
        form = normalize_resume(req.form.dict())
        tex = render_tex(form)
        return Response(content=tex.encode("utf-8"),
                        media_type="application/x-tex",
                        headers={"Content-Disposition":"attachment; filename=resume.tex"})
    except Exception as e:
        raise HTTPException(500, str(e))

@router.post("/pdf")
def render_pdf(req: RenderRequest):
    form = normalize_resume(req.form.dict())
    tex = render_tex(form)
    pdf = compile_pdf(tex)
    return Response(content=pdf, media_type="application/pdf",
                    headers={"Content-Disposition":"attachment; filename=resume.pdf"})

@router.post("/json")
def export_json(req: RenderRequest):
    form = normalize_resume(req.form.dict())
    payload = json.dumps(form, ensure_ascii=False, indent=2).encode("utf-8")
    return Response(content=payload, media_type="application/json",
                    headers={"Content-Disposition":"attachment; filename=resume.json"})