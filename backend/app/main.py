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
# ---------------------------
# Skills generation (Languages, Tools & Platforms, Concepts)
# ---------------------------
SEED_SKILLS = {
    "Languages": [
        # General purpose
        "Python", "Java", "C", "C++", "C#", "Go", "Rust", "Kotlin", "Swift", "Ruby",
        # Web / scripting
        "JavaScript", "TypeScript", "PHP", "Shell", "Bash", "PowerShell",
        # Data / scientific
        "R", "Julia", "MATLAB", "SAS",
        # Query / markup
        "SQL", "PL/SQL", "T-SQL", "NoSQL", "GraphQL",
        "HTML", "CSS", "SASS", "SCSS",
        # JVM / functional
        "Scala", "Groovy", "Clojure", "Haskell", "Elixir", "Erlang",
        # Systems / embedded
        "Assembly", "VHDL", "Verilog",
        # Mobile
        "Objective-C", "Dart",
        # Other
        "LaTeX"
    ],

    "Tools and Platforms": [
        # VCS / Dev productivity
        "Git", "GitHub", "GitLab", "Bitbucket", "SVN", "Jira", "Confluence", "Slack",
        "VS Code", "IntelliJ IDEA", "PyCharm", "WebStorm", "Xcode", "Android Studio",
        "Postman", "Insomnia", "Fiddler", "Charles Proxy",
        # Build / CI
        "Maven", "Gradle", "SBT", "Make", "CMake", "Ninja",
        "Jenkins", "GitHub Actions", "GitLab CI", "CircleCI", "Travis CI", "TeamCity", "Azure DevOps",
        "SonarQube", "Snyk", "Dependabot",
        # Containers / Orchestration
        "Docker", "Docker Compose", "Podman", "Kubernetes", "Helm", "Kustomize",
        # Cloud
        "AWS", "Amazon EC2", "S3", "RDS", "ECS", "EKS", "Lambda", "CloudFormation", "CDK",
        "GCP", "GKE", "Cloud Run", "Cloud Functions", "BigQuery", "Cloud Build",
        "Azure", "AKS", "App Service", "Functions", "Cosmos DB", "DevOps Pipelines",
        # Infra as Code / Config
        "Terraform", "Pulumi", "Ansible", "Chef", "Puppet", "Packer", "Vagrant",
        # Databases
        "PostgreSQL", "MySQL", "MariaDB", "SQLite", "SQL Server", "Oracle",
        "MongoDB", "Cassandra", "DynamoDB", "Redis", "Elasticsearch", "Neo4j",
        # Streaming / MLOps / Data
        "Kafka", "RabbitMQ", "Kinesis", "Flink", "Spark", "Airflow", "dbt",
        "MLflow", "Weights & Biases",
        # Web frameworks / runtimes
        "Node.js", "Deno", "Express", "NestJS", "FastAPI", "Django", "Flask",
        "Spring", "Spring Boot", "Micronaut", "Quarkus",
        "Rails", "Laravel",
        "React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "SvelteKit",
        # Testing
        "JUnit", "TestNG", "pytest", "unittest", "Cypress", "Playwright", "Jest",
        "Mocha", "Chai", "Vitest", "Selenium",
        # Security / Observability
        "OWASP ZAP", "Burp Suite",
        "Prometheus", "Grafana", "ELK Stack", "OpenTelemetry", "Datadog", "New Relic",
        # OS
        "Linux", "Ubuntu", "Debian", "Red Hat", "Windows", "macOS",
        # Design (if applicable)
        "Figma", "Adobe XD", "Adobe Photoshop", "Illustrator"
    ],

    "Concepts": [
        # Fundamentals
        "Data Structures", "Algorithms", "Object-Oriented Programming", "Functional Programming",
        "Design Patterns", "Clean Code", "Refactoring", "SOLID Principles",
        # Architecture
        "Microservices", "Monolith to Microservices", "Event-Driven Architecture",
        "REST", "GraphQL", "gRPC", "Message Queues",
        "Domain-Driven Design", "Hexagonal Architecture", "CQRS", "Event Sourcing",
        # Delivery / SDLC
        "Agile", "Scrum", "Kanban", "CI/CD", "TDD", "BDD",
        # Cloud & Infra
        "Cloud Computing", "Scalability", "High Availability", "Resilience",
        "Caching", "Load Balancing", "Auto Scaling", "Blue/Green Deployments",
        # Security
        "Authentication", "Authorization", "OAuth 2.0", "OIDC", "JWT",
        "OWASP Top 10", "Secure Coding", "Secrets Management", "Zero Trust",
        # Data / ML
        "ETL", "Streaming", "Batch Processing", "Data Warehousing",
        "Machine Learning", "Deep Learning", "Feature Engineering", "Model Serving",
        # Performance / Reliability
        "Observability", "Monitoring", "Tracing", "Logging",
        "Performance Tuning", "SRE", "SLI/SLO/SLA",
        # Web
        "Accessibility (a11y)", "SEO", "Responsive Design", "Progressive Web Apps",
        # Other
        "API Design", "Versioning", "Documentation", "Code Review"
    ],
}
def _try_parse_json_blob(blob: str) -> Dict[str, Any]:
    blob = (blob or "").strip()
    m = re.search(r'(\{.*\})', blob, flags=re.DOTALL)
    txt = m.group(1) if m else blob
    try:
        return json.loads(txt)
    except Exception:
        return {}

def gemini_generate_skill_rows(raw_text: str, job_desc: Optional[str]) -> Tuple[str, str, str, List[str]]:
    """
    Ask Gemini to propose Languages, Tools and Platforms, and Concepts.
    No local fallback — if Gemini doesn't return usable lists, we return empties.
    """
    model = genai.GenerativeModel("gemini-1.5-flash-latest")
    prompt = f"""
You are preparing a resume skills section split into three rows:
1) Languages
2) Tools and Platforms
3) Concepts

Given the RESUME TEXT and (optionally) the JOB DESCRIPTION:
- Only include items clearly supported by the resume, or logical specializations/extensions.
- Prefer job description items that don't contradict the resume.
- Keep each list concise and highly relevant.
- Return strict JSON with exactly these keys:
{{
  "languages": ["..."],
  "tools_platforms": ["..."],
  "concepts": ["..."]
}}

RESUME TEXT:
{raw_text}

JOB DESCRIPTION (optional):
{job_desc or "(none provided)"}
"""
    try:
        resp = model.generate_content(prompt)
        data = _try_parse_json_blob(getattr(resp, "text", "") or "")
    except Exception:
        data = {}

    langs = [ensure_text(x) for x in (data.get("languages") or []) if ensure_text(x)]
    tools = [ensure_text(x) for x in (data.get("tools_platforms") or []) if ensure_text(x)]
    conc  = [ensure_text(x) for x in (data.get("concepts") or []) if ensure_text(x)]

    row1 = _join_until(90, langs)
    row2 = _join_until(90, tools)
    row3 = _join_until(90, conc)
    flat = (langs + tools + conc)[:MAX_SKILLS_DEFAULT]
    return row1, row2, row3, flat


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

def generate_three_skill_rows(raw_text: str,
                              data: Dict[str, Any],
                              job_desc: Optional[str] = None) -> Tuple[str, str, str, List[str]]:
    """
    Gemini-only: build three skill rows (Languages, Tools & Platforms, Concepts)
    using Gemini results exclusively. No seed- or regex-based fallback.
    """
    text = ensure_text(raw_text)
    row1, row2, row3, flat = gemini_generate_skill_rows(text, job_desc)

    # Hard rule: do not fallback to seeds. If Gemini yields nothing, return empties.
    # Optionally keep existing data.skills (flat) for ATS if already present.
    if not (row1 or row2 or row3):
        existing_flat = [ensure_text(s) for s in (data.get("skills") or []) if ensure_text(s)]
        flat = existing_flat[:MAX_SKILLS_DEFAULT] if existing_flat else []

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

    def top_up_bullets(
        container: Optional[List[Dict[str, Any]]],
        target: int,
        kind: str
    ) -> None:
        """Mutates items in-place to top up bullets to a target count."""
        if not container:
            return

        for item in container:
            bullets = list(item.get("bullets") or [])
            need = max(0, target - len(bullets))
            if need <= 0:
                continue

            if kind == "exp":
                ctx = (
                    f"TITLE: {item.get('title','')}\n"
                    f"COMPANY: {item.get('company','')}\n"
                    f"SUMMARY: {item.get('summary','')}\n"
                    "EXISTING BULLETS:\n- " + "\n- ".join(bullets) +
                    f"\n\nFULL RESUME TEXT:\n{raw_text}"
                )
            else:
                ctx = (
                    f"PROJECT: {item.get('name','')}\n"
                    f"TECH: {item.get('tech','')}\n"
                    f"SUMMARY: {item.get('summary','')}\n"
                    "EXISTING BULLETS:\n- " + "\n- ".join(bullets) +
                    f"\n\nFULL RESUME TEXT:\n{raw_text}"
                )

            add = _llm_generate_extra_bullets(ctx, need)
            if not add and ensure_text(item.get("summary")).strip():
                add = _fallback_bullets_from_summary(item.get("summary", ""), need)

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
# Compression (final one-page fit, static shaping)
# ---------------------------
def compress_payload_for_one_page(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Final shaping to ~1 page (pre-compile).
    - SHORT  : allow more items & cap bullets at 4
    - MID    : cap bullets at 3
    - LONG   : cap bullets at 2 and trim more
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
def ensure_skill_rows(data: Dict[str, Any],
                      raw_text: str,
                      job_desc: Optional[str] = None) -> Dict[str, Any]:
    """
    Gemini-only population of skills rows.
    If Gemini returns nothing, we keep rows empty and preserve existing flat skills if present.
    """
    row1, row2, row3, flat = generate_three_skill_rows(
        raw_text=raw_text,
        data=data,
        job_desc=job_desc,
    )

    # Preserve any existing flat skills if Gemini produced no flat list
    if not flat and data.get("skills"):
        flat = [ensure_text(s) for s in (data.get("skills") or []) if ensure_text(s)][:MAX_SKILLS_DEFAULT]

    if flat:
        data["skills"] = flat
    data["skills_row1"] = row1  # may be empty
    data["skills_row2"] = row2  # may be empty
    data["skills_row3"] = row3  # may be empty
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
# Section order & final hard squeeze  (NEW)
# ---------------------------
WANTED_SECTION_ORDER = ["summary", "education", "projects", "skills", "certifications"]

def enforce_section_order(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    - Enforce the requested order.
    - Remove sections not requested (experience, publications) from render path.
    - Provide section_order for the template to iterate.
    """
    d = dict(data or {})

    # Remove sections not in desired order
    d.pop("experience", None)
    d.pop("publications", None)

    # Ensure booleans/fields exist
    d["show_summary"] = bool(d.get("summary"))

    # Normalize presence
    d.setdefault("summary", d.get("summary", ""))
    d.setdefault("education", d.get("education", []))
    d.setdefault("projects", d.get("projects", []))
    d.setdefault("skills", d.get("skills", []))
    d.setdefault("certifications", d.get("certifications", []))

    # Order hint for template
    d["section_order"] = WANTED_SECTION_ORDER[:]
    return d

def _ultra_squeeze_to_one_page(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Nuclear option to guarantee one page.
    Keeps only target sections with very small counts.
    """
    d = enforce_section_order(dict(data or {}))

    # Summary
    d["summary"] = shorten_text(d.get("summary", ""), 110)
    d["show_summary"] = bool(d["summary"])

    # Education: 1 item, 1 short detail
    edu = (d.get("education") or [])[:1]
    for e in edu:
        e["details"] = (e.get("details") or [])[:1]
        if e["details"]:
            e["details"][0] = shorten_text(e["details"][0], 90)
    d["education"] = edu

    # Projects: 1 item, 1 bullet, short summary
    projs = (d.get("projects") or [])[:1]
    for p in projs:
        p["summary"] = shorten_text(p.get("summary", ""), 90)
        p["bullets"] = (p.get("bullets") or [])[:1]
        if p["bullets"]:
            p["bullets"][0] = shorten_text(p["bullets"][0], 90)
    d["projects"] = projs

    # Skills: max 6; if using rows, lightly trim strings
    d["skills"] = (d.get("skills") or [])[:6]
    if isinstance(d.get("skills_row1"), str):
        d["skills_row1"] = d["skills_row1"][:70]
    if isinstance(d.get("skills_row2"), str):
        d["skills_row2"] = d["skills_row2"][:70]
    if isinstance(d.get("skills_row3"), str):
        d["skills_row3"] = d["skills_row3"][:70]

    # Certifications: up to 2, omit descriptions
    certs = []
    for c in (d.get("certifications") or [])[:2]:
        certs.append({
            "name": shorten_text(ensure_text(c.get("name")), 50),
            "issuer": shorten_text(ensure_text(c.get("issuer")), 40),
            "date": ensure_text(c.get("date"))[:4],
            "link": ensure_text(c.get("link")),
            "description": ""
        })
    d["certifications"] = certs

    return d

# ---------------------------
# One-page fitting helpers
# ---------------------------
def _apply_shrink_pass(data: Dict[str, Any], pass_no: int) -> Dict[str, Any]:
    """
    Progressively reduce content each pass until it fits on 1 page.
    Pass 1: tighten bullets/summaries, cap skills/certs
    Pass 2: reduce counts of sections (exp/proj/edu)
    Pass 3: aggressive (hide summary, drop certs/pubs)
    Pass 4: single-bullet projects, even tighter summaries
    """
    d = dict(data)

    def cap_bullets(container_key: str, n: int):
        arr = d.get(container_key) or []
        for it in arr:
            it["bullets"] = (it.get("bullets") or [])[:max(0, n)]

    def shorten_summaries(limit_exp: int, limit_proj: int):
        for e in d.get("experience") or []:
            e["summary"] = shorten_text(e.get("summary"), limit_exp)
        for p in d.get("projects") or []:
            p["summary"] = shorten_text(p.get("summary"), limit_proj)

    # PASS 1 – tighten text, keep structure
    if pass_no == 1:
        cap_bullets("experience", 2)
        cap_bullets("projects", 2)
        shorten_summaries(180, 160)
        d["skills"] = (d.get("skills") or [])[:10]
        d["certifications"] = (d.get("certifications") or [])[:3]

    # PASS 2 – reduce section counts
    elif pass_no == 2:
        cap_bullets("experience", 2)
        cap_bullets("projects", 2)
        shorten_summaries(160, 140)
        d["experience"] = (d.get("experience") or [])[:2]
        d["projects"]   = (d.get("projects") or [])[:1]
        d["education"]  = (d.get("education") or [])[:1]
        d["certifications"] = (d.get("certifications") or [])[:2]
        d["skills"] = (d.get("skills") or [])[:9]

    # PASS 3 – aggressive: hide summary, drop extras
    elif pass_no == 3:
        cap_bullets("experience", 2)
        cap_bullets("projects", 1)
        shorten_summaries(140, 120)
        d["show_summary"] = False
        d["certifications"] = []
        d["publications"] = []
        d["projects"] = (d.get("projects") or [])[:1]
        d["experience"] = (d.get("experience") or [])[:2]
        d["education"] = (d.get("education") or [])[:1]
        d["skills"] = (d.get("skills") or [])[:8]

    # PASS 4 – final squeeze
    else:
        cap_bullets("experience", 1)
        cap_bullets("projects", 1)
        shorten_summaries(120, 100)
        d["projects"] = (d.get("projects") or [])[:1]
        d["experience"] = (d.get("experience") or [])[:2]
        d["education"] = (d.get("education") or [])[:1]
        d["skills"] = (d.get("skills") or [])[:6]
        d["certifications"] = []
        d["publications"] = []
        d["show_summary"] = False

    return d

def _compile_with_page_count(tex_str: str) -> Tuple[bytes, int]:
    """
    Compile LaTeX and return (pdf_bytes, pages) by parsing pdflatex stdout like:
    'Output written on resume.pdf (1 page, 12345 bytes).'
    """
    try:
        with tempfile.TemporaryDirectory() as tmpdir:
            tex_path = os.path.join(tmpdir, "resume.tex")
            with open(tex_path, "w", encoding="utf-8") as f:
                f.write(tex_str)

            last_stdout = b""
            # Typical two passes
            for _ in range(2):
                proc = subprocess.run(
                    ["pdflatex", "-interaction=nonstopmode", "resume.tex"],
                    cwd=tmpdir,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                )
                last_stdout = proc.stdout
                if proc.returncode != 0:
                    raise RuntimeError(
                        "LaTeX compilation failed:\n" + proc.stdout.decode("utf-8", "ignore")
                    )

            m = re.search(rb"\((\d+)\s+pages?\)", last_stdout)
            pages = int(m.group(1)) if m else 1

            pdf_path = os.path.join(tmpdir, "resume.pdf")
            if not os.path.exists(pdf_path):
                raise RuntimeError("LaTeX did not produce resume.pdf")

            with open(pdf_path, "rb") as pf:
                return pf.read(), pages

    except FileNotFoundError:
        raise HTTPException(status_code=500, detail="pdflatex is not installed or not in PATH")

def render_and_compile_one_page(env: Environment, data: Dict[str, Any]) -> bytes:
    """
    Render the template and compile. If >1 page, progressively shrink and retry.
    After standard passes, run an 'ultra squeeze' that *forces* one page,
    or raise a clear 400 error if somehow still too long.
    """
    try:
        template = env.get_template("resume.tex.jinja")
    except TemplateSyntaxError as e:
        raise HTTPException(
            status_code=400,
            detail=f"Template syntax error (resume.tex.jinja:{e.lineno}): {e.message}",
        )

    # Always enforce section order before attempts
    working = enforce_section_order(dict(data))

    # Standard shrinking passes
    for pass_no in (1, 2, 3, 4):
        tex_str = template.render(resume=working)
        pdf_bytes, pages = _compile_with_page_count(tex_str)
        if pages <= 1:
            return pdf_bytes
        # shrink and keep order
        working = enforce_section_order(_apply_shrink_pass(working, pass_no))

    # Ultra squeeze loop – guarantee single page
    for _ in range(3):
        working = _ultra_squeeze_to_one_page(working)
        tex_str = template.render(resume=working)
        pdf_bytes, pages = _compile_with_page_count(tex_str)
        if pages <= 1:
            return pdf_bytes

    # If we still can't get to 1 page, bail with a clear error
    raise HTTPException(status_code=400, detail="Content could not be constrained to one page.")

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
        cleaned = ensure_skill_rows(cleaned, text, job_desc=None)  # Gemini on resume text alone

        # Enforce final order for clients that rely on a fixed order
        cleaned = enforce_section_order(cleaned)

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

        # F) Compress for one page (static shaping)
        resume = ResumeInfo(**merged)
        data = compress_payload_for_one_page(resume.dict())

        # G) Ensure 3-row skills
        data = ensure_skill_rows(data, text, job_desc=jd)  # Gemini with JD

        # NEW: enforce the requested section order
        data = enforce_section_order(data)

        # H/I) Render + compile with strict one-page enforcement
        pdf_bytes = render_and_compile_one_page(env, data)
        # Use input file name + "_tellermade"
        filename = file.filename or "resume.pdf"
        base, ext = os.path.splitext(filename)
        suggested = f"{base}_tellermade.pdf"
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
        data = ensure_skill_rows(data, text, job_desc=req.job_desc)  # Gemini with JD

        # NEW: enforce requested order
        data = enforce_section_order(data)

        # Render + compile with strict one-page enforcement
        pdf_bytes = render_and_compile_one_page(env, data)
        # Use default name since no file upload; base it on resume content
        base = f"{data.get('first_name','Candidate')}_{data.get('last_name','Resume')}"
        suggested = f"{base}_tellermade.pdf"
        headers = {"Content-Disposition": f'attachment; filename="{suggested}"'}
        return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf", headers=headers)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")
