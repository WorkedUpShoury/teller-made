import json
from typing import Any, Dict
from google import generativeai as genai

STRUCTURE_JSON_INSTRUCTIONS = """
Extract a structured JSON from the following resume text.

Return ONLY valid JSON (no markdown fences). Use this schema:

{
  "first_name": "...",
  "last_name": "...",
  "phone": "...",
  "email": "...",
  "city": "...",
  "region": "...",
  "linkedin": "...",
  "github": "...",
  "website": "...",
  "summary": "...",
  "education": [
    {
      "institution": "...",
      "degree": "...",
      "location": "...",
      "start_date": "...",
      "end_date": "...",
      "gpa": "...",
      "relevant_courses": ["...", "..."],
      "details": ["...", "..."]
    }
  ],
  "experience": [
    {
      "company": "...",
      "role": "...",
      "location": "...",
      "start_date": "...",
      "end_date": "...",
      "bullets": ["...", "..."],
      "technologies": ["...", "..."]
    }
  ],
  "projects": [
    {
      "name": "...",
      "tech_stack": ["...", "..."],
      "link": "...",
      "bullets": ["...", "..."]
    }
  ],
  "skills_programming": ["...", "..."],
  "skills_tools": ["...", "..."],
  "skills_databases": ["...", "..."],
  "skills_concepts": ["...", "..."],
  "certifications": [
    {
      "name": "...",
      "issuer": "...",
      "date": "...",
      "link": "...",
      "description": "..."
    }
  ]
}
"""

def extract_resume_info(raw_text: str) -> Dict[str, Any]:
    model = genai.GenerativeModel("gemini-1.5-flash-latest")
    prompt = f"""{STRUCTURE_JSON_INSTRUCTIONS}

=== RESUME TEXT ===
{raw_text}
"""
    resp = model.generate_content(prompt)
    if not resp.text:
        return {}
    # Try to parse strictly
    txt = resp.text.strip()
    # Sometimes model adds ```json fences — strip them
    if txt.startswith("```"):
        txt = txt.strip("`")
        if txt.lower().startswith("json"):
            txt = txt[4:]
    txt = txt.strip()
    try:
        return json.loads(txt)
    except Exception:
        # Best-effort fallback: attempt to repair common trailing commas etc.
        # You can add more robust JSON "repair" here if needed.
        raise
    
def generate_chat_reply(prompt: str) -> str:
    """
    Use Gemini to generate a conversational reply.
    If you want the assistant to emit JSON Patch ops, ask for them explicitly.
    """
    model = genai.GenerativeModel("gemini-1.5-flash-latest")

    # Here you can customize instructions for resume assistance.
    system_prompt = (
        "You are a resume assistant. "
        "Give helpful, concise responses. "
        "If you propose edits, return JSON Patch ops inside a fenced ```json block.\n\n"
    )

    full_prompt = system_prompt + prompt
    resp = model.generate_content(full_prompt)

    if not resp.text:
        return "⚠️ Sorry, I couldn't generate a response right now."

    return resp.text.strip()