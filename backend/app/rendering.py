# app/rendering.py
from __future__ import annotations
import shutil, subprocess, tempfile
from pathlib import Path
from typing import Any, Dict
from jinja2 import Environment, FileSystemLoader
from fastapi import HTTPException
from dateutil import parser as dateparser

TEMPLATES = Path(__file__).parent / "templates"
TEMPLATE_NAME = "editor.tex.jinja"

LATEX_SPECIALS = {
    "\\": r"\textbackslash{}", "{": r"\{", "}": r"\}",
    "#": r"\#", "$": r"\$", "%": r"\%", "&": r"\&",
    "_": r"\_", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
}

def latex_escape(text: Any) -> str:
    if text is None: return ""
    s = str(text)
    return "".join(LATEX_SPECIALS.get(ch, ch) for ch in s)

def fmt_month(value: str | None) -> str:
    if not value: return ""
    try:
        dt = dateparser.parse(value + "-01" if len(value) == 7 else value)
        return dt.strftime("%b %Y")
    except Exception:
        return latex_escape(value)

def date_range(item: Dict[str, Any]) -> str:
    s = fmt_month(item.get("start"))
    e = "Present" if item.get("current") else fmt_month(item.get("end"))
    return " — ".join([p for p in (s, e) if p])

def build_env() -> Environment:
    env = Environment(loader=FileSystemLoader(str(TEMPLATES)), autoescape=False, trim_blocks=True, lstrip_blocks=True)
    env.filters["tex"] = latex_escape
    env.filters["fmt_month"] = fmt_month
    env.filters["date_range"] = date_range
    return env

def load_template() -> str:
    p = TEMPLATES / TEMPLATE_NAME
    return p.read_text("utf-8") if p.exists() else r"% Missing editor.tex.jinja"

def render_tex(form: Dict[str, Any]) -> str:
    env = build_env()
    tpl = env.from_string(load_template())
    return tpl.render(form=form)

def _has(cmd: str) -> bool:
    return shutil.which(cmd) is not None

def compile_pdf(tex: str) -> bytes:
    with tempfile.TemporaryDirectory() as tmpd:
        tmp = Path(tmpd)
        (tmp / "resume.tex").write_text(tex, encoding="utf-8")
        logs = ""
        try:
            if _has("tectonic"):
                cmd = ["tectonic","--keep-intermediates","--keep-logs","resume.tex"]
            elif _has("latexmk"):
                cmd = ["latexmk","-pdf","-interaction=nonstopmode","resume.tex"]
            elif _has("pdflatex"):
                cmd = ["pdflatex","-interaction=nonstopmode","resume.tex"]
            else:
                raise RuntimeError("No LaTeX engine (tectonic/latexmk/pdflatex) found.")
            proc = subprocess.run(cmd, cwd=tmp, capture_output=True, text=True, timeout=180)
            logs = (proc.stdout or "") + "\n" + (proc.stderr or "")
            if proc.returncode != 0: raise RuntimeError(f"latex failed ({proc.returncode})")
            pdf = tmp / "resume.pdf"
            if not pdf.exists(): raise RuntimeError("PDF not generated.")
            return pdf.read_bytes()
        except Exception as e:
            log = tmp / "resume.log"
            if log.exists():
                try: logs += "\n\n" + log.read_text(errors="ignore")
                except: pass
            raise HTTPException(status_code=500, detail={"error": str(e), "log": logs[-8000:]})
