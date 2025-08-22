import os
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .services import llm_service, resume_parser
from .utils import vector_store
from app.models.schemas import ResumeInfo

app = FastAPI(
    title="AI Resume Screener API",
    description="An API to extract structured data from resumes and chat with an HR assistant.",
    version="1.0.0"
)

# Serve static files (style.css, script.js) from /static
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Serve the main frontend HTML page
@app.get("/")
def read_index():
    return FileResponse("frontend/frontend.html")

# Resume upload + extraction
@app.post("/resumes/extract")
async def extract_resume_data(file: UploadFile = File(...)):
    if file.content_type != 'application/pdf':
        raise HTTPException(status_code=400, detail="Invalid file type. Please upload a PDF.")

    try:
        raw_text = await resume_parser.parse_pdf(file)
        structured_data = llm_service.extract_resume_info(raw_text)
        resume = ResumeInfo(**structured_data)

        summary = f"""
        Candidate: {resume.first_name or 'N/A'} {resume.last_name or ''}
        Current Position: {resume.current_position or 'Unknown'}
        Experience: {resume.work_experience_summary or 'None'}
        Skills: {', '.join(resume.skills) if resume.skills else 'None'}
        """

        vector_store.add_document(summary.strip(), metadata={"source": file.filename})
        return {"filename": file.filename, "data": resume.dict()}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred while processing the resume: {str(e)}")

# Chatbot query endpoint
@app.get("/chatbot/query")
async def query_chatbot(question: str):
    try:
        relevant_docs = vector_store.search_documents(question)
        answer = llm_service.generate_chatbot_response(question, relevant_docs)
        return {"question": question, "answer": answer}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"An error occurred during chatbot query: {str(e)}")
app.mount("/frontend", StaticFiles(directory="frontend", html=True), name="frontend")

@app.get("/")
def root():
    return FileResponse("frontend/frontend.html")
