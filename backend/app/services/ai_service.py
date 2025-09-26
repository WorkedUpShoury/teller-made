import os
import json
from pathlib import Path
from typing import Any, Dict, Optional
from google import generativeai as genai
from dotenv import load_dotenv

# Securely load the API key from the .env file
load_dotenv()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    print("⚠️ GEMINI_API_KEY environment variable not set.")
    json_model = None
    chat_model = None
else:
    genai.configure(api_key=GEMINI_API_KEY)

    # --- Model for JSON Extraction (using the correct model name) ---
    json_model = genai.GenerativeModel(
        "gemini-2.5-flash",
        generation_config=genai.GenerationConfig(response_mime_type="application/json")
    )
    # --- Model for Chat (using the correct model name) ---
    chat_model = genai.GenerativeModel(
        "gemini-2.5-flash",
        system_instruction=[
            "You are a helpful and concise resume assistant.",
            "If you propose specific edits, return them as JSON Patch operations inside a ```json block."
        ]
    )

# Load JSON template
json_string: Optional[str] = None
# Assumes this script is in a subdirectory like 'app/services/'
project_root = Path(__file__).parent.parent.resolve()
json_file_path = project_root / "templates" / "json_template.json"
try:
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    json_string = json.dumps(data, indent=2)
except FileNotFoundError:
    print(f"Error: The file was not found at {json_file_path}")
except json.JSONDecodeError:
    print("Error: The file is not a valid JSON.")

def extract_resume_info(raw_text: str) -> Dict[str, Any]:
    """Extracts structured JSON from resume text using a template."""
    if not json_string or not json_model:
        raise ValueError("JSON template or Gemini model not loaded. Cannot process resume.")

    prompt = f"""
    Based on the following resume text, extract a structured JSON object.
    You MUST follow the structure defined in the JSON template provided below.

    **CRITICAL RULES:**
    1.  **Only include sections and fields if you find corresponding information in the resume text.**
    2.  **DO NOT include a section (e.g., "awards", "publications") if it is not in the text.**
    3.  **DO NOT include fields with `null` values, empty strings (`""`), or empty lists (`[]`). Omit them entirely.**

    === JSON STRUCTURE TEMPLATE ===
    {json_string}
    
    === RESUME TEXT ===
    {raw_text}
    """
    try:
        resp = json_model.generate_content(prompt)
        return json.loads(resp.text)
    except Exception as e:
        print(f"Error extracting resume info: {e}")
        return {}

def optimize_resume_json_with_jd(resume_json: Dict[str, Any], jd: str) -> Dict[str, Any]:
    """Optimizes resume JSON against a job description, maintaining the structure."""
    if not json_string or not json_model:
        raise ValueError("JSON template or Gemini model not loaded. Cannot optimize resume.")
        
    resume_text = json.dumps(resume_json, indent=2)
    prompt = f"""
    Act as an expert career coach. Rewrite the summary and experience bullets in the
    following resume JSON to better align with the provided job description.
    Return only the updated, valid JSON object.

    **CRITICAL RULE:** Maintain the exact same structure as the original resume. Do not add or remove sections.

    === JOB DESCRIPTION ===
    {jd}

    === ORIGINAL RESUME JSON ===
    {resume_text}
    """
    try:
        resp = json_model.generate_content(prompt)
        return json.loads(resp.text)
    except Exception as e:
        print(f"Error optimizing resume JSON: {e}")
        return resume_json

def generate_chat_reply(prompt: str) -> str:
    """Generates a conversational reply."""
    if not chat_model:
        return "⚠️ Gemini model not loaded."
    try:
        resp = chat_model.generate_content(prompt)
        return resp.text.strip()
    except Exception as e:
        print(f"Error generating chat reply: {e}")
        return "⚠️ Sorry, I couldn't generate a response."