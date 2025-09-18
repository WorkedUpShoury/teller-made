# app/routers/patch.py
from __future__ import annotations

import base64
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from ..models.schemas import PatchRequest, PatchResponse, ResumeForm
from ..normalizers import normalize_resume
from ..patching import apply_json_patch
from ..rendering import render_tex, compile_pdf
from .workspace import _read_current, _write_current, _snapshot
from .versions import get_user_id
from .versions import overwrite_version as _overwrite_version_inner  # reuse logic

router = APIRouter(prefix="/resume", tags=["patch"])


@router.post("/patch", response_model=PatchResponse)
def resume_patch(
    req: PatchRequest,
    uid: str = Depends(get_user_id),
    # Optional concurrency header from client
    x_resume_rev: Optional[int] = Header(None, convert_underscores=False),
    # Optional query flags to snapshot with a friendly name
    snapshot: Optional[bool] = Query(default=False),
    name: Optional[str] = Query(default=None),
):
    """
    Apply RFC6902 patch ops to a resume JSON, auto-save to workspace, and (optionally)
    overwrite the selected version or snapshot depending on autosave mode.

    Request:
      - body: PatchRequest { base?: ResumeForm, ops: JsonPatchOp[], render?: "none"|"tex"|"pdf"|"both" }
      - headers: X-Resume-Rev (optional optimistic concurrency)
      - query: snapshot=1 (optional), name="..." (optional)

    Behavior:
      - If req.base is missing, use workspace current as the base.
      - Always saves the updated JSON to workspace and bumps rev.
      - If workspace autosaveMode == "overwrite_version" and a selectedVersionId exists,
        also overwrites that version file.
      - If autosaveMode == "snapshot_on_save" OR snapshot=1 is passed, also snapshot.
      - If render is "tex"/"pdf"/"both", returns rendered outputs.
    """
    try:
        # --- 1) Determine base doc & check concurrency against workspace ---
        ws_state = _read_current(uid)
        base_doc = req.base.dict() if req.base else ws_state["data"]

        if x_resume_rev is not None and int(x_resume_rev) != int(ws_state["rev"]):
            # Client's base is stale vs current workspace
            raise HTTPException(
                status_code=409,
                detail={"error": "rev_conflict", "serverRev": ws_state["rev"]},
            )

        # Normalize the base and apply ops (RFC6902)
        base_norm = normalize_resume(base_doc)
        ops = [o.dict(by_alias=True) for o in req.ops]
        updated = apply_json_patch(base_norm, ops)
        updated = normalize_resume(updated)

        # --- 2) Always save updated JSON to workspace (bumps rev) ---
        saved_ws = _write_current(uid, updated)

        # --- 3) Autosave behavior (overwrite or snapshot) ---
        mode = saved_ws.get("autosaveMode") or "workspace"
        selected_vid = saved_ws.get("selectedVersionId")

        # Overwrite the selected version file if mode demands and a selection exists
        if mode == "overwrite_version" and selected_vid:
            # Call the FastAPI function implementation directly (bypass DI) using __wrapped__
            _overwrite_version_inner(
                vid=selected_vid, payload=updated, uid=uid
            )


        # Snapshot on save if mode requires OR explicit snapshot query param is set
        if mode == "snapshot_on_save" or snapshot:
            _snapshot(uid, updated, name)

        # --- 4) Build response (with optional render) ---
        out: dict = {"updated": ResumeForm(**updated)}
        if req.render in ("tex", "both"):
            out["rendered_tex"] = render_tex(updated)
        if req.render in ("pdf", "both"):
            # Reuse tex if already rendered; otherwise render fresh
            tex = out.get("rendered_tex") or render_tex(updated)
            pdf_bytes = compile_pdf(tex)
            out["rendered_pdf_b64"] = base64.b64encode(pdf_bytes).decode("ascii")

        return out

    except HTTPException:
        # Bubble FastAPI HTTP errors (e.g., conflicts) unchanged
        raise
    except Exception as e:
        # Any other unexpected error
        raise HTTPException(status_code=400, detail=str(e))
