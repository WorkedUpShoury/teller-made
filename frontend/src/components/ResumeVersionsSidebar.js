import React, { useEffect, useState } from "react";
import "./ResumeVersionsSidebar.css"; // ✅ Import external CSS

// Point directly at FastAPI; keep overrideable via env
const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

function authHeaders() {
  const token = localStorage.getItem("token");
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function fetchJSON(path, init = {}) {
  // Support both absolute and relative paths
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers || {}) },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status} ${res.statusText}`);
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export default function ResumeVersionsSidebar({
  className = "",
  currentJson,
  onSelect,
  onAfterSave,
  showModeControls = true,
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [ws, setWs] = useState(null);
  const [err, setErr] = useState("");

  const loadVersions = async () => {
    setLoading(true);
    try {
      const rows = await fetchJSON("/api/versions/list");
      setVersions(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error(e);
      setErr(String(e.message || e));
    } finally {
      setLoading(false);
    }
  };

  const loadWorkspace = async () => {
    try {
      const s = await fetchJSON("/api/workspace/get");
      setWs(s);
    } catch (e) {
      console.error("workspace/get failed", e);
      setErr(String(e.message || e));
    }
  };

  const save = async () => {
    if (!currentJson) return;
    setSaving(true);
    setErr("");
    try {
      const q = name ? `?snapshot=1&name=${encodeURIComponent(name)}` : "";
      const meta = await fetchJSON(`/api/workspace/save${q}`, {
        method: "POST",
        body: JSON.stringify(currentJson),
      });
      setName("");
      await Promise.all([loadVersions(), loadWorkspace()]);
      onAfterSave && onAfterSave(meta);
    } catch (e) {
      console.error(e);
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const open = async (id) => {
    setErr("");
    try {
      await fetchJSON(`/api/workspace/select?version_id=${encodeURIComponent(id)}`, { method: "POST" });
      const json = await fetchJSON(`/api/versions/load/${encodeURIComponent(id)}`);
      const meta = versions.find((v) => v.id === id) || { id };
      onSelect && onSelect(json, meta);
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setErr(String(e.message || e));
    }
  };

  const remove = async (id) => {
    setErr("");
    try {
      if (!window.confirm("Delete this version?")) return;
      await fetchJSON(`/api/versions/delete/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadVersions();
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setErr(String(e.message || e));
    }
  };

  const setMode = async (mode) => {
    setErr("");
    try {
      await fetchJSON(`/api/workspace/mode?mode=${encodeURIComponent(mode)}`, { method: "POST" });
      await loadWorkspace();
    } catch (e) {
      console.error(e);
      setErr(String(e.message || e));
    }
  };

  useEffect(() => {
    loadVersions();
    loadWorkspace();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mode = ws?.autosaveMode || "workspace";
  const selectedVersionId = ws?.selectedVersionId || null;

  return (
    <aside className={`rvp-sidebar ${className}`}>
      <div className="rvp-head">
        <div className="rvp-title-wrap">
          <div className="rvp-icon">TM</div>
          <div>
            <div className="rvp-title">Resume Versions</div>
            <div className="rvp-subtle">
              {selectedVersionId ? `Selected: ${String(selectedVersionId).slice(0, 8)}…` : "Selected: (none)"}
            </div>
          </div>
        </div>
      </div>

      {err ? <div className="rvp-error" role="alert">{err}</div> : null}

      <div className="rvp-save">
        <input
          className="rvp-input"
          placeholder="Snapshot name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button
          className="rvp-btn rvp-btn-primary"
          disabled={saving || !currentJson}
          onClick={save}
          title={currentJson ? "Save current" : "Nothing to save"}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {showModeControls && (
        <div className="rvp-modes">
          <div className="rvp-modes-title">Autosave</div>
          <div className="rvp-modes-row">
            <label className="rvp-radio">
              <input
                type="radio"
                name="mode"
                checked={mode === "workspace"}
                onChange={() => setMode("workspace")}
              />
              <span>Workspace only</span>
            </label>
            <label className="rvp-radio" title="If a version is selected, also overwrite it on each save/patch">
              <input
                type="radio"
                name="mode"
                checked={mode === "overwrite_version"}
                onChange={() => setMode("overwrite_version")}
              />
              <span>Overwrite selected</span>
            </label>
            <label className="rvp-radio" title="Create a new snapshot on each save/patch">
              <input
                type="radio"
                name="mode"
                checked={mode === "snapshot_on_save"}
                onChange={() => setMode("snapshot_on_save")}
              />
              <span>Snapshot on save</span>
            </label>
          </div>
        </div>
      )}

      <div className="rvp-list">
        {loading && <div className="rvp-muted">Loading…</div>}
        {!loading && !versions.length && <div className="rvp-muted">No versions yet</div>}

        {versions.map((v) => (
          <div className={`rvp-item ${v.id === selectedVersionId ? "rvp-selected" : ""}`} key={v.id}>
            <button className="rvp-item-main" onClick={() => open(v.id)} title="Load this version">
              <div className="rvp-item-title">
                <span className="rvp-dot" />
                {v.name || v.id}
              </div>
              <div className="rvp-sub">{new Date(v.createdAt).toLocaleString()}</div>
            </button>
            <button className="rvp-del" onClick={() => remove(v.id)} title="Delete version">
              🗑
            </button>
          </div>
        ))}
      </div>
    </aside>
  );
}
