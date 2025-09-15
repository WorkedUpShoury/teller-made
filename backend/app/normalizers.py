# app/normalizers.py
from __future__ import annotations
from typing import Dict, Any, List
from .models import ResumeForm

def dedupe_sorted(xs: List[str]) -> List[str]:
    return sorted(list({(x or "").strip() for x in xs if (x or "").strip()}), key=str.lower)

def normalize_resume(form: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce shapes, dedupe skills, ensure bullets arrays exist for bulleted sections, etc."""
    
    # Check if the skills field is a dictionary and flatten it before validation
    skills_input = form.get("skills", [])
    if isinstance(skills_input, dict):
        all_skills = []
        for v in skills_input.values():
            if isinstance(v, list):
                all_skills.extend(v)
            elif isinstance(v, str):
                all_skills.append(v)
        form["skills"] = all_skills
    # No else block needed as the rest of the function handles both old and new formats.
    
    # Pydantic validation and coercion can now proceed with a list
    rf = ResumeForm(**form).dict()
    rf["skills"] = dedupe_sorted(rf.get("skills", []))
    
    # bullets presence for bulleted sections
    for sec in rf.get("sections", []):
        t = sec.get("type")
        for it in sec.get("items", []):
            if t in ("experience","projects","volunteer","awards","publications","achievements","talks"):
                it["bullets"] = [b for b in (it.get("bullets") or []) if (b or "").strip()]
    return rf