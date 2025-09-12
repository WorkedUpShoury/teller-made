# app/services/parser.py
import os
import tempfile
import docx
from io import BytesIO
from fastapi import UploadFile, HTTPException
from pdfminer.high_level import extract_text
from pdfminer.pdfdocument import PDFTextExtractionNotAllowed

async def _parse_pdf_from_path(file_path: str) -> str:
    try:
        return extract_text(file_path) or ""
    except PDFTextExtractionNotAllowed:
        raise HTTPException(status_code=400, detail="Text extraction not allowed in this PDF.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {e}")

async def _parse_docx_from_bytes(contents: bytes) -> str:
    try:
        doc_stream = BytesIO(contents)
        doc = docx.Document(doc_stream)
        return "\n".join([p.text for p in doc.paragraphs])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process DOCX file: {e}")

async def parse_resume_file(file: UploadFile) -> str:
    """
    Parses an uploaded resume file (PDF or DOCX) and returns its text content.
    """
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    if file.content_type == "application/pdf":
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        try:
            return await _parse_pdf_from_path(tmp_path)
        finally:
            os.remove(tmp_path)
            
    elif file.content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return await _parse_docx_from_bytes(contents)
        
    elif file.content_type == "application/msword":
        raise HTTPException(status_code=400, detail="Legacy .doc files are not supported.")
        
    else:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: '{file.content_type}'.")