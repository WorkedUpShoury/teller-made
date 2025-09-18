# app/routers/resumes.py
from __future__ import annotations
import datetime
import logging
from fastapi import APIRouter, UploadFile, File, HTTPException, Response, Form
from pydantic import BaseModel, Field

# CORRECTED IMPORT
from app.services.parser import parse_resume_file
from app.services.ai_service import extract_resume_info, optimize_resume_json_with_jd
from app.normalizers import normalize_resume
from app.rendering import render_tex, compile_pdf

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/resumes", tags=["Resumes"])

class ResumeOptimizationRequest(BaseModel):
    resume_json: dict = Field(...)
    jd: str = Field(...)

@router.post("/upload-and-optimize", status_code=200)
async def upload_and_optimize_resume(file: UploadFile = File(...), jd: str = Form(...)):
    try:
        # Step 1: Parse the uploaded file
        try:
            text = await parse_resume_file(file)
            if not text or not text.strip():
                raise ValueError("Could not extract any text from the uploaded file.")
        except Exception as e:
            logger.error(f"Error parsing file: {e}")
            raise HTTPException(status_code=400, detail=f"Error parsing file: {e}")

        # Step 2: Convert the text to structured JSON
        try:
            structured_json = extract_resume_info(text)
            if not isinstance(structured_json, dict) or not structured_json:
                raise ValueError("AI model did not return valid structured JSON.")
        except Exception as e:
            logger.error(f"Error extracting resume info: {e}")
            raise HTTPException(status_code=500, detail=f"Error extracting resume info: {e}")

        # Step 3: Add metadata
        structured_json['meta'] = {
            'fileName': file.filename,
            'uploadDate': datetime.datetime.now().isoformat()
        }

        # Step 4: Optimize the resume with the job description
        try:
            optimized_json = optimize_resume_json_with_jd(structured_json, jd)
            if not isinstance(optimized_json, dict) or not optimized_json:
                raise ValueError("AI model did not return a valid optimized resume.")
        except Exception as e:
            logger.error(f"Error optimizing resume: {e}")
            raise HTTPException(status_code=500, detail=f"Error optimizing resume: {e}")

        # Step 5: Normalize and return the final JSON
        normalized_json = normalize_resume(optimized_json)
        return normalized_json

    except HTTPException:
        # Re-raise HTTPException to avoid being caught by the generic exception handler
        raise
    except Exception as e:
        logger.error(f"An unexpected error occurred: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred while processing the file.")

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