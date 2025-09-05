from __future__ import annotations
import json
from pathlib import Path
from uuid import uuid4
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, Header, HTTPException, Body
from ..normalizers import normalize_resume

router = APIRouter(prefix="/versions", tags=["versions"])
ROOT = Path("data/versions")

def get_user_id(x_user_id: Optional[str] = Header(None)) -> str:
    return x_user_id or "demo"

def _udir(uid: str) -> Path:
    p = ROOT / uid
    p.mkdir(parents=True, exist_ok=True)
    return p

def _idx(uid: str) -> Path: return _udir(uid) / "index.json"

def _read_idx(uid: str) -> List[Dict[str, Any]]:
    p = _idx(uid)
    if not p.exists(): return []
    try: return json.loads(p.read_text("utf-8"))
    except: return []

def _write_idx(uid: str, rows: List[Dict[str, Any]]):
    _idx(uid).write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")

@router.get("/list")
def list_versions(uid: str = Depends(get_user_id)):
    return _read_idx(uid)

@router.get("/load/{vid}")
def load_version(vid: str, uid: str = Depends(get_user_id)):
    p = _udir(uid) / f"{vid}.json"
    if not p.exists(): raise HTTPException(404, "Version not found")
    data = json.loads(p.read_text("utf-8"))
    return normalize_resume(data)

@router.post("/save")
def save_version(
    payload: Dict[str, Any] = Body(...),
    name: Optional[str] = None,
    uid: str = Depends(get_user_id),
):
    data = normalize_resume(payload)
    vid = str(uuid4())
    created = datetime.now(timezone.utc).isoformat()
    meta = {"id": vid, "name": name or f"Resume {created[:10]}", "createdAt": created}

    (_udir(uid) / f"{vid}.json").write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    rows = _read_idx(uid); rows.insert(0, meta); _write_idx(uid, rows)
    return meta

@router.delete("/delete/{vid}")
def delete_version(vid: str, uid: str = Depends(get_user_id)):
    rows = [r for r in _read_idx(uid) if r["id"] != vid]
    _write_idx(uid, rows)
    p = _udir(uid) / f"{vid}.json"
    if p.exists(): p.unlink()
    return {"ok": True}

@router.post("/overwrite/{vid}")
def overwrite_version(vid: str, payload: Dict[str, Any] = Body(...), uid: str = Depends(get_user_id)):
    p = _udir(uid) / f"{vid}.json"
    if not p.exists():
        raise HTTPException(404, "Version not found")
    data = normalize_resume(payload)
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return {"ok": True, "id": vid}
