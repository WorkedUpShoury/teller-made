// =============================
// ResumeBuilder.jsx (FULL, updated)
// =============================
import React, { useMemo, useState } from "react";
import "./ResumeBuilder.css";

// Preset options for categorized skills
const SKILL_OPTIONS = {
  languages: ["Python", "TypeScript", "Java", "C++", "Go", "Rust", "SQL", "R", "Scala", "Kotlin"],
  soft: ["Leadership", "Communication", "Mentoring", "Collaboration", "Problem-Solving", "Time Management"],
  concepts: ["OOP", "Functional Programming", "Distributed Systems", "ML", "DL", "NLP", "Data Engineering"],
  tools: ["Git", "Docker", "Kubernetes", "Terraform", "Jenkins", "Airflow", "Snowflake", "Spark"],
  platforms: ["AWS", "GCP", "Azure", "Linux", "iOS", "Android", "Salesforce"],
};

// --- Section templates ------------------------------------------------------
// Each template defines the fields for an item inside a section and
// how it should render to Markdown (for preview) and LaTeX (via backend).
const SECTION_TEMPLATES = {
  experience: {
    name: "Experience",
    itemFields: [
      { key: "company", label: "Company", type: "text" },
      { key: "role", label: "Role / Title", type: "text" },
      { key: "location", label: "Location", type: "text" },
      { key: "start", label: "Start", type: "month" },
      { key: "end", label: "End", type: "month", dependsOn: { key: "current", value: false } },
      { key: "current", label: "Current", type: "checkbox" },
    ],
    bullets: true,
    md: (it) => {
      if (!(it.company || it.role)) return null;
      const dates = formatDates(it.start, it.end, it.current);
      return `**${it.role || ""}**, ${it.company || ""}${it.location ? " — " + it.location : ""}  _${dates}_`;
    },
  },
  projects: {
    name: "Projects",
    itemFields: [
      { key: "name", label: "Name", type: "text" },
      { key: "link", label: "Link", type: "url" },
      { key: "summary", label: "One-line summary", type: "text" },
    ],
    bullets: true,
    md: (it) => {
      if (!(it.name || it.summary)) return null;
      const title = it.link ? `[${it.name || "Project"}](${it.link})` : it.name || "Project";
      return `**${title}** — ${it.summary || ""}`;
    },
  },
  education: {
    name: "Education",
    itemFields: [
      { key: "school", label: "School", type: "text" },
      { key: "degree", label: "Degree", type: "text" },
      { key: "field", label: "Field", type: "text" },
      { key: "start", label: "Start", type: "month" },
      { key: "end", label: "End", type: "month" },
      { key: "location", label: "Location", type: "text" },
      { key: "score", label: "Score (GPA/%)", type: "text" },
    ],
    bullets: false,
    md: (it) => {
      if (!(it.school || it.degree)) return null;
      const dates = [it.start, it.end].filter(Boolean).join(" — ");
      return `**${it.degree || ""}${it.field ? " in " + it.field : ""}**, ${it.school || ""}${it.location ? " — " + it.location : ""}  _${dates}_${it.score ? `
- Score: ${it.score}` : ""}`;
    },
  },
  certifications: {
    name: "Certifications",
    itemFields: [
      { key: "name", label: "Name", type: "text" },
      { key: "authority", label: "Authority", type: "text" },
      { key: "id", label: "Credential ID", type: "text" },
      { key: "url", label: "Verify URL", type: "url" },
      { key: "date", label: "Date", type: "month" },
    ],
    bullets: false,
    md: (it) => {
      if (!it.name) return null;
      const left = it.url ? `[${it.name}](${it.url})` : it.name;
      const right = [it.authority, it.id, it.date].filter(Boolean).join(" • ");
      return `${left}${right ? ` — ${right}` : ""}`;
    },
  },
  awards: {
    name: "Awards",
    itemFields: [
      { key: "name", label: "Name", type: "text" },
      { key: "issuer", label: "Issuer", type: "text" },
      { key: "date", label: "Date", type: "month" },
      { key: "location", label: "Location", type: "text" },
      { key: "url", label: "Link", type: "url" },
    ],
    bullets: true,
    md: (it) => {
      if (!it.name) return null;
      const title = it.url ? `[${it.name}](${it.url})` : it.name;
      const meta = [it.issuer, it.location, it.date].filter(Boolean).join(" • ");
      return `**${title}**${meta ? ` — ${meta}` : ""}`;
    },
  },
  publications: {
    name: "Publications",
    itemFields: [
      { key: "title", label: "Title", type: "text" },
      { key: "venue", label: "Journal / Venue", type: "text" },
      { key: "authors", label: "Authors", type: "text" },
      { key: "date", label: "Date", type: "month" },
      { key: "link", label: "Link", type: "url" },
    ],
    bullets: true,
    md: (it) => {
      if (!it.title) return null;
      const left = it.link ? `[${it.title}](${it.link})` : it.title;
      const meta = [it.authors, it.venue, it.date].filter(Boolean).join(" • ");
      return `**${left}**${meta ? ` — ${meta}` : ""}`;
    },
  },
  volunteer: {
    name: "Volunteer",
    itemFields: [
      { key: "organization", label: "Organization", type: "text" },
      { key: "role", label: "Role", type: "text" },
      { key: "location", label: "Location", type: "text" },
      { key: "start", label: "Start", type: "month" },
      { key: "end", label: "End", type: "month", dependsOn: { key: "current", value: false } },
      { key: "current", label: "Current", type: "checkbox" },
    ],
    bullets: true,
    md: (it) => {
      if (!(it.organization || it.role)) return null;
      const dates = formatDates(it.start, it.end, it.current);
      return `**${it.role || ""}**, ${it.organization || ""}${it.location ? " — " + it.location : ""}  _${dates}_`;
    },
  },
  courses: {
    name: "Courses",
    itemFields: [
      { key: "name", label: "Course", type: "text" },
      { key: "provider", label: "Provider", type: "text" },
      { key: "date", label: "Date", type: "month" },
      { key: "link", label: "Link", type: "url" },
    ],
    bullets: false,
    md: (it) => {
      if (!it.name) return null;
      const left = it.link ? `[${it.name}](${it.link})` : it.name;
      const meta = [it.provider, it.date].filter(Boolean).join(" • ");
      return `${left}${meta ? ` — ${meta}` : ""}`;
    },
  },
  languages: {
    name: "Languages",
    itemFields: [
      { key: "name", label: "Language", type: "text" },
      { key: "proficiency", label: "Proficiency", type: "text" },
    ],
    bullets: false,
    md: (it) => (it.name ? `- ${it.name}${it.proficiency ? ` — ${it.proficiency}` : ""}` : null),
  },
  interests: {
    name: "Interests",
    itemFields: [
      { key: "name", label: "Interest", type: "text" },
      { key: "details", label: "Details (optional)", type: "text" },
    ],
    bullets: false,
    md: (it) => (it.name ? `- ${it.name}${it.details ? ` — ${it.details}` : ""}` : null),
  },
  references: {
    name: "References",
    itemFields: [
      { key: "name", label: "Name", type: "text" },
      { key: "relation", label: "Relation", type: "text" },
      { key: "email", label: "Email", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
    ],
    bullets: false,
    md: (it) => (it.name ? `- **${it.name}** — ${[it.relation, it.email, it.phone].filter(Boolean).join(" • ")}` : null),
  },
  achievements: {
    name: "Achievements",
    itemFields: [
      { key: "title", label: "Title", type: "text" },
      { key: "date", label: "Date", type: "month" },
      { key: "summary", label: "Summary", type: "textarea" },
      { key: "link", label: "Link", type: "url" },
    ],
    bullets: true,
    md: (it) => {
      if (!it.title) return null;
      const left = it.link ? `[${it.title}](${it.link})` : it.title;
      const meta = [it.date].filter(Boolean).join(" • ");
      return `**${left}**${meta ? ` — ${meta}` : ""}${it.summary ? `
- ${it.summary}` : ""}`;
    },
  },
  patents: {
    name: "Patents",
    itemFields: [
      { key: "title", label: "Title", type: "text" },
      { key: "number", label: "Number", type: "text" },
      { key: "date", label: "Date", type: "month" },
      { key: "link", label: "Link", type: "url" },
    ],
    bullets: false,
    md: (it) => {
      if (!it.title) return null;
      const left = it.link ? `[${it.title}](${it.link})` : it.title;
      const meta = [it.number, it.date].filter(Boolean).join(" • ");
      return `${left}${meta ? ` — ${meta}` : ""}`;
    },
  },
  talks: {
    name: "Talks / Conferences",
    itemFields: [
      { key: "title", label: "Title", type: "text" },
      { key: "event", label: "Event", type: "text" },
      { key: "location", label: "Location", type: "text" },
      { key: "date", label: "Date", type: "month" },
      { key: "link", label: "Link", type: "url" },
    ],
    bullets: true,
    md: (it) => {
      if (!it.title) return null;
      const left = it.link ? `[${ it.title }](${ it.link })` : it.title;
      const meta = [it.event, it.location, it.date].filter(Boolean).join(" • ");
      return `**${left}**${meta ? ` — ${meta}` : ""}`;
    },
  },
  custom: {
    name: "Custom (freeform)",
    itemFields: [{ key: "content", label: "Content", type: "textarea" }],
    bullets: false,
    md: (it) => (it.content ? it.content : null),
  },
  // NEW: Categorized Skills section
  skillsets: {
    name: "Skills (by category)",
    itemFields: [
      { key: "languages", label: "Languages", type: "tags", options: SKILL_OPTIONS.languages },
      { key: "soft", label: "Soft Skills", type: "tags", options: SKILL_OPTIONS.soft },
      { key: "concepts", label: "Concepts", type: "tags", options: SKILL_OPTIONS.concepts },
      { key: "tools", label: "Tools", type: "tags", options: SKILL_OPTIONS.tools },
      { key: "platforms", label: "Platforms", type: "tags", options: SKILL_OPTIONS.platforms },
    ],
    bullets: false,
    md: (it) => {
      const rows = [];
      const show = (k, label) => Array.isArray(it[k]) && it[k].length
        ? rows.push(`- **${label}:** ${it[k].join(", ")}`)
        : null;
      show("languages", "Languages");
      show("soft", "Soft Skills");
      show("concepts", "Concepts");
      show("tools", "Tools");
      show("platforms", "Platforms");
      return rows.length ? rows.join("\n") : null;
    },
  },
};

// Utility: default item generator for a template
function defaultItemFor(type) {
  const t = SECTION_TEMPLATES[type];
  if (!t) return {};
  const it = {};
  (t.itemFields || []).forEach((f) => {
    if (f.type === "checkbox") it[f.key] = false;
    else if (f.type === "tags") it[f.key] = [];
    else it[f.key] = "";
  });
  if (t.bullets) it.bullets = [""];
  return it;
}

function formatDates(start, end, current) {
  const s = start || "";
  const e = current ? "Present" : end || "";
  return [s, e].filter(Boolean).join(" — ");
}

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const DEFAULT_SECTIONS = ["experience", "projects", "education", "skillsets"]; // include new section by default

// ------------------- Skills helpers (clean + collapse) ---------------------
function dedupeAndSort(arr) {
  return Array.from(new Set((arr || []).map((s) => s.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function cleanedSkillsetsLines(f) {
  const rows = [];
  const items = (f.sections || []).filter((s) => s.type === "skillsets").flatMap((s) => s.items || []);
  if (!items.length) return rows;

  const acc = { languages: [], soft: [], concepts: [], tools: [], platforms: [] };
  items.forEach((it) => {
    Object.keys(acc).forEach((k) => {
      if (Array.isArray(it[k])) acc[k].push(...it[k]);
    });
  });

  Object.keys(acc).forEach((k) => (acc[k] = dedupeAndSort(acc[k])));

  const label = {
    languages: "Languages",
    soft: "Soft Skills",
    concepts: "Concepts",
    tools: "Tools",
    platforms: "Platforms",
  };

  Object.entries(acc).forEach(([k, vals]) => {
    if (vals.length) rows.push(`- **${label[k]}:** ${vals.join(", ")}`);
  });

  return rows;
}

function slugName(fullName = "", title = "") {
  const base = [fullName, title].filter(Boolean).join("_").trim();
  return (base || "resume")
    .replace(/\s+/g, "_")
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .replace(/^_+|_+$/g, "");
}

// --- Markdown (for preview, optional) --------------------------------------
function toMarkdown(f) {
  const lines = [];
  lines.push(`# ${f.fullName}${f.title ? " — " + f.title : ""}`);
  lines.push(`${f.email} | ${f.phone}${f.location ? " | " + f.location : ""}`);
  if (f.profiles?.length) {
    const row = f.profiles
      .filter((l) => l.label || l.url)
      .map((l) => (l.url ? `[${l.label || l.url}](${l.url})` : l.label))
      .join(" • ");
    if (row) lines.push(row);
  }
  if (f.summary?.trim()) lines.push(`\n${f.summary.trim()}`);

  // Prefer categorized skillsets; fall back to legacy flat skills
  const skillsetRows = cleanedSkillsetsLines(f);
  if (skillsetRows.length) {
    lines.push(`\n**Skills**`);
    lines.push(skillsetRows.join("\n"));
  } else if (f.skills?.length) {
    const flat = dedupeAndSort(f.skills);
    lines.push(`\n**Skills**\n${flat.join(", ")}`);
  }

  (f.sections || []).forEach((sec) => {
    if (sec.type === "skillsets") return; // already printed unified skills
    const t = SECTION_TEMPLATES[sec.type];
    if (!t) return;
    const body = [];
    (sec.items || []).forEach((it) => {
      const head = t.md ? t.md(it) : null;
      if (!head) return;
      body.push(`\n${head}`);
      (it.bullets || []).forEach((b) => b && body.push(`- ${b}`));
    });
    if (body.length) {
      lines.push(`\n## ${sec.title || t.name}`);
      lines.push(...body);
    }
  });
  lines.push("");
  return lines.join("\n");
}

// ============================= Component ===================================
export default function ResumeBuilder() {
  const [form, setForm] = useState(() => ({
    fullName: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    profiles: [{ label: "LinkedIn", url: "" }],
    summary: "",
    skills: ["Python", "TensorFlow", "React"], // legacy flat skills (optional)
    sections: DEFAULT_SECTIONS.map((type) => createSection(type)),
  }));

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  const requiredOk = useMemo(() => {
    return form.fullName.trim() && form.email.trim() && form.phone.trim();
  }, [form.fullName, form.email, form.phone]);

  // ---- Backend exports (LaTeX/PDF/JSON) -----------------------------------
  const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000";

  async function postAndDownload(path, body, fallbackName, withProgress = false) {
    let timer = null;
    const startProgress = () => {
      setLoading(true);
      setProgress(5);
      // Smoothly ease toward 90% unless finished earlier
      timer = window.setInterval(() => {
        setProgress((p) => (p < 90 ? p + Math.max(0.5, (100 - p) * 0.03) : p));
      }, 200);
    };
    const stopProgress = (final = 100) => {
      if (timer) { clearInterval(timer); timer = null; }
      setProgress(final);
      setTimeout(() => setLoading(false), 300);
    };

    try {
      if (withProgress) startProgress();

      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const ct = res.headers.get("content-type") || "";
        const err = ct.includes("application/json") ? await res.json() : await res.text();
        console.error("Export failed:", err);
        alert(`Export failed:\n${typeof err === "string" ? err : JSON.stringify(err, null, 2)}`);
        if (withProgress) stopProgress(0);
        return;
      }

      const cd = res.headers.get("content-disposition") || "";
      const match = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd);
      const filename = decodeURIComponent(match?.[1] || match?.[2] || fallbackName);

      const blob = await res.blob();
      if (withProgress) setProgress(98);

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      if (withProgress) stopProgress(100);
    } catch (e) {
      console.error(e);
      alert(`Export failed:\n${String(e)}`);
      if (withProgress) stopProgress(0);
    }
  }

  const exportLaTeX = () =>
    postAndDownload("/render/latex", form, `${slugName(form.fullName, form.title)}.tex`, false);

  const exportPDF = () =>
    postAndDownload("/render/pdf", form, `${slugName(form.fullName, form.title)}.pdf`, true);

  const exportJSON = () =>
    postAndDownload("/export/json", form, `${slugName(form.fullName, form.title)}.json`, false);

  // ---- Top-level helpers ---------------------------------------------------
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  // Profile links (top-level)
  const addProfile = () => setForm((f) => ({ ...f, profiles: [...f.profiles, { label: "", url: "" }] }));
  const updateProfile = (idx, key, value) =>
    setForm((f) => {
      const arr = f.profiles.map((p, i) => (i === idx ? { ...p, [key]: value } : p));
      return { ...f, profiles: arr };
    });
  const removeProfile = (idx) =>
    setForm((f) => {
      const arr = f.profiles.slice();
      arr.splice(idx, 1);
      return { ...f, profiles: arr.length ? arr : [{ label: "", url: "" }] };
    });

  // Skills (legacy chip list)
  const addSkill = (value) => {
    const v = value.trim();
    if (!v) return;
    setForm((f) => (f.skills.includes(v) ? f : { ...f, skills: [...f.skills, v] }));
  };
  const removeSkill = (skill) => setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }));

  // ---- Dynamic sections CRUD ----------------------------------------------
  function createSection(type) {
    const t = SECTION_TEMPLATES[type];
    return {
      id: uid(),
      type,
      title: t?.name || "Section",
      items: [defaultItemFor(type)],
    };
  }

  const addSection = (type) => setForm((f) => ({ ...f, sections: [...f.sections, createSection(type)] }));
  const removeSection = (id) => setForm((f) => ({ ...f, sections: f.sections.filter((s) => s.id !== id) }));
  const moveSection = (id, dir) =>
    setForm((f) => {
      const idx = f.sections.findIndex((s) => s.id === id);
      if (idx < 0) return f;
      const arr = f.sections.slice();
      const swapIdx = dir === "up" ? Math.max(0, idx - 1) : Math.min(arr.length - 1, idx + 1);
      [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
      return { ...f, sections: arr };
    });
  const renameSection = (id, title) =>
    setForm((f) => ({ ...f, sections: f.sections.map((s) => (s.id === id ? { ...s, title } : s)) }));

  // Item-level helpers
  const addItem = (sectionId) =>
    setForm((f) => {
      const arr = f.sections.map((s) =>
        s.id === sectionId ? { ...s, items: [...s.items, defaultItemFor(s.type)] } : s
      );
      return { ...f, sections: arr };
    });
  const removeItem = (sectionId, idx) =>
    setForm((f) => {
      const arr = f.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const items = s.items.slice();
        items.splice(idx, 1);
        return { ...s, items };
      });
      return { ...f, sections: arr };
    });
  const updateItem = (sectionId, idx, key, value) =>
    setForm((f) => {
      const arr = f.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const items = s.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it));
        return { ...s, items };
      });
      return { ...f, sections: arr };
    });

  const addBullet = (sectionId, idx) =>
    setForm((f) => {
      const arr = f.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const items = s.items.slice();
        const it = { ...items[idx] };
        it.bullets = [...(it.bullets || []), ""];
        items[idx] = it;
        return { ...s, items };
      });
      return { ...f, sections: arr };
    });
  const removeBullet = (sectionId, idx, bidx) =>
    setForm((f) => {
      const arr = f.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const items = s.items.slice();
        const it = { ...items[idx] };
        const bs = (it.bullets || []).slice();
        bs.splice(bidx, 1);
        it.bullets = bs.length ? bs : [""];
        items[idx] = it;
        return { ...s, items };
      });
      return { ...f, sections: arr };
    });
  const updateBullet = (sectionId, idx, bidx, value) =>
    setForm((f) => {
      const arr = f.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const items = s.items.slice();
        const it = { ...items[idx] };
        const bs = (it.bullets || []).slice();
        bs[bidx] = value;
        it.bullets = bs;
        items[idx] = it;
        return { ...s, items };
      });
      return { ...f, sections: arr };
    });

  // ---- UI -----------------------------------------------------------------
  return (
    <div className="rb-root">
      <header className="rb-header">
        <div className="rb-header-inner">
          <div className="rb-title">
            <span className="rb-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M3 12h3M18 12h3M12 3v3M12 18v3" />
              </svg>
            </span>
            <span>Resume Builder</span>
          </div>
          <div className="rb-actions">
            <button className="rb-btn" disabled={loading} onClick={exportJSON} title="Download JSON">⭳ JSON</button>
            <button className="rb-btn" disabled={loading} onClick={exportLaTeX} title="Download LaTeX">.tex</button>
            <button className="rb-btn primary" disabled={!requiredOk || loading} onClick={exportPDF} title="Download PDF">PDF</button>
          </div>
        </div>
      </header>

      <main className="rb-main">
        {/* Basics */}
        <section className="rb-card">
          <h3 className="rb-card-title">Basics</h3>
          <div className="rb-grid">
            <Field label="Full name *">
              <input className="rb-input" value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} />
            </Field>
            <Field label="Title / Role">
              <input className="rb-input" value={form.title} onChange={(e) => setField("title", e.target.value)} />
            </Field>
            <Field label="Email *">
              <input className="rb-input" type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            </Field>
            <Field label="Phone *">
              <input className="rb-input" value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
            </Field>
            <Field label="Location">
              <input className="rb-input" value={form.location} onChange={(e) => setField("location", e.target.value)} />
            </Field>
          </div>

          {/* Profiles / Links */}
          <div className="rb-list-header">
            <h4>Links</h4>
            <button className="rb-icon" onClick={addProfile} title="Add link">＋</button>
          </div>
          {form.profiles.map((lnk, i) => (
            <div className="rb-row" key={`link-${i}`}>
              <input className="rb-input" placeholder="Label (e.g., LinkedIn)" value={lnk.label} onChange={(e) => updateProfile(i, "label", e.target.value)} />
              <input className="rb-input" placeholder="https://" value={lnk.url} onChange={(e) => updateProfile(i, "url", e.target.value)} />
              <button className="rb-icon danger" onClick={() => removeProfile(i)} title="Remove">🗑</button>
            </div>
          ))}

          {/* Summary */}
          <Field label="Summary">
            <textarea className="rb-textarea" rows={4} value={form.summary} onChange={(e) => setField("summary", e.target.value)} />
          </Field>

          {/* Legacy flat Skills (optional, collapsed) */}
          <details className="rb-details">
            <summary className="rb-summary">Legacy flat skills (optional)</summary>
            <SkillsChips skills={form.skills} onAdd={addSkill} onRemove={removeSkill} />
          </details>
        </section>

        {/* Dynamic Sections */}
        <SectionPicker onAdd={addSection} />

        {form.sections.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            onRename={(t) => renameSection(section.id, t)}
            onRemove={() => removeSection(section.id)}
            onMoveUp={() => moveSection(section.id, "up")}
            onMoveDown={() => moveSection(section.id, "down")}
          >
            <SectionItems
              section={section}
              onAddItem={() => addItem(section.id)}
              onRemoveItem={(i) => removeItem(section.id, i)}
              onUpdateItem={(i, k, v) => updateItem(section.id, i, k, v)}
              onAddBullet={(i) => addBullet(section.id, i)}
              onRemoveBullet={(i, b) => removeBullet(section.id, i, b)}
              onUpdateBullet={(i, b, v) => updateBullet(section.id, i, b, v)}
            />
          </SectionCard>
        ))}

        {/* Footer actions */}
        <section className="rb-footer">
          <span className={!requiredOk ? "rb-warning" : "rb-ok"}>
            {!requiredOk ? "Name, Email, and Phone are required." : "Looks good!"}
          </span>
        </section>
      </main>

      {/* Progress Overlay */}
      <ProgressOverlay show={loading} label="Compiling PDF…" value={progress} />
    </div>
  );
}

// --- Reusable pieces --------------------------------------------------------
function Field({ label, children }) {
  return (
    <label className="rb-field">
      <span className="rb-label">{label}</span>
      {children}
    </label>
  );
}

function SectionPicker({ onAdd }) {
  const [sel, setSel] = useState("experience");
  const options = Object.entries(SECTION_TEMPLATES);
  return (
    <section className="rb-card">
      <div className="rb-list-header">
        <h3 className="rb-card-title">Sections</h3>
        <div className="rb-row">
          <select className="rb-input" value={sel} onChange={(e) => setSel(e.target.value)}>
            {options.map(([key, t]) => (
              <option key={key} value={key}>{t.name}</option>
            ))}
          </select>
          <button className="rb-btn" onClick={() => onAdd(sel)}>＋ Add section</button>
        </div>
      </div>
    </section>
  );
}

function SectionCard({ section, children, onRename, onRemove, onMoveUp, onMoveDown }) {
  const t = SECTION_TEMPLATES[section.type] || { name: section.title };
  return (
    <section className="rb-card">
      <div className="rb-list-header">
        <h3 className="rb-card-title">
          <input
            className="rb-input"
            value={section.title}
            onChange={(e) => onRename(e.target.value)}
            aria-label={`${t.name} title`}
          />
        </h3>
        <div className="rb-actions">
          <button className="rb-btn ghost" onClick={onMoveUp} title="Move up">↑</button>
          <button className="rb-btn ghost" onClick={onMoveDown} title="Move down">↓</button>
          <button className="rb-btn danger" onClick={onRemove} title="Remove section">Remove</button>
        </div>
      </div>
      {children}
    </section>
  );
}

function SectionItems({ section, onAddItem, onRemoveItem, onUpdateItem, onAddBullet, onRemoveBullet, onUpdateBullet }) {
  const template = SECTION_TEMPLATES[section.type];
  const fields = template?.itemFields || [];

  return (
    <div className="rb-items">
      <div className="rb-list-header">
        <h4>Entries</h4>
        <button className="rb-btn ghost" onClick={onAddItem}>＋ Add entry</button>
      </div>

      {section.items.map((it, i) => (
        <div className="rb-item" key={`${section.id}-item-${i}`}>
          <div className="rb-item-head">
            <strong>Entry #{i + 1}</strong>
            <button className="rb-icon danger" onClick={() => onRemoveItem(i)} title="Remove">🗑</button>
          </div>

          <div className="rb-grid">
            {fields.map((f) => (
              <Field key={f.key} label={f.label}>
                {renderField(section.type, it, f, (val) => onUpdateItem(i, f.key, val))}
              </Field>
            ))}
          </div>

          {template?.bullets ? (
            <Bullets
              bullets={it.bullets || [""]}
              onAdd={() => onAddBullet(i)}
              onRemove={(b) => onRemoveBullet(i, b)}
              onChange={(b, val) => onUpdateBullet(i, b, val)}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

function renderField(sectionType, item, f, onChange) {
  const disabled = f.dependsOn ? item[f.dependsOn.key] !== f.dependsOn.value : false;
  const commonProps = {
    className: "rb-input",
    value: item[f.key] ?? "",
    onChange: (e) => onChange(e.target.value),
    disabled,
  };

  switch (f.type) {
    case "checkbox":
      return (
        <label className="rb-check">
          <input type="checkbox" checked={!!item[f.key]} onChange={(e) => onChange(e.target.checked)} /> {f.label}
        </label>
      );
    case "textarea":
      return (
        <textarea className="rb-textarea" rows={3} value={item[f.key] || ""} onChange={(e) => onChange(e.target.value)} />
      );
    case "month":
      return <input type="month" {...commonProps} />;
    case "url":
      return <input type="url" placeholder="https://" {...commonProps} />;
    case "tags":
      return (
        <TagInput
          value={Array.isArray(item[f.key]) ? item[f.key] : []}
          onChange={(arr) => onChange(arr)}
          options={f.options || []}
        />
      );
    default:
      return <input type="text" {...commonProps} />;
  }
}

function SkillsChips({ skills, onAdd, onRemove }) {
  const [draft, setDraft] = useState("");
  const add = () => { onAdd(draft); setDraft(""); };
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
  };
  return (
    <div className="rb-skills">
      <div className="rb-chipwrap">
        {skills.map((s) => (
          <span className="rb-chip" key={s}>
            {s} <button className="rb-chip-x" onClick={() => onRemove(s)} title="Remove">×</button>
          </span>
        ))}
      </div>
      <div className="rb-row">
        <input className="rb-input" placeholder="Add a skill and press Enter" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} />
        <button className="rb-btn" onClick={add}>＋ Add</button>
      </div>
    </div>
  );
}

function TagInput({ value, onChange, options = [], placeholder = "Add and press Enter" }) {
  const [draft, setDraft] = useState("");
  const add = (v) => {
    const t = (v || draft).trim();
    if (!t) return;
    if (!value.includes(t)) onChange([...(value || []), t]);
    setDraft("");
  };
  const remove = (tag) => onChange((value || []).filter((x) => x !== tag));
  const onKeyDown = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); }
  };
  return (
    <div className="rb-tags">
      <div className="rb-chipwrap">
        {(value || []).map((s) => (
          <span className="rb-chip" key={s}>
            {s} <button className="rb-chip-x" onClick={() => remove(s)} title="Remove">×</button>
          </span>
        ))}
      </div>
      <div className="rb-row">
        <input
          list="rb-tag-options"
          className="rb-input"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button className="rb-btn" type="button" onClick={() => add()}>＋ Add</button>
        <datalist id="rb-tag-options">
          {options.map((o) => <option key={o} value={o} />)}
        </datalist>
      </div>
      {options.length ? (
        <div className="rb-quickpick">
          {options.map((o) => (
            <button key={o} type="button" className="rb-chip ghost" onClick={() => add(o)}>{o}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Bullets({ bullets, onAdd, onRemove, onChange }) {
  return (
    <div className="rb-bullets">
      <div className="rb-list-header">
        <h5>Highlights</h5>
        <button className="rb-icon" onClick={onAdd} title="Add bullet">＋</button>
      </div>
      {bullets.map((b, bidx) => (
        <div className="rb-row" key={`b-${bidx}`}>
          <textarea className="rb-textarea" rows={2} value={b} onChange={(e) => onChange(bidx, e.target.value)} />
          <button className="rb-icon danger" onClick={() => onRemove(bidx)} title="Remove">🗑</button>
        </div>
      ))}
    </div>
  );
}

function ProgressOverlay({ show, label = "Compiling PDF…", value = 0 }) {
  if (!show) return null;
  return (
    <div className="rb-overlay">
      <div className="rb-overlay-card">
        <div className="rb-spinner" aria-hidden="true" />
        <div className="rb-overlay-title">{label}</div>
        <div className="rb-progress">
          <div className="rb-progress-bar" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
        </div>
        <div className="rb-progress-text">{Math.floor(value)}%</div>
      </div>
    </div>
  );
}
