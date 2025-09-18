# app/normalizers.py
from __future__ import annotations
from typing import Dict, Any, List
from .models.schemas import ResumeForm

def dedupe_sorted(xs: List[str]) -> List[str]:
    """Sorts and removes duplicate strings from a list."""
    if not isinstance(xs, list):
        return []
    return sorted(list({(x or "").strip() for x in xs if (x or "").strip()}), key=str.lower)

def normalize_resume(form: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce shapes, dedupe skills, and handle variations in the AI's output."""
    
    # --- NEW: Ensure top-level string fields are not null ---
    # This prevents validation errors if the AI omits an optional field.
    for key in ["fullName", "title", "email", "phone", "location", "summary"]:
        if form.get(key) is None:
            form[key] = ""

    # --- Fix the 'profiles' field format ---
    profiles_input = form.get("profiles", [])
    if isinstance(profiles_input, list):
        coerced_profiles = []
        for item in profiles_input:
            if isinstance(item, str):
                # If the AI returns a string, convert it to the correct object structure
                coerced_profiles.append({"label": "Link", "url": item})
            elif isinstance(item, dict):
                # If it's already an object, keep it as is
                coerced_profiles.append(item)
        form["profiles"] = coerced_profiles
    
    # Flatten the skills field if it's a dictionary
    skills_input = form.get("skills", [])
    if isinstance(skills_input, dict):
        all_skills = []
        for v in skills_input.values():
            if isinstance(v, list):
                all_skills.extend(v)
            elif isinstance(v, str):
                all_skills.append(v)
        form["skills"] = all_skills
    
    # Pydantic validation can now proceed safely
    rf = ResumeForm(**form).model_dump()
    rf["skills"] = dedupe_sorted(rf.get("skills", []))
    
    # Ensure 'bullets' arrays exist for bulleted sections
    for sec in rf.get("sections", []):
        t = sec.get("type")
        for it in sec.get("items", []):
            if t in ("experience", "projects", "volunteer", "awards", "publications", "achievements", "talks"):
                if "bullets" not in it or not isinstance(it["bullets"], list):
                    it["bullets"] = []
                else:
                    it["bullets"] = [b for b in it["bullets"] if (b or "").strip()]
    return rf