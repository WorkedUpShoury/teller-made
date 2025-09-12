import os
import tempfile
import docx  # For reading .docx files
from io import BytesIO
from fastapi import UploadFile, HTTPException
from pdfminer.high_level import extract_text
from pdfminer.pdfdocument import PDFTextExtractionNotAllowed

# Required packages:
# pip install "fastapi[all]" pdfminer.six python-docx

async def _parse_pdf_from_path(file_path: str) -> str:
    """Helper function to extract text from a PDF file path."""
    try:
        return extract_text(file_path) or ""
    except PDFTextExtractionNotAllowed:
        raise HTTPException(
            status_code=400,
            detail="Text extraction is not allowed in this PDF file."
        )
    except Exception as e:
        # Catch other potential pdfminer errors
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process PDF file: {e}"
        )

async def _parse_docx_from_bytes(contents: bytes) -> str:
    """Helper function to extract text from DOCX file bytes."""
    try:
        # python-docx can read from a file-like object in memory
        doc_stream = BytesIO(contents)
        doc = docx.Document(doc_stream)
        return "\n".join([paragraph.text for paragraph in doc.paragraphs])
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to process DOCX file: {e}"
        )

async def parse_resume_file(file: UploadFile) -> str:
    """
    Parses an uploaded resume file (PDF or DOCX) and returns its text content.
    Handles different file types and manages temporary files securely.
    """
    # Use content_type for reliable type checking
    content_type = file.content_type
    
    # Read file content into memory once
    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")

    # --- Route to the correct parser based on file type ---

    if content_type == "application/pdf":
        # pdfminer needs a file path, so we use a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(contents)
            tmp_path = tmp.name
        
        try:
            return await _parse_pdf_from_path(tmp_path)
        finally:
            # Ensure the temporary file is always cleaned up
            os.remove(tmp_path)

    elif content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        return await _parse_docx_from_bytes(contents)

    elif content_type == "application/msword":
        raise HTTPException(
            status_code=400,
            detail="Legacy .doc files are not supported. Please convert to .docx or PDF."
        )

    else:
        raise HTTPException(
            status_code=415,  # Unsupported Media Type
            detail=f"Unsupported file type: '{content_type}'. Please upload a PDF or DOCX file."
        )