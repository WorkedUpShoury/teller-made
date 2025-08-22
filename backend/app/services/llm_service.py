import os
import json
from dotenv import load_dotenv
# type: ignore
import google.generativeai as genai
from app.models.schemas import ResumeInfo

load_dotenv()
# type: ignore
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

model = genai.GenerativeModel("gemini-1.5-flash")  # type: ignore

def extract_resume_info(resume_text: str) -> dict:
    prompt = f"""
You are an expert HR assistant specialized in parsing resumes.

Extract the following structured information from the resume text below. Return your output strictly as a valid JSON object using this exact schema:

{{
  "first_name": string,
  "last_name": string,
  "email": string,
  "phone": string,
  "education_history": [list of strings],
  "work_experience_summary": string,
  "skills": [list of strings],
  "current_position": string,
  "years_of_experience": number
}}

Resume Text:
---
{resume_text}
---
"""

    response = model.generate_content(prompt)
    raw = response.text.strip()

    # Clean response if wrapped in markdown
    if raw.startswith("```json"):
        raw = raw[7:].strip("` \n")
    elif raw.startswith("```"):
        raw = raw[3:].strip("` \n")

    try:
        parsed = json.loads(raw)
        return ResumeInfo(**parsed).dict()
    except Exception as e:
        raise ValueError(f"Gemini response could not be parsed into schema:\n{raw}\n\nError: {e}")

def generate_chatbot_response(question: str, context_docs: list) -> str:
    context = "\n---\n".join([doc.page_content for doc in context_docs])

    prompt = f"""
You are an HR assistant helping to find the best candidates for a job role.

Based on the following candidate information, answer the question below. Be concise and helpful. If you're ranking candidates or making a recommendation, explain briefly why.

Question:
{question}

Candidate Information:
---
{context}
---
"""

    response = model.generate_content(prompt)
    return response.text.strip()
