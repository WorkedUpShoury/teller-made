# app/routers/resumes.py
from __future__ import annotations
import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, Response
from pydantic import BaseModel, Field

# CORRECTED IMPORT
from app.services.parser import parse_resume_file 
from app.services.ai_service import extract_resume_info, optimize_resume_json_with_jd
from app.normalizers import normalize_resume
from app.rendering import render_tex, compile_pdf

router = APIRouter(prefix="/resumes", tags=["Resumes"])

class ResumeOptimizationRequest(BaseModel):
    resume_json: dict = Field(...)
    jd: str = Field(...)

@router.post("/upload", status_code=200)
async def upload_and_parse_resume(file: UploadFile = File(...)):
    try:
        text = await parse_resume_file(file)
        if not text or not text.strip():
            raise ValueError("Could not extract any text from the uploaded file.")
        
        structured_json = extract_resume_info(text)
        if not isinstance(structured_json, dict) or not structured_json:
            raise ValueError("AI model did not return valid structured JSON.")
            
        structured_json['meta'] = {
            'fileName': file.filename,
            'uploadDate': datetime.datetime.now().isoformat()
        }
        
        normalized_json = normalize_resume(structured_json)
        return normalized_json
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred while processing the file.")

@router.post("/json-to-pdf")
def optimize_and_render_pdf(req: ResumeOptimizationRequest):
    try:
        optimized_json = optimize_resume_json_with_jd(req.resume_json, req.jd)
        if not isinstance(optimized_json, dict) or not optimized_json:
            raise ValueError("AI model did not return a valid optimized resume.")
            
        final_form = normalize_resume(optimized_json)
        tex_string = render_tex(final_form)
        pdf_bytes = compile_pdf(tex_string)
        
        original_name = final_form.get("meta", {}).get("fileName", "resume.pdf")
        file_name = original_name.rsplit('.', 1)[0] + "_optimized.pdf"

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{file_name}"'},
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="An unexpected error occurred while generating the PDF.")