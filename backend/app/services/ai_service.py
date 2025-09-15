# app/services/ai_service.py
import os
import json
from pathlib import Path
from typing import Any, Dict
from google import generativeai as genai

# Configure API Key once
try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
except KeyError:
    print("⚠️ GEMINI_API_KEY environment variable not set.")

try:
    project_root = Path(__file__).parent.parent.parent
    json_file_path = project_root / "json_template.json"
    with open(json_file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    json_string = json.dumps(data, indent=2)
except FileNotFoundError:
    print(f"Error: The file was not found at {json_file_path}")
except json.JSONDecodeError:
    print("Error: The file is not a valid JSON.")

# --- Model for JSON Extraction ---
json_model = genai.GenerativeModel(
    "gemini-1.5-flash-latest",
    generation_config=genai.GenerationConfig(response_mime_type="application/json")
)

# --- Model for Chat ---
chat_model = genai.GenerativeModel(
    "gemini-1.5-flash-latest",
    system_instruction=[
        "You are a helpful and concise resume assistant.",
        "If you propose specific edits, return them as JSON Patch operations inside a ```json block."
    ]
)
def load_json_content_as_string() -> str | None:
    """
    Finds and loads the 'json_template.json' file from the project root,
    returning its content as a formatted string.
    """

    
def extract_resume_info(raw_text: str) -> Dict[str, Any]:
    """Extracts structured JSON from resume text."""
    prompt = f"""
    Based on the following resume text, extract a structured JSON object.
    Use this format: {json_string}
    
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
    """Optimizes resume JSON against a job description."""
    resume_text = json.dumps(resume_json, indent=2)
    prompt = f"""
    Act as an expert career coach. Rewrite the summary and experience bullets in the
    following resume JSON to better align with the provided job description.
    Return only the updated, valid JSON object with the exact same structure.

    === JOB DESCRIPTION ===
    {jd}

    === ORIGINAL RESUME JSON ===
    {resume_text}

    === JSON STRUCTURE ===
    {json_string}
    """
    try:
        resp = json_model.generate_content(prompt)
        return json.loads(resp.text)
    except Exception as e:
        print(f"Error optimizing resume JSON: {e}")
        return resume_json

def generate_chat_reply(prompt: str) -> str:
    """Generates a conversational reply."""
    try:
        resp = chat_model.generate_content(prompt)
        return resp.text.strip()
    except Exception as e:
        print(f"Error generating chat reply: {e}")
        return "⚠️ Sorry, I couldn't generate a response."