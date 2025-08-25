# app/main.py
import os
import tempfile
from fastapi import FastAPI, UploadFile, File, HTTPException, Form  # add Form
from google import generativeai as genai  # new
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from jinja2 import Environment, FileSystemLoader, select_autoescape
from weasyprint import HTML, CSS

from .services import llm_service, resume_parser
from .utils import vector_store
from app.models.schemas import ResumeInfo

app = FastAPI(
    title="AI Resume Screener API",
    description="An API to extract structured data from resumes and chat with an HR assistant.",
    version="1.0.0"
)
GENAI_KEY = os.getenv("GEMINI_API_KEY")
if not GENAI_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set in the environment.")
genai.configure(api_key=GENAI_KEY)

def optimize_resume_text(resume_text: str, job_desc: str) -> str:
    model = genai.GenerativeModel("gemini-1.5-flash-latest")
    prompt = f"""
    You are an expert resume writer. Rewrite the resume below to align with the job description.
    Keep it truthful (no invented experiences), use quantified achievements where possible,
    and keep it ATS-friendly (clean headings, bullet points).
    Return ONLY the optimized resume text (no commentary).

    === ORIGINAL RESUME ===
    {resume_text}

    === JOB DESCRIPTION ===
    {job_desc}

    === OPTIMIZED RESUME (RETURN ONLY THIS) ===
    """
    resp = model.generate_content(prompt)
    return (resp.text or "").strip()


# Static / Frontend
app.mount("/static", StaticFiles(directory="frontend"), name="static")
app.mount("/frontend", StaticFiles(directory="frontend", html=True), name="frontend")

# Jinja environment for PDF rendering
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "..", "templates")
TEMPLATES_DIR = os.path.abspath(TEMPLATES_DIR)
env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape(["html"])
)

@app.get("/")
def root():
    return FileResponse("frontend/frontend.html")

# Existing: JSON extraction endpoint (unchanged)
@app.post("/resumes/extract")
async def extract_resume_data(file: UploadFile = File(...)):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")
    try:
        raw_text = await resume_parser.parse_pdf(file)
        structured_data = llm_service.extract_resume_info(raw_text)
        resume = ResumeInfo(**structured_data)

        summary = f"""
        Candidate: {resume.first_name or 'N/A'} {resume.last_name or ''}
        Current Position: {resume.current_position or 'Unknown'}
        Experience: {resume.work_experience_summary or 'None'}
        Skills: {', '.join(resume.skills) if getattr(resume, 'skills', None) else 'None'}
        """
        vector_store.add_document(summary.strip(), metadata={"source": file.filename})
        return {"filename": file.filename, "data": resume.dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred while processing the resume: {str(e)}")

# NEW: PDF generation endpoint (uses the LLM output to produce a styled PDF)
@app.post("/resumes/pdf")
@app.post("/resumes/pdf")
async def generate_resume_pdf(
    file: UploadFile = File(...),
    jd: str = Form(...)   # ← ADD THIS
    ):
    if file.content_type != "application/pdf":
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")
    try:
        # 1) Parse + extract with your existing services
        # 1) Parse resume PDF
        raw_text = await resume_parser.parse_pdf(file)
        if not raw_text or not raw_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the resume PDF.")

        # 2) Optimize resume with the JD (Gemini)
        optimized_text = optimize_resume_text(raw_text, jd)
        if not optimized_text:
            raise HTTPException(status_code=502, detail="AI optimization failed to return content.")

        # 3) Re-extract structure from optimized text (so template/design remain the same)
        structured_data = llm_service.extract_resume_info(optimized_text)
        resume = ResumeInfo(**structured_data)
        data = resume.dict()

        # 4) Render with your existing template/CSS (same design)
        template = env.get_template("resume.html")
        html_str = template.render(resume=data)


        # 3) Build absolute paths for CSS & assets (so WeasyPrint can find them)
        css_path = os.path.join(TEMPLATES_DIR, "resume.css")
        base_url = TEMPLATES_DIR  # allows relative paths in HTML/CSS like ./assets/fonts/...

        # 4) Produce PDF bytes
        pdf_bytes = HTML(string=html_str, base_url=base_url).write_pdf(
            stylesheets=[CSS(filename=css_path)]
        )

        # 5) Stream back as a file
        suggested_name = f"{data.get('first_name','Candidate')}_{data.get('last_name','Resume')}.pdf"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
        try:
            tmp.write(pdf_bytes)
            tmp.flush()
        finally:
            tmp.close()

        return FileResponse(
            tmp.name,
            media_type="application/pdf",
            filename=suggested_name
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate resume PDF: {str(e)}")
