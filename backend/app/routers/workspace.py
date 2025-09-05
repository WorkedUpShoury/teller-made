# app/routers/workspace.py
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query

from ..normalizers import normalize_resume
from .versions import get_user_id, _udir
from .versions import _read_idx, _write_idx  # imported for completeness (not strictly required here)

router = APIRouter(prefix="/workspace", tags=["workspace"])

# ------------------------------------------------------------------------------
# Workspace meta model (stored alongside the current draft)
# ------------------------------------------------------------------------------
DEFAULT_META = {
    "rev": 0,                     # monotonically increasing revision
    "updatedAt": None,            # ISO timestamp
    "selectedVersionId": None,    # currently selected version (if any)
    "autosaveMode": "workspace",  # "workspace" | "overwrite_version" | "snapshot_on_save"
}

# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
def _current_paths(uid: str):
    """Return paths to current.json and current.meta.json for a user."""
    root = _udir(uid)
    return root / "current.json", root / "current.meta.json"


def _read_current(uid: str) -> Dict[str, Any]:
    """Read current workspace state (json + meta). Creates empty defaults if missing."""
    cur, meta = _current_paths(uid)

    # Default empty resume
    data = {"fullName": "", "email": "", "phone": "", "sections": []}
    if cur.exists():
        try:
            data = json.loads(cur.read_text("utf-8"))
        except Exception:
            # leave default data
            pass

    meta_obj = DEFAULT_META.copy()
    if meta.exists():
        try:
            m = json.loads(meta.read_text("utf-8"))
            # only accept known keys
            for k in DEFAULT_META.keys():
                if k in m:
                    meta_obj[k] = m[k]
        except Exception:
            pass

    return {
        "rev": meta_obj["rev"],
        "updatedAt": meta_obj["updatedAt"],
        "data": data,
        "selectedVersionId": meta_obj["selectedVersionId"],
        "autosaveMode": meta_obj["autosaveMode"],
    }


def _write_current(
    uid: str,
    data: Dict[str, Any],
    meta_overrides: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Write the current workspace resume + meta; bump rev, set updatedAt."""
    cur, meta = _current_paths(uid)
    now = datetime.now(timezone.utc).isoformat()

    current = _read_current(uid)
    rev = int(current["rev"]) + 1

    # Normalize and write resume JSON
    data = normalize_resume(data)
    cur.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")

    # Build meta to write
    meta_obj = DEFAULT_META.copy()
    meta_obj.update(
        {
            "rev": rev,
            "updatedAt": now,
            "selectedVersionId": current.get("selectedVersionId"),
            "autosaveMode": current.get("autosaveMode") or "workspace",
        }
    )
    if meta_overrides:
        meta_obj.update(meta_overrides)

    meta.write_text(json.dumps(meta_obj, ensure_ascii=False), encoding="utf-8")

    # Return the full state (including meta fields for convenience)
    return {
        "rev": rev,
        "updatedAt": now,
        "data": data,
        "selectedVersionId": meta_obj["selectedVersionId"],
        "autosaveMode": meta_obj["autosaveMode"],
    }


def _snapshot(uid: str, data: Dict[str, Any], name: Optional[str] = None) -> Dict[str, Any]:
    """Create a version snapshot by calling the versions.save logic directly."""
    # Import inside function to avoid circular import at module import time
    from .versions import save_version as _save_version_inner
    # Call the underlying FastAPI function with unwrapped callable to skip dependency injection
    return _save_version_inner(  # type: ignore[attr-defined]
        payload=data, name=name, uid=uid
    )


# ------------------------------------------------------------------------------
# Routes
# ------------------------------------------------------------------------------

@router.get("/get")
def workspace_get(uid: str = Depends(get_user_id)):
    """
    Get the current workspace (draft) JSON + meta for the authenticated user.
    """
    return _read_current(uid)


@router.post("/save")
def workspace_save(
    payload: Dict[str, Any] = Body(...),
    uid: str = Depends(get_user_id),
    # Optional optimistic concurrency: client sends last-known rev
    x_resume_rev: Optional[int] = Header(None, convert_underscores=False),
    # Optional query params to also snapshot on save
    snapshot: Optional[bool] = Query(default=False),
    name: Optional[str] = Query(default=None),
):
    """
    Save/overwrite the current workspace JSON. Bumps revision.
    If X-Resume-Rev header is provided and mismatches, returns 409.
    Optionally creates a version snapshot (?snapshot=1&name=...).
    """
    current = _read_current(uid)
    if x_resume_rev is not None and int(x_resume_rev) != int(current["rev"]):
        raise HTTPException(status_code=409, detail={"error": "rev_conflict", "serverRev": current["rev"]})

    out = _write_current(uid, payload)

    snap = _snapshot(uid, out["data"], name) if snapshot else None
    return {
        "rev": out["rev"],
        "updatedAt": out["updatedAt"],
        "snapshot": snap,
        "selectedVersionId": out["selectedVersionId"],
        "autosaveMode": out["autosaveMode"],
    }


@router.post("/snapshot")
def workspace_snapshot(
    name: Optional[str] = Query(default=None),
    uid: str = Depends(get_user_id),
):
    """
    Create a version snapshot from the current workspace JSON.
    """
    cur = _read_current(uid)
    snap = _snapshot(uid, cur["data"], name)
    return {"snapshot": snap, "rev": cur["rev"], "updatedAt": cur["updatedAt"]}


@router.post("/select")
def workspace_select(
    version_id: Optional[str] = Query(default=None),
    uid: str = Depends(get_user_id),
):
    """
    Select a version to load into the workspace and mark as selected.
    Pass no version_id to clear selection (start fresh with current data).
    """
    if version_id:
        vp = _udir(uid) / f"{version_id}.json"
        if not vp.exists():
            raise HTTPException(status_code=404, detail="Version not found")
        data = json.loads(vp.read_text("utf-8"))
        out = _write_current(uid, data, meta_overrides={"selectedVersionId": version_id})
        return {
            "ok": True,
            "selectedVersionId": version_id,
            "rev": out["rev"],
            "updatedAt": out["updatedAt"],
            "autosaveMode": out["autosaveMode"],
        }
    else:
        # Clear selection; keep current data as-is
        cur = _read_current(uid)
        out = _write_current(uid, cur["data"], meta_overrides={"selectedVersionId": None})
        return {
            "ok": True,
            "selectedVersionId": None,
            "rev": out["rev"],
            "updatedAt": out["updatedAt"],
            "autosaveMode": out["autosaveMode"],
        }


@router.post("/mode")
def workspace_mode(
    mode: str = Query(..., description="workspace | overwrite_version | snapshot_on_save"),
    uid: str = Depends(get_user_id),
):
    """
    Set autosave mode for the workspace:
      - 'workspace'         : only workspace is updated
      - 'overwrite_version' : if a version is selected, also overwrite that version file
      - 'snapshot_on_save'  : also create a version snapshot on each save/patch
    """
    if mode not in ("workspace", "overwrite_version", "snapshot_on_save"):
        raise HTTPException(status_code=400, detail="Invalid mode")

    cur = _read_current(uid)
    out = _write_current(uid, cur["data"], meta_overrides={"autosaveMode": mode})
    return {
        "ok": True,
        "autosaveMode": mode,
        "rev": out["rev"],
        "updatedAt": out["updatedAt"],
        "selectedVersionId": out["selectedVersionId"],
    }
