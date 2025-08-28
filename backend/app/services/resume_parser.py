import os, tempfile
from pdfminer.high_level import extract_text
from fastapi import UploadFile

async def parse_pdf(file: UploadFile) -> str:
    # Save to a temp file because pdfminer needs a file path
    suffix = os.path.splitext(file.filename or "")[-1] or ".pdf"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp.flush()
        tmp_path = tmp.name
    try:
        text = extract_text(tmp_path)
        return text or ""
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass
