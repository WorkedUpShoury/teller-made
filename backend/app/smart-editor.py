from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Any, Dict

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from jinja2 import Environment, FileSystemLoader, TemplateError
from dateutil import parser as dateparser

# --------------------------------------------------------------------------------------
# App + CORS
# --------------------------------------------------------------------------------------
app = FastAPI(title="ResumeBuilder Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:3000",
        "http://127.0.0.1",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------------------
# Jinja2 environment with LaTeX-safe filters
# --------------------------------------------------------------------------------------
TEMPLATE_DIR = Path("app/templates")
TEMPLATE_NAME = "editor.tex.jinja"  # unified with the comment above

LATEX_SPECIALS = {
    "\\": r"\textbackslash{}",
    "{": r"\{",
    "}": r"\}",
    "#": r"\#",
    "$": r"\$",
    "%": r"\%",
    "&": r"\&",
    "_": r"\_",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}


def latex_escape(text: Any) -> str:
    """Escape user-provided text for LaTeX. Non-strings become strings.
    Use this for normal text content (NOT for URLs inside \\url{...}).
    """
    if text is None:
        return ""
    s = str(text)
    out = []
    for ch in s:
        out.append(LATEX_SPECIALS.get(ch, ch))
    return "".join(out)


def fmt_month(value: str | None) -> str:
    """Format 'YYYY-MM' (or other parseable date) as 'Mon YYYY'."""
    if not value:
        return ""
    try:
        # Frontend uses <input type="month">, typically 'YYYY-MM'
        dt = dateparser.parse(value + "-01" if len(value) == 7 else value)
        return dt.strftime("%b %Y")
    except Exception:
        return latex_escape(value)


def date_range(start: str | None, end: str | None, current: bool | None) -> str:
    """Return a human-readable date range for LaTeX (e.g., 'Jan 2022 — Present')."""
    s = fmt_month(start)
    e = "Present" if current else fmt_month(end)
    return " — ".join([p for p in (s, e) if p])


def build_env() -> Environment:
    env = Environment(
        loader=FileSystemLoader(str(TEMPLATE_DIR)),
        autoescape=False,
        trim_blocks=True,
        lstrip_blocks=True
    )
    env.filters["tex"] = latex_escape
    env.filters["fmt_month"] = fmt_month
    env.filters["date_range"] = lambda item: date_range(
        item.get("start"), item.get("end"), item.get("current")
    )
    return env


# Minimal fallback LaTeX template (very small), used only if file is missing
FALLBACK_TEMPLATE = r"""
% Fallback minimal template so you can test immediately.
% For your production template, create templates/resume.tex.jinja and use the same variable names.
\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{hyperref}
\hypersetup{colorlinks=true, urlcolor=blue}
\begin{document}
\begin{center}
  {\LARGE {{ form.fullName|tex }}}\\
  {% if form.title %}{{ form.title|tex }}\\{% endif %}
  {{ form.email|tex }} \textbullet{} {{ form.phone|tex }}{% if form.location %} \textbullet{} {{ form.location|tex }}{% endif %}\\
  {% if form.profiles %}
    {% for p in form.profiles if p.label or p.url %}
      {% if p.url %}\href{ {{ p.url }} }{ {{ (p.label or p.url)|tex }} }{% else %}{{ p.label|tex }}{% endif %}
      {% if not loop.last %}\,\textbullet\, {% endif %}
    {% endfor %}
  {% endif %}
\end{center}

{% if form.summary %}\section*{Summary}
{{ form.summary|tex }}
{% endif %}

{% if form.skills %}\section*{Skills}
{{ (", ".join(form.skills))|tex }}
{% endif %}

{% for sec in form.sections %}
  \section*{ {{ (sec.title or sec.type)|tex }} }
  {% set t = sec.type %}
  {% for it in sec.items %}
    {% if t in ["experience", "volunteer"] %}
      \textbf{ {{ (it.role or '')|tex }} }\,---\, {{ (it.company or it.organization or '')|tex }}{% if it.location %}, {{ it.location|tex }}{% endif %} \hfill {{ it | date_range }}\\
      {% if it.bullets %}\begin{itemize}
        {% for b in it.bullets if b %}\item {{ b|tex }}{% endfor %}
      \end{itemize}{% endif %}
    {% elif t == "projects" %}
      \textbf{ {% if it.link %}\href{ {{ it.link }} }{ {{ (it.name or 'Project')|tex }} }{% else %}{{ (it.name or 'Project')|tex }}{% endif %} } --- {{ (it.summary or '')|tex }}\\
      {% if it.bullets %}\begin{itemize}
        {% for b in it.bullets if b %}\item {{ b|tex }}{% endfor %}
      \end{itemize}{% endif %}
    {% elif t == "education" %}
      \textbf{ {{ (it.degree or '')|tex }}{% if it.field %} in {{ it.field|tex }}{% endif %} } --- {{ (it.school or '')|tex }}{% if it.location %}, {{ it.location|tex }}{% endif %} \hfill {{ it.start|fmt_month }}{% if it.end %} — {{ it.end|fmt_month }}{% endif %}\\
      {% if it.score %}Score: {{ it.score|tex }}\\{% endif %}
    {% elif t == "skillsets" %}
      \begin{itemize}
        {% for label, key in [("Languages","languages"),("Soft Skills","soft"),("Concepts","concepts"),("Tools","tools"),("Platforms","platforms")] %}
          {% if it[key] %}\item \textbf{ {{ label|tex }}:} {{ (", ".join(it[key]))|tex }}{% endif %}
        {% endfor %}
      \end{itemize}
    {% else %}
      % Generic fallback line for other sections
      {% if it.title or it.name %}\textbf{ {{ (it.title or it.name)|tex }} }{% endif %}
      {% if it.summary %} --- {{ it.summary|tex }}{% endif %}\\
      {% if it.bullets %}\begin{itemize}
        {% for b in it.bullets if b %}\item {{ b|tex }}{% endfor %}
      \end{itemize}{% endif %}
    {% endif %}
  {% endfor %}
{% endfor %}

\end{document}
"""


def load_template() -> str:
    """Return the Jinja template text (file or fallback)."""
    file_path = TEMPLATE_DIR / TEMPLATE_NAME
    if file_path.exists():
        return file_path.read_text(encoding="utf-8")
    return FALLBACK_TEMPLATE


# --------------------------------------------------------------------------------------
# Helpers: compilation
# --------------------------------------------------------------------------------------
def _has_cmd(cmd: str) -> bool:
    return shutil.which(cmd) is not None


def compile_pdf(tex_source: str) -> bytes:
    """Compile LaTeX to PDF and return bytes. Prefer Tectonic -> latexmk -> pdflatex.
    Raises HTTPException 500 on failure with log output.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        tex_path = tmp / "resume.tex"
        tex_path.write_text(tex_source, encoding="utf-8")

        logs = ""
        try:
            if _has_cmd("tectonic"):
                cmd = ["tectonic", "--keep-intermediates", "--keep-logs", tex_path.name]
            elif _has_cmd("latexmk"):
                cmd = ["latexmk", "-pdf", "-interaction=nonstopmode", tex_path.name]
            elif _has_cmd("pdflatex"):
                cmd = ["pdflatex", "-interaction=nonstopmode", tex_path.name]
            else:
                raise RuntimeError("No LaTeX engine found. Install 'tectonic' or TeX Live (latexmk/pdflatex).")

            proc = subprocess.run(
                cmd,
                cwd=tmp,
                capture_output=True,
                text=True,
                timeout=180,
                check=False,
            )
            logs = (proc.stdout or "") + "\n" + (proc.stderr or "")
            if proc.returncode != 0:
                raise RuntimeError(f"LaTeX compilation failed with code {proc.returncode}.")

            pdf_path = tmp / "resume.pdf"
            if not pdf_path.exists():
                raise RuntimeError("PDF not generated.")
            return pdf_path.read_bytes()
        except Exception as exc:
            # Attempt to read .log if present for better diagnostics
            log_path = tmp / "resume.log"
            if log_path.exists():
                try:
                    logs += "\n\n" + log_path.read_text(errors="ignore")
                except Exception:
                    pass
            raise HTTPException(status_code=500, detail={"error": str(exc), "log": logs[-8000:]})


# --------------------------------------------------------------------------------------
# Rendering
# --------------------------------------------------------------------------------------
def render_tex(form: Dict[str, Any]) -> str:
    env = build_env()
    template_src = load_template()
    template = env.from_string(template_src)
    # Hand to template as `form`
    return template.render(form=form)


# --------------------------------------------------------------------------------------
# Routes
# --------------------------------------------------------------------------------------
@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/render/latex")
def render_latex(form: Dict[str, Any]) -> Response:
    try:
        tex = render_tex(form)
        headers = {"Content-Disposition": "attachment; filename=resume.tex"}
        # application/x-latex is also acceptable
        return Response(content=tex.encode("utf-8"), media_type="application/x-tex", headers=headers)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/render/pdf")
def render_pdf(form: Dict[str, Any]) -> Response:
    try:
        tex = render_tex(form)
        pdf_bytes = compile_pdf(tex)
        headers = {"Content-Disposition": "attachment; filename=resume.pdf"}
        return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/export/json")
def export_json(form: Dict[str, Any]) -> Response:
    try:
        payload = json.dumps(form, ensure_ascii=False, indent=2).encode("utf-8")
        headers = {"Content-Disposition": "attachment; filename=resume.json"}
        return Response(content=payload, media_type="application/json", headers=headers)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


# --------------------------------------------------------------------------------------
# Tiny sample template snippet you can use when authoring templates/resume.tex.jinja
# --------------------------------------------------------------------------------------
SAMPLE_SNIPPET = r"""
% Place this in templates/resume.tex.jinja and expand as needed.
% Use the Jinja filters defined in server:  |tex, |fmt_month, and the callable item|date_range
% Requires: \usepackage{hyperref}
\documentclass[11pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage[T1]{fontenc}
\usepackage{hyperref}
\begin{document}
\section*{ {{ form.fullName|tex }} {% if form.title %} -- {{ form.title|tex }} {% endif %} }
{{ form.email|tex }} \textbullet{} {{ form.phone|tex }} {% if form.location %} \textbullet{} {{ form.location|tex }} {% endif %}\\
{% if form.profiles %}{% for p in form.profiles if p.url or p.label %}{% if p.url %}\href{ {{ p.url }} }{ {{ (p.label or p.url)|tex }} }{% else %}{{ p.label|tex }}{% endif %}{% if not loop.last %} \textbullet{} {% endif %}{% endfor %}{% endif %}

{% if form.summary %}\section*{Summary}\noindent {{ form.summary|tex }}{% endif %}

{% for sec in form.sections %}
  \section*{ {{ (sec.title or sec.type)|tex }} }
  {% for it in sec.items %}
    {% if sec.type == 'experience' %}
      \textbf{ {{ (it.role or '')|tex }} }, {{ (it.company or '')|tex }} {% if it.location %}({{ it.location|tex }}){% endif %} \hfill {{ it|date_range }}\\
      {% if it.bullets %}\begin{itemize}{% for b in it.bullets if b %}\item {{ b|tex }}{% endfor %}\end{itemize}{% endif %}
    {% endif %}
  {% endfor %}
{% endfor %}
\end{document}
"""

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
