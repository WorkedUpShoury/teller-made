# app/normalizers.py
from __future__ import annotations
from typing import Dict, Any, List
from .models import ResumeForm

def dedupe_sorted(xs: List[str]) -> List[str]:
    return sorted(list({(x or "").strip() for x in xs if (x or "").strip()}), key=str.lower)

def normalize_resume(form: Dict[str, Any]) -> Dict[str, Any]:
    """Coerce shapes, dedupe skills, ensure bullets arrays exist for bulleted sections, etc."""
    rf = ResumeForm(**form).dict()  # validates & coerces items
    # legacy flat skills cleanup
    rf["skills"] = dedupe_sorted(rf.get("skills", []))

    # bullets presence for bulleted sections
    for sec in rf.get("sections", []):
        t = sec.get("type")
        for it in sec.get("items", []):
            if t in ("experience","projects","volunteer","awards","publications","achievements","talks"):
                it["bullets"] = [b for b in (it.get("bullets") or []) if (b or "").strip()]
    return rf
