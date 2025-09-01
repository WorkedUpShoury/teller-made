import os, tempfile, subprocess, io, re, json
from typing import Optional, List, Dict, Any, Tuple

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from google import generativeai as genai
from jinja2 import Environment, FileSystemLoader, select_autoescape, TemplateSyntaxError

# Your own modules
from app.models.schemas import ResumeInfo
from app.services import resume_parser, llm_service

app = FastAPI(title="AI Resume (LaTeX) API", version="1.7.0")

# ---------------------------
# CORS for local development
# ---------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# ---------------------------
# Gemini API key
# ---------------------------
GENAI_KEY = os.getenv("GEMINI_API_KEY")
if not GENAI_KEY:
    raise RuntimeError("GEMINI_API_KEY is not set")
genai.configure(api_key=GENAI_KEY)

# ---------------------------
# Jinja2 with LaTeX-safe delimiters
# ---------------------------
TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")
env = Environment(
    loader=FileSystemLoader(TEMPLATES_DIR),
    autoescape=select_autoescape([]),
    trim_blocks=True,
    lstrip_blocks=True,
    variable_start_string="[[",
    variable_end_string="]]",
    block_start_string="(%",
    block_end_string="%)",
    comment_start_string="(#",
    comment_end_string="#)",
)

# ---------------------------
# Safe LaTeX escaping filter
# ---------------------------
LATEX_REPLACEMENTS = {
    "\\": r"\textbackslash{}",
    "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#",
    "_": r"\_", "{": r"\{", "}": r"\}",
    "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
}
def latex_escape(s: Optional[str]) -> str:
    if not s:
        return ""
    out = []
    for ch in s:
        out.append(LATEX_REPLACEMENTS.get(ch, ch))
    return "".join(out).replace("\n", r"\\ ")
env.filters["tex"] = latex_escape

# ---------------------------
# Adaptive sizing knobs
# ---------------------------
# Default section caps (trim path / long resumes)
MAX_EXP_DEFAULT = 3
MAX_PROJ_DEFAULT = 2
MAX_EDU_DEFAULT = 2
MAX_BULLETS_EXP_DEFAULT = 2   # when crowded
MAX_BULLETS_PROJ_DEFAULT = 2
MAX_CERTS_DEFAULT = 6
MAX_PUBLICATIONS_DEFAULT = 4
MAX_SKILLS_DEFAULT = 12

# Expansion targets (short resumes)
SPARSE_TARGET_BULLETS_EXP = 4
SPARSE_TARGET_BULLETS_PROJ = 4
SPARSE_MAX_NEW_PROJECTS = 2
SPARSE_MAX_NEW_EXPERIENCES = 1

# Content bands (tuned for 10pt article with compact spacing)
SHORT_MAX = 1650   # <— treat as short -> top up to 4 bullets
LONG_MIN  = 2900   # >— treat as long  -> cap at 2 bullets
MIN_BULLETS_MID = 3

# ---------------------------
# Text safety helpers
# ---------------------------
def ensure_text(x: Any) -> str:
    if x is None:
        return ""
    if isinstance(x, bytes):
        try:
            return x.decode("utf-8", "ignore")
        except Exception:
            return str(x)
    if not isinstance(x, str):
        return str(x)
    return x

def limit_bullets(items: Optional[List[Any]], max_n: int) -> List[str]:
    if not items:
        return []
    out: List[str] = []
    for b in items:
        s = ensure_text(b).strip()
        if s:
            out.append(s)
        if len(out) >= max_n:
            break
    return out

def shorten_text(t: Optional[Any], max_chars: int = 280) -> str:
    s = ensure_text(t)
    s = re.sub(r"\s+", " ", s).strip()
    return s if len(s) <= max_chars else (s[:max_chars - 1].rstrip() + "…")

def _clean_none(x: Any) -> str:
    s = ensure_text(x)
    return "" if s.strip().lower() in {"none", "null", "n/a", "-", "—"} else s.strip()

# ---------------------------
# Normalizers & injectors
# ---------------------------
def normalize_cert_item(x: Any) -> Dict[str, Any]:
    """
    Accept strings like:
      'Name | Issuer | 2024 | https://... | desc'
      'Name — Issuer — 2024'
    Or dicts with {name, issuer, date, link, description}.
    """
    if isinstance(x, dict):
        return {
            "name": _clean_none(x.get("name", "")),
            "issuer": _clean_none(x.get("issuer", "")),
            "date": _clean_none(x.get("date", "")),
            "link": _clean_none(x.get("link", "")),
            "description": shorten_text(_clean_none(x.get("description", "")), 160),
        }

    raw = ensure_text(x).strip()
    if not raw:
        return {"name": ""}

    parts: Optional[List[str]] = None
    for sep in ["|", "•", " - ", " — ", "–", ","]:
        if sep in raw:
            parts = [ensure_text(p).strip() for p in raw.split(sep) if ensure_text(p).strip()]
            break
    if parts is None:
        parts = [raw]

    name = parts[0] if parts else raw
    issuer, date, link, desc = "", "", "", ""
    for p in parts[1:]:
        ptxt = ensure_text(p)
        if not date:
            m_year = re.search(r"\b(20\d{2}|19\d{2})\b", ptxt)
            if m_year is not None:
                date = m_year.group(1)
                continue
        if not link and re.match(r"https?://", ptxt, re.I):
            link = ptxt
            continue
        if not issuer and not any(k in ptxt.lower() for k in ["https://", "http://"]):
            issuer = ptxt
            continue
        desc = (desc + "; " + ptxt).strip("; ")
    return {
        "name": _clean_none(name),
        "issuer": _clean_none(issuer),
        "date": _clean_none(date),
        "link": _clean_none(link),
        "description": shorten_text(_clean_none(desc), 160),
    }

def _normalize_dates(items: Any):
    if not isinstance(items, list):
        return
    for e in items or []:
        if isinstance(e, dict):
            sd = ensure_text(e.get("start_date")).strip()
            ed = ensure_text(e.get("end_date")).strip()
            if sd and not ed:
                e["end_date"] = "Present"

def _inject_links_if_missing(data: dict, raw_text: Any) -> dict:
    text = ensure_text(raw_text)
    links = list(data.get("links") or [])

    def add(label: str, url: Optional[str]) -> None:
        u = ensure_text(url)
        if not u:
            return
        if not any(l.get("url") == u for l in links):
            links.append({"label": label, "url": u})

    if (linkedin_match := re.search(r'(https?://(?:www\.)?linkedin\.com/[^\s\)\]]+)', text, re.I)):
        add("LinkedIn", linkedin_match.group(1))
    if (github_match := re.search(r'(https?://(?:www\.)?github\.com/[^\s\)\]]+)', text, re.I)):
        add("GitHub", github_match.group(1))

    data["links"] = links
    return data

def _inject_location_if_missing(data: dict, raw_text: Any) -> dict:
    if data.get("location"):
        return data
    text = ensure_text(raw_text)
    m = re.search(r'\b([A-Z][A-Za-z]+,\s*[A-Z][A-Za-z]+)\b', text)
    if m is not None:
        data["location"] = m.group(1)
    return data

def _inject_project_links_if_missing(data: dict, raw_text: Any) -> dict:
    text = ensure_text(raw_text)
    urls = re.findall(r'(https?://(?:www\.)?github\.com/[^\s\)\]]+)', text, re.I)
    if not urls:
        return data
    i = 0
    for p in data.get("projects") or []:
        if isinstance(p, dict) and not ensure_text(p.get("link")) and i < len(urls):
            p["link"] = urls[i]
            i += 1
    return data

def sanitize_struct(d: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(d or {})

    for k in ["first_name", "last_name", "email", "phone", "location", "summary"]:
        if k in out:
            out[k] = ensure_text(out[k])

    links = []
    for l in out.get("links") or []:
        if isinstance(l, dict):
            links.append({"label": ensure_text(l.get("label", "Link")), "url": ensure_text(l.get("url", ""))})
        else:
            s = ensure_text(l)
            if s:
                links.append({"label": "Link", "url": s})
    out["links"] = links

    out["skills"] = [ensure_text(s) for s in (out.get("skills") or []) if ensure_text(s)]

    exps = []
    for e in out.get("experience") or []:
        if not isinstance(e, dict):
            continue
        exps.append({
            "title": ensure_text(e.get("title")),
            "company": ensure_text(e.get("company")),
            "location": ensure_text(e.get("location")),
            "start_date": ensure_text(e.get("start_date")),
            "end_date": ensure_text(e.get("end_date")),
            "summary": ensure_text(e.get("summary")),
            "bullets": [ensure_text(b) for b in (e.get("bullets") or []) if ensure_text(b)],
        })
    out["experience"] = exps

    projs = []
    for p in out.get("projects") or []:
        if not isinstance(p, dict):
            continue
        projs.append({
            "name": ensure_text(p.get("name")),
            "tech": ensure_text(p.get("tech")),
            "link": ensure_text(p.get("link")),
            "summary": ensure_text(p.get("summary")),
            "start_date": ensure_text(p.get("start_date")),
            "end_date": ensure_text(p.get("end_date")),
            "bullets": [ensure_text(b) for b in (p.get("bullets") or []) if ensure_text(b)],
        })
    out["projects"] = projs

    edus = []
    for e in out.get("education") or []:
        if not isinstance(e, dict):
            continue
        details_val = e.get("details")
        if isinstance(details_val, str):
            if details_val.strip() in ("[]", "", "null", "None", "-"):
                details = []
            else:
                details = [details_val]
        elif isinstance(details_val, list):
            details = [ensure_text(d) for d in details_val if ensure_text(d)]
        else:
            details = []

        edus.append({
            "degree": ensure_text(e.get("degree")),
            "institution": ensure_text(e.get("school") or e.get("institution")),
            "location": ensure_text(e.get("location")),
            "graduation_year": ensure_text(e.get("graduation_year")),
            "details": details,
        })
    out["education"] = edus

    certs = []
    for c in out.get("certifications") or []:
        certs.append(normalize_cert_item(c))
    out["certifications"] = certs

    pubs = []
    for p in out.get("publications") or []:
        pubs.append(ensure_text(p))
    out["publications"] = pubs

    return out

def _merge_links(a: Optional[List[Dict[str, str]]], b: Optional[List[Dict[str, str]]]) -> List[Dict[str, str]]:
    out: List[Dict[str, str]] = []
    seen: set = set()
    for src in (a or []) + (b or []):
        if not isinstance(src, dict):
            continue
        url = ensure_text(src.get("url"))
        label = ensure_text(src.get("label") or "Link")
        if url and url not in seen:
            out.append({"label": label, "url": url})
            seen.add(url)
    return out

def _key_exp(e: Dict[str, Any]) -> Tuple[str, str]:
    return (ensure_text(e.get("title")).lower(), ensure_text(e.get("company")).lower())

def _key_edu(e: Dict[str, Any]) -> Tuple[str, str]:
    return (ensure_text(e.get("degree")).lower(), ensure_text(e.get("institution")).lower())

def _key_proj(p: Dict[str, Any]) -> str:
    return ensure_text(p.get("name")).lower()

def merge_structured(original: Dict[str, Any], optimized: Dict[str, Any]) -> Dict[str, Any]:
    original = sanitize_struct(original)
    optimized = sanitize_struct(optimized)
    d: Dict[str, Any] = dict(optimized or {})

    orig_sk = original.get("skills") or []
    opt_sk = d.get("skills") or []
    d["skills"] = opt_sk if (opt_sk and len(opt_sk) >= max(3, len(orig_sk) // 2)) else orig_sk

    merged_edu: List[Dict[str, Any]] = []
    opt_edu = d.get("education") or []
    orig_edu = original.get("education") or []
    orig_map = {_key_edu(e): e for e in orig_edu}
    seen_keys = set()
    for e in opt_edu:
        key = _key_edu(e); seen_keys.add(key)
        base = dict(e)
        if key in orig_map:
            o = orig_map[key]
            if not base.get("details") and o.get("details"):
                base["details"] = o["details"]
            if not base.get("graduation_year") and o.get("graduation_year"):
                base["graduation_year"] = o["graduation_year"]
            if not base.get("location") and o.get("location"):
                base["location"] = o["location"]
        merged_edu.append(base)
    for o in orig_edu:
        key = _key_edu(o)
        if key not in seen_keys:
            merged_edu.append(o)
    d["education"] = merged_edu

    orig_exp_map = {_key_exp(e): e for e in (original.get("experience") or [])}
    merged_exp: List[Dict[str, Any]] = []
    for e in d.get("experience") or []:
        key = _key_exp(e); base = dict(e)
        if key in orig_exp_map:
            o = orig_exp_map[key]
            if not (base.get("bullets") or []):
                base["bullets"] = o.get("bullets") or []
            if not base.get("summary") and o.get("summary"):
                base["summary"] = o["summary"]
        merged_exp.append(base)
    d["experience"] = merged_exp or (original.get("experience") or [])

    orig_proj_map = {_key_proj(p): p for p in (original.get("projects") or [])}
    merged_proj: List[Dict[str, Any]] = []
    for p in d.get("projects") or []:
        key = _key_proj(p); base = dict(p)
        if key in orig_proj_map:
            o = orig_proj_map[key]
            if not (base.get("bullets") or []):
                base["bullets"] = o.get("bullets") or []
            if not base.get("summary") and o.get("summary"):
                base["summary"] = o["summary"]
            if not base.get("link") and o.get("link"):
                base["link"] = o["link"]
        merged_proj.append(base)
    for key, o in orig_proj_map.items():
        if key not in {_key_proj(p) for p in merged_proj}:
            merged_proj.append(o)
    d["projects"] = merged_proj

    d["links"] = _merge_links(original.get("links"), d.get("links"))
    if not d.get("location") and original.get("location"):
        d["location"] = original["location"]
    return d

# ---------------------------
# Skills generation (3-row layout)
# ---------------------------
SEED_SKILLS = {
    "Design Tools": [
        "Adobe Photoshop", "Photoshop", "Adobe Illustrator", "Illustrator",
        "InDesign", "Premiere Pro", "After Effects", "Lightroom", "XD",
        "Adobe XD", "CorelDRAW", "Canva", "Figma"
    ],
    "Web/Tech Skills": [
        "HTML", "CSS", "JavaScript", "Python", "MySQL", "Git", "GitHub", "WordPress"
    ],
    "Content Expertise": [
        "Logo Design", "Branding", "Banners", "Thumbnails", "Reels", "Video Editing",
        "UI/UX Design", "Social Media Graphics", "Product Mockups", "Motion Graphics"
    ],
}

def _find_keywords(text: str, candidates: List[str]) -> List[str]:
    text_low = text.lower(); found = []
    for c in candidates:
        c_low = c.lower()
        if re.search(rf'\b{re.escape(c_low)}\b', text_low) or c_low in text_low:
            if c not in found: found.append(c)
    return found

def _from_existing_list(skills: List[str], candidates: List[str]) -> List[str]:
    hay = " | ".join(skills).lower()
    return [c for c in candidates if c.lower() in hay]

def _join_until(chars_limit: int, items: List[str]) -> str:
    out, cur = [], 0
    for it in items:
        add = (", " if out else "") + it
        if cur + len(add) <= chars_limit:
            out.append(it); cur += len(add)
        else:
            break
    return ", ".join(out)

def generate_three_skill_rows(raw_text: str, data: Dict[str, Any]) -> Tuple[str, str, str, List[str]]:
    text = ensure_text(raw_text)
    existing = [ensure_text(s) for s in (data.get("skills") or []) if ensure_text(s)]
    rows: Dict[str, List[str]] = {}
    for cat, seeds in SEED_SKILLS.items():
        rows[cat] = []
        rows[cat] += _from_existing_list(existing, seeds)
        for k in _find_keywords(text, seeds):
            if k not in rows[cat]: rows[cat].append(k)
        if not rows[cat]:
            rows[cat] = seeds[:]
    def dedup(seq: List[str]) -> List[str]:
        seen=set(); out=[]
        for x in seq:
            if x not in seen: out.append(x); seen.add(x)
        return out
    row1_items = dedup(rows["Design Tools"])
    row2_items = dedup(rows["Web/Tech Skills"])
    row3_items = dedup(rows["Content Expertise"])
    row1 = _join_until(90, row1_items)
    row2 = _join_until(90, row2_items)
    row3 = _join_until(90, row3_items)
    flat = dedup(row1_items + row2_items + row3_items)[:MAX_SKILLS_DEFAULT]
    return row1, row2, row3, flat

# ---------------------------
# Sizing & content measurement
# ---------------------------
def _approx_char_count(d: Dict[str, Any]) -> int:
    total = 0
    def add(s: str):
        nonlocal total
        total += len(ensure_text(s))
    add(d.get("first_name", "")); add(d.get("last_name", "")); add(d.get("summary", ""))
    for s in d.get("skills", []): add(s)
    for e in d.get("experience", []):
        add(e.get("title", "")); add(e.get("company", "")); add(e.get("location", ""))
        add(e.get("start_date", "")); add(e.get("end_date", "")); add(e.get("summary", ""))
        for b in e.get("bullets", []): add(b)
    for p in d.get("projects", []):
        add(p.get("name", "")); add(p.get("tech", "")); add(p.get("summary", ""))
        for b in p.get("bullets", []): add(b)
    for e in d.get("education", []):
        add(e.get("degree", "")); add(e.get("institution", "")); add(e.get("location", ""))
        add(e.get("graduation_year", ""))
        for det in e.get("details", []): add(det)
    for c in d.get("certifications", []):
        add(c.get("name", "")); add(c.get("issuer", "")); add(c.get("date", "")); add(c.get("description", ""))
    for p in d.get("publications", []): add(p)
    return total

# ---------------------------
# LLM helpers (expansion)
# ---------------------------
def _parse_bullets_from_text(txt: str, max_n: int) -> List[str]:
    lines = []
    for line in ensure_text(txt).splitlines():
        m = re.match(r'\s*[-*•]\s+(.*)', line)
        if m:
            candidate = m.group(1).strip()
            if candidate:
                lines.append(shorten_text(candidate, 180))
        if len(lines) >= max_n:
            break
    return lines

def _llm_generate_extra_bullets(context: str, max_needed: int) -> List[str]:
    if max_needed <= 0:
        return []
    model = genai.GenerativeModel("gemini-1.5-flash-latest")
    prompt = f"""
You are helping improve a resume. Using ONLY the facts present in the provided context,
produce up to {max_needed} additional resume bullet points that strengthen impact.
Do not invent new employers, dates, tools, or results. If there is not enough information, output nothing.

Style:
- Start with a strong verb.
- One sentence per bullet, <= 25 words.
- Quantify impact ONLY if numbers exist in the context.

Return bullets as lines prefixed with "- ".
=== CONTEXT ===
{context}
"""
    try:
        resp = model.generate_content(prompt)
        return _parse_bullets_from_text(getattr(resp, "text", "") or "", max_needed)
    except Exception:
        return []

def _llm_extract_missing_items(raw_text: str, existing_names: List[str], kind: str, max_items: int) -> List[Dict[str, Any]]:
    if max_items <= 0:
        return []
    model = genai.GenerativeModel("gemini-1.5-flash-latest")
    prompt = f"""
From the resume text below, extract up to {max_items} additional {kind}s that are clearly and explicitly mentioned
but might be missing from the structured data. Do NOT invent anything. Skip if unsure.

For each item, return JSON lines (one per item) with these keys:
- For project: {{"name": "...", "summary": "...", "tech": "", "start_date": "", "end_date": "", "bullets": ["...", "..."]}}
- For experience: {{"title": "", "company": "", "location": "", "start_date": "", "end_date": "", "summary": "", "bullets": ["...", "..."]}}
Output plain JSON lines (no prose).

EXISTING NAMES: {existing_names}

=== RESUME TEXT ===
{raw_text}
"""
    try:
        resp = model.generate_content(prompt)
        text = getattr(resp, "text", "") or ""
        items: List[Dict[str, Any]] = []
        for line in text.splitlines():
            line = line.strip()
            if not line or not (line.startswith("{") and line.endswith("}")):
                continue
            try:
                obj = json.loads(line)
                key = (obj.get("name") or obj.get("company") or "").strip()
                if key and key not in existing_names:
                    items.append(obj)
                    if len(items) >= max_items:
                        break
            except Exception:
                continue
        return items
    except Exception:
        return []

# ---------------------------
# Fallbacks for sparse data
# ---------------------------
def _fallback_bullets_from_summary(txt: str, want: int) -> List[str]:
    s = ensure_text(txt)
    if not s.strip():
        return []
    parts = re.split(r'[;,.]|\band\b', s)
    bullets = []
    for p in parts:
        p = re.sub(r'\s+', ' ', p).strip()
        if len(p) < 6:
            continue
        p = re.sub(r'^(responsible for|worked on|helped|involved in)\s+', '', p, flags=re.I)
        bullets.append(shorten_text(p, 150))
        if len(bullets) >= want:
            break
    return bullets

def _backfill_cert_descriptions_from_raw(data: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
    text = ensure_text(raw_text)
    certs = data.get("certifications") or []
    out = []
    for c in certs:
        c = normalize_cert_item(c)
        if not c.get("description"):
            name = ensure_text(c.get("name")); issuer = ensure_text(c.get("issuer"))
            if name:
                pat = re.compile(
                    re.escape(name) + r".{0,200}?Covered:\s*(.+?)(?:\n{2,}|$)",
                    re.IGNORECASE | re.DOTALL
                )
                m = pat.search(text)
                if m:
                    desc = re.sub(r"\s+", " ", m.group(1)).strip()
                    c["description"] = shorten_text(desc, 160)
        if not c.get("description"):
            if c.get("issuer"):
                c["description"] = f"Credential issued by {c['issuer']}."
            elif c.get("name"):
                key = re.sub(r"(certificate|certification|professional|course|program)", "", c["name"], flags=re.I)
                key = re.sub(r"\s+", " ", key).strip()
                c["description"] = shorten_text(f"Credential in {key}.", 160) if key else "Verified credential."
            else:
                c["description"] = "Verified credential."
        out.append(c)
    data["certifications"] = out
    return data

def _ensure_education_details(data: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
    """
    Ensure each education item has at least one detail bullet.
    Prefer pulling 'Coursework/Subjects' nearby; else add a neutral line.
    """
    text = ensure_text(raw_text)
    for e in data.get("education") or []:
        det = e.get("details") or []
        if det:
            continue
        deg = ensure_text(e.get("degree"))
        inst = ensure_text(e.get("institution"))
        pattern = None
        if inst:
            pattern = re.compile(re.escape(inst) + r".{0,200}?(Coursework|Subjects):\s*(.+?)(?:\n{2,}|$)", re.I | re.DOTALL)
        elif deg:
            pattern = re.compile(re.escape(deg) + r".{0,200}?(Coursework|Subjects):\s*(.+?)(?:\n{2,}|$)", re.I | re.DOTALL)
        if pattern:
            m = pattern.search(text)
            if m:
                line = re.sub(r"\s+", " ", m.group(2)).strip()
                if line:
                    e["details"] = [shorten_text(line, 120)]
                    continue
        if deg:
            e["details"] = [shorten_text(f"Program: {deg}.", 120)]
        else:
            e["details"] = ["Academic program completed."]
    return data

# ---------------------------
# Expansion: add bullets/items if space permits
# ---------------------------
def expand_sparse_content(data: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
    d = dict(data or {})
    base_chars = _approx_char_count(d)

    def top_up_bullets(container: List[Dict[str, Any]], target: int, kind: str):
        for item in container or []:
            bullets = list(item.get("bullets") or [])
            need = max(0, target - len(bullets))
            if need <= 0:
                continue
            if kind == "exp":
                ctx = f"TITLE: {item.get('title','')}\nCOMPANY: {item.get('company','')}\nSUMMARY: {item.get('summary','')}\nEXISTING BULLETS:\n- " + "\n- ".join(bullets) + f"\n\nFULL RESUME TEXT:\n{raw_text}"
            else:
                ctx = f"PROJECT: {item.get('name','')}\nTECH: {item.get('tech','')}\nSUMMARY: {item.get('summary','')}\nEXISTING BULLETS:\n- " + "\n- ".join(bullets) + f"\n\nFULL RESUME TEXT:\n{raw_text}"
            add = _llm_generate_extra_bullets(ctx, need)
            if not add and ensure_text(item.get("summary")).strip():
                add = _fallback_bullets_from_summary(item.get("summary",""), need)
            item["bullets"] = bullets + add

    # Short band: top up to 4 bullets
    if base_chars < SHORT_MAX:
        top_up_bullets(d.get("experience"), SPARSE_TARGET_BULLETS_EXP, "exp")   # 4
        top_up_bullets(d.get("projects"),   SPARSE_TARGET_BULLETS_PROJ, "proj") # 4

        after = _approx_char_count(d)
        if after < SHORT_MAX:
            existing_proj_names = [ensure_text(x.get("name")) for x in (d.get("projects") or []) if ensure_text(x.get("name"))]
            new_projects = _llm_extract_missing_items(raw_text, existing_proj_names, "project", SPARSE_MAX_NEW_PROJECTS)
            for np in new_projects:
                d.setdefault("projects", []).append({
                    "name": ensure_text(np.get("name")),
                    "tech": ensure_text(np.get("tech")),
                    "link": ensure_text(np.get("link")),
                    "summary": ensure_text(np.get("summary")),
                    "start_date": ensure_text(np.get("start_date")),
                    "end_date": ensure_text(np.get("end_date")),
                    "bullets": [ensure_text(b) for b in (np.get("bullets") or []) if ensure_text(b)],
                })

            existing_companies = [ensure_text(x.get("company")) for x in (d.get("experience") or []) if ensure_text(x.get("company"))]
            new_exps = _llm_extract_missing_items(raw_text, existing_companies, "experience", SPARSE_MAX_NEW_EXPERIENCES)
            for ne in new_exps:
                d.setdefault("experience", []).append({
                    "title": ensure_text(ne.get("title")),
                    "company": ensure_text(ne.get("company")),
                    "location": ensure_text(ne.get("location")),
                    "start_date": ensure_text(ne.get("start_date")),
                    "end_date": ensure_text(ne.get("end_date")),
                    "summary": ensure_text(ne.get("summary")),
                    "bullets": [ensure_text(b) for b in (ne.get("bullets") or []) if ensure_text(b)],
                })

        return d

    # Mid band: ensure 3 bullets where possible
    if base_chars < LONG_MIN:
        top_up_bullets(d.get("experience"), MIN_BULLETS_MID, "exp")  # 3
        top_up_bullets(d.get("projects"),   MIN_BULLETS_MID, "proj")  # 3
        return d

    # Long band: no expansion
    return d

# ---------------------------
# Compression (final one-page fit)
# ---------------------------
def compress_payload_for_one_page(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Final shaping to ~1 page.
    - If SHORT  : allow more items and cap bullets at 4.
    - If MID    : cap bullets at 3.
    - If LONG   : cap bullets at 2 and trim more.
    """
    d = sanitize_struct(data)

    base_chars = _approx_char_count(d)

    max_exp = MAX_EXP_DEFAULT
    max_proj = MAX_PROJ_DEFAULT
    max_edu = MAX_EDU_DEFAULT
    max_cert = MAX_CERTS_DEFAULT

    # Defaults (mid band)
    max_bullets_exp = 3
    max_bullets_proj = 3
    sum_limit_exp = 220
    sum_limit_proj = 180

    if base_chars < SHORT_MAX:
        # expand + 4-bullet cap
        max_exp = min(4, max_exp + 1)
        max_proj = min(3, max_proj + 1)
        max_bullets_exp = 4
        max_bullets_proj = 4
        sum_limit_exp = 280
        sum_limit_proj = 220
    elif base_chars >= LONG_MIN:
        # trim + 2-bullet cap
        max_bullets_exp = MAX_BULLETS_EXP_DEFAULT  # 2
        max_bullets_proj = MAX_BULLETS_PROJ_DEFAULT
        max_cert = min(5, MAX_CERTS_DEFAULT)
        sum_limit_exp = 200
        sum_limit_proj = 160

    # Experience
    exp = d.get("experience") or []
    _normalize_dates(exp)
    for e in exp:
        e["summary"] = shorten_text(e.get("summary"), sum_limit_exp)
        e["bullets"] = limit_bullets(e.get("bullets"), max_bullets_exp)
    d["experience"] = exp[:max_exp]

    # Projects
    projs = d.get("projects") or []
    _normalize_dates(projs)
    for p in projs:
        p["summary"] = shorten_text(p.get("summary"), sum_limit_proj)
        p["bullets"] = limit_bullets(p.get("bullets"), max_bullets_proj)
    d["projects"] = projs[:max_proj]

    # Education
    edu = d.get("education") or []
    for e in edu:
        details = e.get("details") or []
        if isinstance(details, list) and details:
            e["details"] = [shorten_text(x, 120) for x in details]
    d["education"] = edu[:max_edu]

    # Certifications – normalize, clean, dedupe, cap
    certs = d.get("certifications") or []
    norm = [normalize_cert_item(c) for c in certs]
    clean = []; seen = set()
    for c in norm:
        c["name"] = _clean_none(c.get("name"))
        c["issuer"] = _clean_none(c.get("issuer"))
        c["date"] = _clean_none(c.get("date"))
        c["link"] = _clean_none(c.get("link"))
        c["description"] = _clean_none(c.get("description"))
        if not (c["name"] or c["issuer"] or c["date"] or c["link"] or c["description"]):
            continue
        key = (c["name"].lower(), c["issuer"].lower(), c["date"], c["link"])
        if key not in seen:
            clean.append(c); seen.add(key)
    d["certifications"] = clean[:max_cert]

    # Publications
    pubs = d.get("publications") or []
    d["publications"] = pubs[:MAX_PUBLICATIONS_DEFAULT]

    # Skills – keep for API; template uses 3-row strings
    skills = d.get("skills") or []
    d["skills"] = [shorten_text(s, 90) for s in skills][:MAX_SKILLS_DEFAULT]

    # Conditional Summary (only if resume is sparse)
    richness = 0
    richness += len([e for e in d["experience"] if e.get("title") or e.get("company")])
    richness += len([s for s in d["skills"] if s])
    richness += len(d["education"])
    d["show_summary"] = bool(d.get("summary")) and (richness < 6)

    return d

# ---------------------------
# Ensure 3-row skills for template
# ---------------------------
def ensure_skill_rows(data: Dict[str, Any], raw_text: str) -> Dict[str, Any]:
    row1, row2, row3, flat = generate_three_skill_rows(raw_text, data)
    if not data.get("skills"):
        data["skills"] = flat
    data["skills_row1"] = row1
    data["skills_row2"] = row2
    data["skills_row3"] = row3
    return data

# ---------------------------
# LLM optimization (Gemini)
# ---------------------------
def optimize_resume_text(resume_text: str, job_desc: str) -> str:
    model = genai.GenerativeModel("gemini-1.5-flash-latest")
    prompt = f"""
You are an expert resume writer. Rewrite the resume below to align with the job description.

Rules:
- Keep it truthful (no invented experiences).
- Keep ATS-friendly phrasing and standard section names (Experience, Education, Skills, Projects, Certifications, Publications).
- Compress into a ONE-PAGE resume: concise bullets over paragraphs.
- Limit each Experience/Project to max 3 bullets with quantified impact.
- CRITICAL: Do NOT remove the Technical Skills section. Preserve tools/languages/frameworks as a list.
- CRITICAL: Preserve Education details including CGPA/percentages, expected/completion year, and location.
- For Certifications, produce short items: name, issuer, year; include link if present.
- Include a Professional Summary ONLY IF the original resume lacks sufficient content elsewhere.
Return ONLY the optimized resume text (no commentary).

=== ORIGINAL RESUME ===
{resume_text}

=== JOB DESCRIPTION ===
{job_desc}

=== OPTIMIZED RESUME (RETURN ONLY THIS) ===
"""
    resp = model.generate_content(prompt)
    return (getattr(resp, "text", "") or "").strip()

# ---------------------------
# Compile LaTeX -> PDF bytes
# ---------------------------
def compile_latex_to_pdf_bytes(tex_str: str) -> bytes:
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            tex_path = os.path.join(tmpdir, "resume.tex")
            with open(tex_path, "w", encoding="utf-8") as f:
                f.write(tex_str)

            for _ in range(2):
                proc = subprocess.run(
                    ["pdflatex", "-interaction=nonstopmode", "resume.tex"],
                    cwd=tmpdir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                if proc.returncode != 0:
                    raise RuntimeError(
                        "LaTeX compilation failed:\n" + proc.stdout.decode("utf-8", "ignore")
                    )

            pdf_path = os.path.join(tmpdir, "resume.pdf")
            if not os.path.exists(pdf_path):
                raise RuntimeError("LaTeX did not produce resume.pdf")

            with open(pdf_path, "rb") as pf:
                return pf.read()

    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="pdflatex is not installed or not in PATH")

# ---------------------------
# Health
# ---------------------------
@app.get("/")
def health():
    return {"status": "ok"}

# ---------------------------
# 1) Extract structured JSON from an uploaded PDF
# ---------------------------
@app.post("/resumes/extract")
async def extract_resume_data(file: UploadFile = File(...)):
    if not (file and file.content_type in ("application/pdf", "application/octet-stream")):
        raise HTTPException(status_code=400, detail="Upload a PDF.")
    try:
        raw_text = await resume_parser.parse_pdf(file)
        text = ensure_text(raw_text)
        data = llm_service.extract_resume_info(text)

        # Enrich & backfill
        data = _inject_links_if_missing(data, text)
        data = _inject_location_if_missing(data, text)
        data = _inject_project_links_if_missing(data, text)
        data = _backfill_cert_descriptions_from_raw(data, text)
        data = _ensure_education_details(data, text)

        # Expand (if short / mid) then compress to one page
        data = expand_sparse_content(data, text)
        resume = ResumeInfo(**sanitize_struct(data))
        cleaned = compress_payload_for_one_page(resume.dict())

        # Ensure 3-row technical skills
        cleaned = ensure_skill_rows(cleaned, text)

        return {"filename": file.filename, "data": cleaned}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")

# ---------------------------
# 2) Multipart pipeline (PDF upload) -> optimize -> LaTeX -> PDF
# ---------------------------
@app.post("/resumes/pdf-latex")
async def generate_resume_pdf_latex(
    file: UploadFile = File(...),
    jd: str = Form(..., description="Job description text"),
):
    if not (file and file.content_type in ("application/pdf", "application/octet-stream")):
        raise HTTPException(status_code=400, detail="Upload a PDF.")
    try:
        # A) Parse original resume text
        raw_text = await resume_parser.parse_pdf(file)
        text = ensure_text(raw_text)
        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the PDF.")

        # B) Extract baseline from ORIGINAL
        orig_structured = llm_service.extract_resume_info(text)
        orig_structured = _inject_links_if_missing(orig_structured, text)
        orig_structured = _inject_location_if_missing(orig_structured, text)
        orig_structured = _inject_project_links_if_missing(orig_structured, text)
        orig_structured = sanitize_struct(orig_structured)

        # C) Optimize against JD
        optimized_text = optimize_resume_text(text, jd)

        # D) Extract from OPTIMIZED
        try:
            opt_structured = llm_service.extract_resume_info(optimized_text)
        except Exception:
            opt_structured = {}
        opt_structured = _inject_links_if_missing(opt_structured, text)
        opt_structured = _inject_location_if_missing(opt_structured, text)
        opt_structured = _inject_project_links_if_missing(opt_structured, text)
        opt_structured = sanitize_struct(opt_structured)

        # E) Merge + backfill + expand
        merged = merge_structured(orig_structured, opt_structured)
        merged = _backfill_cert_descriptions_from_raw(merged, text)
        merged = _ensure_education_details(merged, text)
        merged = expand_sparse_content(merged, text)

        # F) Compress for one page
        resume = ResumeInfo(**merged)
        data = compress_payload_for_one_page(resume.dict())

        # G) Ensure 3-row skills
        data = ensure_skill_rows(data, text)

        # H) Render LaTeX
        try:
            template = env.get_template("resume.tex.jinja")
            tex_str = template.render(resume=data)
        except TemplateSyntaxError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Template syntax error (resume.tex.jinja:{e.lineno}): {e.message}",
            )

        # I) Compile & stream
        pdf_bytes = compile_latex_to_pdf_bytes(tex_str)
        suggested = f"{data.get('first_name','Candidate')}_{data.get('last_name','Resume')}.pdf"
        headers = {"Content-Disposition": f'attachment; filename="{suggested}"'}
        return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers=headers)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate LaTeX PDF: {str(e)}")

# ---------------------------
# 2.5) Multipart alias
# ---------------------------
@app.post("/resumes/pdf")
async def generate_resume_pdf_alias(
    file: UploadFile = File(...),
    jd: str = Form(..., description="Job description text"),
):
    return await generate_resume_pdf_latex(file=file, jd=jd)

# ---------------------------
# 3) JSON pipeline (resume_text + job_desc) -> LaTeX -> PDF
# ---------------------------
class ResumePdfRequest(BaseModel):
    resume_text: str
    job_desc: str

@app.post("/resumes/pdf-json")
async def generate_resume_pdf_json(req: ResumePdfRequest):
    try:
        text = ensure_text(req.resume_text)
        if not text.strip():
            raise HTTPException(status_code=400, detail="resume_text is empty")
        if not ensure_text(req.job_desc).strip():
            raise HTTPException(status_code=400, detail="job_desc is empty")

        orig_structured = llm_service.extract_resume_info(text)
        orig_structured = _inject_links_if_missing(orig_structured, text)
        orig_structured = _inject_location_if_missing(orig_structured, text)
        orig_structured = _inject_project_links_if_missing(orig_structured, text)
        orig_structured = sanitize_struct(orig_structured)

        optimized_text = optimize_resume_text(text, req.job_desc)

        try:
            opt_structured = llm_service.extract_resume_info(optimized_text)
        except Exception:
            opt_structured = {}
        opt_structured = _inject_links_if_missing(opt_structured, text)
        opt_structured = _inject_location_if_missing(opt_structured, text)
        opt_structured = _inject_project_links_if_missing(opt_structured, text)
        opt_structured = sanitize_struct(opt_structured)

        merged = merge_structured(orig_structured, opt_structured)
        merged = _backfill_cert_descriptions_from_raw(merged, text)
        merged = _ensure_education_details(merged, text)
        merged = expand_sparse_content(merged, text)

        resume = ResumeInfo(**merged)
        data = compress_payload_for_one_page(resume.dict())
        data = ensure_skill_rows(data, text)

        try:
            template = env.get_template("resume.tex.jinja")
            tex_str = template.render(resume=data)
        except TemplateSyntaxError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Template syntax error (resume.tex.jinja:{e.lineno}): {e.message}",
            )

        pdf_bytes = compile_latex_to_pdf_bytes(tex_str)
        suggested = f"{data.get('first_name','Candidate')}_{data.get('last_name','Resume')}.pdf"
        headers = {"Content-Disposition": f'attachment; filename="{suggested}"'}
        return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers=headers)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
