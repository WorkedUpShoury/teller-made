import React, { useEffect, useState, useMemo } from "react";
import "./ResumeVersionsSidebar.css";

const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";

function authHeaders() {
  const token = localStorage.getItem("token");
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function fetchJSON(path, init = {}) {
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
  onClose, // Accept the onClose prop for the close button
}) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [ws, setWs] = useState(null);
  const [err, setErr] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [saveAction, setSaveAction] = useState("new");
  const [searchTerm, setSearchTerm] = useState("");

  const loadVersions = async () => {
    setLoading(true);
    try {
      const data = await fetchJSON("/api/versions/list");
      setVersions(Array.isArray(data.versions) ? data.versions : []);
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

  const createNewVersion = async () => {
    if (!currentJson) return;
    setSaving(true);
    setErr("");
    try {
      const q = name ? `?snapshot=1&name=${encodeURIComponent(name)}` : "?snapshot=1";
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
  
  const overwriteVersion = async () => {
    if (!selectedVersionId || !currentJson) return;
    setSaving(true);
    setErr("");
    try {
      await fetchJSON(`/api/versions/overwrite/${selectedVersionId}`, {
        method: "POST",
        body: JSON.stringify(currentJson),
      });
      onAfterSave && onAfterSave({ id: selectedVersionId });
    } catch (e) {
      console.error(e);
      setErr(String(e.message || e));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    if (saveAction === 'new') {
      createNewVersion();
    } else if (saveAction === 'overwrite') {
      overwriteVersion();
    }
  };

  const open = async (id) => {
    if (editingId) return;
    setErr("");
    try {
      await fetchJSON(`/api/workspace/select?version_id=${encodeURIComponent(id)}`, { method: "POST" });
      const json = await fetchJSON(`/api/versions/load/${encodeURIComponent(id)}`);
      onSelect && onSelect(json.data, json);
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

  const handleRename = async (version) => {
    if (editingName === version.name) {
        setEditingId(null);
        return;
    }
    setErr("");
    try {
        await fetchJSON(`/api/versions/rename/${version.id}`, {
            method: "PATCH",
            body: JSON.stringify({ new_name: editingName }),
        });
        await loadVersions();
    } catch(e) {
        console.error(e);
        setErr(String(e.message || e));
    } finally {
        setEditingId(null);
        setEditingName("");
    }
  };

  const startEditing = (version) => {
    setEditingId(version.id);
    setEditingName(version.name || "");
  };

  const handleEditKeyDown = (e, version) => {
    if (e.key === 'Enter') handleRename(version);
    else if (e.key === 'Escape') setEditingId(null);
  };

  useEffect(() => {
    loadVersions();
    loadWorkspace();
  }, []);

  const selectedVersionId = ws?.selectedVersionId || null;

  const filteredVersions = useMemo(() => {
    if (!searchTerm) {
      return versions;
    }
    return versions.filter(v =>
      (v.name || v.id).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [versions, searchTerm]);

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
        {/* The button that calls the onClose prop from the parent */}
        <button onClick={onClose} className="rvp-close-btn" title="Close">
          &times;
        </button>
      </div>

      {err ? <div className="rvp-error" role="alert">{err}</div> : null}

      <div className="rvp-save">
        <input
          className="rvp-input"
          placeholder="New version name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="rvp-modes-row">
          <label className="rvp-radio">
            <input
              type="radio" name="saveAction" value="new"
              checked={saveAction === 'new'} onChange={() => setSaveAction('new')}
            />
            <span>Save as New</span>
          </label>
          <label className={`rvp-radio ${!selectedVersionId ? 'rvp-disabled' : ''}`}>
            <input
              type="radio" name="saveAction" value="overwrite"
              checked={saveAction === 'overwrite'} onChange={() => setSaveAction('overwrite')}
              disabled={!selectedVersionId}
            />
            <span>Overwrite Selected</span>
          </label>
        </div>
        <button
          className="rvp-btn rvp-btn-primary"
          disabled={saving || !currentJson || (saveAction === 'overwrite' && !selectedVersionId)}
          onClick={handleSaveClick}
          title={!currentJson ? "Nothing to save" : "Apply the selected action"}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
      
      <div className="rvp-search-container">
        <input
          type="text"
          placeholder="Search versions..."
          className="rvp-input"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="rvp-list-container">
        {loading && <div className="rvp-muted">Loading…</div>}
        {!loading && !versions.length && <div className="rvp-muted">No versions yet</div>}
        {!loading && versions.length > 0 && !filteredVersions.length && <div className="rvp-muted">No versions match your search</div>}

        {filteredVersions.map((v) => (
          <div className={`rvp-item ${v.id === selectedVersionId ? "rvp-selected" : ""}`} key={v.id}>
            <div className="rvp-item-main" onClick={() => open(v.id)} title="Load this version">
              <div className="rvp-item-title" onDoubleClick={() => startEditing(v)}>
                <span className="rvp-dot" />
                {editingId === v.id ? (
                  <input
                    type="text" className="rvp-edit-input" value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => handleRename(v)} onKeyDown={(e) => handleEditKeyDown(e, v)}
                    onClick={(e) => e.stopPropagation()} autoFocus
                  />
                ) : ( v.name || v.id )}
              </div>
              <div className="rvp-sub">{new Date(v.created_at || v.createdAt).toLocaleString()}</div>
            </div>
            <button className="rvp-del" onClick={() => remove(v.id)} title="Delete version">🗑</button>
          </div>
        ))}
      </div>
    </aside>
  );
}