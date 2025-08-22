import React, { useMemo, useState } from "react";
import "./ResumeBuilder.css";

export default function ResumeBuilder() {
  const [form, setForm] = useState({
    fullName: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    links: [{ label: "LinkedIn", url: "" }],
    summary: "",
    skills: ["Python", "TensorFlow", "React"],
    experience: [
      { company: "", role: "", location: "", start: "", end: "", current: false, bullets: [""] },
    ],
    projects: [{ name: "", link: "", summary: "", bullets: [""] }],
    education: [{ school: "", degree: "", field: "", start: "", end: "", location: "", score: "" }],
  });

  const requiredOk = useMemo(() => {
    return form.fullName.trim() && form.email.trim() && form.phone.trim();
  }, [form.fullName, form.email, form.phone]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const addItem = (section, item) => setForm((f) => ({ ...f, [section]: [...f[section], item] }));
  const removeItem = (section, idx) =>
    setForm((f) => {
      const arr = [...f[section]];
      arr.splice(idx, 1);
      return { ...f, [section]: arr.length ? arr : [...arr, defaultItem(section)] };
    });
  const updateItem = (section, idx, key, value) =>
    setForm((f) => {
      const arr = f[section].map((it, i) => (i === idx ? { ...it, [key]: value } : it));
      return { ...f, [section]: arr };
    });
  const addBullet = (section, idx) =>
    setForm((f) => {
      const arr = f[section].slice();
      arr[idx] = { ...arr[idx], bullets: [...arr[idx].bullets, ""] };
      return { ...f, [section]: arr };
    });
  const removeBullet = (section, idx, bidx) =>
    setForm((f) => {
      const arr = f[section].slice();
      const bs = arr[idx].bullets.slice();
      bs.splice(bidx, 1);
      arr[idx] = { ...arr[idx], bullets: bs.length ? bs : [""] };
      return { ...f, [section]: arr };
    });
  const updateBullet = (section, idx, bidx, value) =>
    setForm((f) => {
      const arr = f[section].slice();
      const bs = arr[idx].bullets.slice();
      bs[bidx] = value;
      arr[idx] = { ...arr[idx], bullets: bs };
      return { ...f, [section]: arr };
    });

  const addSkill = (value) => {
    const v = value.trim();
    if (!v) return;
    setForm((f) => (f.skills.includes(v) ? f : { ...f, skills: [...f.skills, v] }));
  };
  const removeSkill = (skill) =>
    setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }));

  function defaultItem(section) {
    switch (section) {
      case "experience":
        return { company: "", role: "", location: "", start: "", end: "", current: false, bullets: [""] };
      case "projects":
        return { name: "", link: "", summary: "", bullets: [""] };
      case "education":
        return { school: "", degree: "", field: "", start: "", end: "", location: "", score: "" };
      case "links":
        return { label: "", url: "" };
      default:
        return {};
    }
  }

  const downloadJSON = () => {
    const blob = new Blob([JSON.stringify(form, null, 2)], { type: "application/json" });
    triggerDownload(blob, "resume.json");
  };
  const exportMarkdown = () => {
    const md = toMarkdown(form);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    triggerDownload(blob, "resume.md");
  };
  function triggerDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="rb-root">
      <header className="rb-header">
        <div className="rb-header-inner">
          <div className="rb-title">
            <span className="rb-badge" aria-hidden>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2">
                <circle cx="12" cy="12" r="4" />
                <path d="M3 12h3M18 12h3M12 3v3M12 18v3" />
              </svg>
            </span>
            <span>Resume Builder</span>
          </div>
          <div className="rb-actions">
            <button className="rb-btn ghost" onClick={downloadJSON} title="Download JSON">⭳ JSON</button>
            <button className="rb-btn primary" onClick={exportMarkdown} title="Export Markdown">Export</button>
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

          {/* Links */}
          <div className="rb-list-header">
            <h4>Links</h4>
            <button className="rb-icon" onClick={() => addItem("links", { label: "", url: "" })} title="Add link">＋</button>
          </div>
          {form.links.map((lnk, i) => (
            <div className="rb-row" key={`link-${i}`}>
              <input className="rb-input" value={lnk.label} onChange={(e) => updateItem("links", i, "label", e.target.value)} />
              <input className="rb-input" value={lnk.url} onChange={(e) => updateItem("links", i, "url", e.target.value)} />
              <button className="rb-icon danger" onClick={() => removeItem("links", i)} title="Remove">🗑</button>
            </div>
          ))}

          {/* Summary */}
          <Field label="Summary">
            <textarea className="rb-textarea" rows={4} value={form.summary} onChange={(e) => setField("summary", e.target.value)} />
          </Field>

          {/* Skills */}
          <SkillsChips skills={form.skills} onAdd={addSkill} onRemove={removeSkill} />
        </section>

        {/* Experience */}
        <section className="rb-card">
          <div className="rb-list-header">
            <h3 className="rb-card-title">Experience</h3>
            <button className="rb-btn ghost" onClick={() => addItem("experience", defaultItem("experience"))}>＋ Add experience</button>
          </div>

          {form.experience.map((ex, i) => (
            <div className="rb-item" key={`exp-${i}`}>
              <div className="rb-item-head">
                <strong>Role</strong>
                <button className="rb-icon danger" onClick={() => removeItem("experience", i)} title="Remove">🗑</button>
              </div>

              <div className="rb-grid">
                <Field label="Company"><input className="rb-input" value={ex.company} onChange={(e) => updateItem("experience", i, "company", e.target.value)} /></Field>
                <Field label="Role / Title"><input className="rb-input" value={ex.role} onChange={(e) => updateItem("experience", i, "role", e.target.value)} /></Field>
                <Field label="Location"><input className="rb-input" value={ex.location} onChange={(e) => updateItem("experience", i, "location", e.target.value)} /></Field>
                <Field label="Start"><input className="rb-input" type="month" value={ex.start} onChange={(e) => updateItem("experience", i, "start", e.target.value)} /></Field>
                <Field label="End"><input className="rb-input" type="month" value={ex.current ? "" : ex.end} onChange={(e) => updateItem("experience", i, "end", e.target.value)} disabled={ex.current} /></Field>
                <label className="rb-check">
                  <input type="checkbox" checked={ex.current} onChange={(e) => updateItem("experience", i, "current", e.target.checked)} />
                  Current
                </label>
              </div>

              <Bullets
                bullets={ex.bullets}
                onAdd={() => addBullet("experience", i)}
                onRemove={(b) => removeBullet("experience", i, b)}
                onChange={(b, val) => updateBullet("experience", i, b, val)}
              />
            </div>
          ))}
        </section>

        {/* Projects */}
        <section className="rb-card">
          <div className="rb-list-header">
            <h3 className="rb-card-title">Projects</h3>
            <button className="rb-btn ghost" onClick={() => addItem("projects", defaultItem("projects"))}>＋ Add project</button>
          </div>

          {form.projects.map((p, i) => (
            <div className="rb-item" key={`proj-${i}`}>
              <div className="rb-item-head">
                <strong>Project</strong>
                <button className="rb-icon danger" onClick={() => removeItem("projects", i)} title="Remove">🗑</button>
              </div>

              <div className="rb-grid">
                <Field label="Name"><input className="rb-input" value={p.name} onChange={(e) => updateItem("projects", i, "name", e.target.value)} /></Field>
                <Field label="Link"><input className="rb-input" value={p.link} onChange={(e) => updateItem("projects", i, "link", e.target.value)} /></Field>
                <Field label="One-line summary"><input className="rb-input" value={p.summary} onChange={(e) => updateItem("projects", i, "summary", e.target.value)} /></Field>
              </div>

              <Bullets
                bullets={p.bullets}
                onAdd={() => addBullet("projects", i)}
                onRemove={(b) => removeBullet("projects", i, b)}
                onChange={(b, val) => updateBullet("projects", i, b, val)}
              />
            </div>
          ))}
        </section>

        {/* Education */}
        <section className="rb-card">
          <div className="rb-list-header">
            <h3 className="rb-card-title">Education</h3>
            <button className="rb-btn ghost" onClick={() => addItem("education", defaultItem("education"))}>＋ Add education</button>
          </div>

          {form.education.map((ed, i) => (
            <div className="rb-item" key={`edu-${i}`}>
              <div className="rb-item-head">
                <strong>Program</strong>
                <button className="rb-icon danger" onClick={() => removeItem("education", i)} title="Remove">🗑</button>
              </div>

              <div className="rb-grid">
                <Field label="School"><input className="rb-input" value={ed.school} onChange={(e) => updateItem("education", i, "school", e.target.value)} /></Field>
                <Field label="Degree"><input className="rb-input" value={ed.degree} onChange={(e) => updateItem("education", i, "degree", e.target.value)} /></Field>
                <Field label="Field"><input className="rb-input" value={ed.field} onChange={(e) => updateItem("education", i, "field", e.target.value)} /></Field>
                <Field label="Start"><input className="rb-input" type="month" value={ed.start} onChange={(e) => updateItem("education", i, "start", e.target.value)} /></Field>
                <Field label="End"><input className="rb-input" type="month" value={ed.end} onChange={(e) => updateItem("education", i, "end", e.target.value)} /></Field>
                <Field label="Location"><input className="rb-input" value={ed.location} onChange={(e) => updateItem("education", i, "location", e.target.value)} /></Field>
                <Field label="Score (GPA/%)"><input className="rb-input" value={ed.score} onChange={(e) => updateItem("education", i, "score", e.target.value)} /></Field>
              </div>
            </div>
          ))}
        </section>

        {/* Footer actions */}
        <section className="rb-footer">
          <span className={!requiredOk ? "rb-warning" : "rb-ok"}>
            {!requiredOk ? "Name, Email, and Phone are required." : "Looks good!"}
          </span>
          <div className="rb-actions">
            <button className="rb-btn ghost" onClick={() => setForm((f) => ({ ...f, ...blankForm() }))}>Clear form</button>
            <button className="rb-btn primary" disabled={!requiredOk} onClick={exportMarkdown}>Generate Markdown</button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="rb-field">
      <span className="rb-label">{label}</span>
      {children}
    </label>
  );
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
        <input className="rb-input" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} />
        <button className="rb-btn" onClick={add}>＋ Add</button>
      </div>
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

function blankForm() {
  return {
    fullName: "",
    title: "",
    email: "",
    phone: "",
    location: "",
    links: [{ label: "LinkedIn", url: "" }],
    summary: "",
    skills: [],
  };
}

function toMarkdown(f) {
  const lines = [];
  lines.push(`# ${f.fullName}${f.title ? " — " + f.title : ""}`);
  lines.push(`${f.email} | ${f.phone}${f.location ? " | " + f.location : ""}`);
  if (f.links?.length) {
    lines.push(
      f.links
        .filter((l) => l.label || l.url)
        .map((l) => (l.url ? `[${l.label || l.url}](${l.url})` : l.label))
        .join(" • ")
    );
  }
  if (f.summary?.trim()) {
    lines.push(`\n**Summary**\n${f.summary.trim()}`);
  }
  if (f.skills?.length) {
    lines.push(`\n**Skills**\n${f.skills.join(", ")}`);
  }
  if (f.experience?.length) {
    lines.push(`\n## Experience`);
    f.experience.forEach((e) => {
      if (!(e.company || e.role)) return;
      const dates = `${e.start || ""}${e.current ? " — Present" : e.end ? " — " + e.end : ""}`;
      lines.push(`\n**${e.role || ""}**, ${e.company || ""}${e.location ? " — " + e.location : ""}  _${dates}_`);
      (e.bullets || []).forEach((b) => b && lines.push(`- ${b}`));
    });
  }
  if (f.projects?.length) {
    lines.push(`\n## Projects`);
    f.projects.forEach((p) => {
      if (!p.name && !p.summary) return;
      const title = p.link ? `[${p.name || "Project"}](${p.link})` : (p.name || "Project");
      lines.push(`\n**${title}** — ${p.summary || ""}`);
      (p.bullets || []).forEach((b) => b && lines.push(`- ${b}`));
    });
  }
  if (f.education?.length) {
    lines.push(`\n## Education`);
    f.education.forEach((ed) => {
      if (!(ed.school || ed.degree)) return;
      const dates = [ed.start, ed.end].filter(Boolean).join(" — ");
      const line = `**${ed.degree || ""}${ed.field ? " in " + ed.field : ""}**, ${ed.school || ""}${
        ed.location ? " — " + ed.location : ""
      }  _${dates}_`;
      lines.push(`\n${line}`);
      if (ed.score) lines.push(`- Score: ${ed.score}`);
    });
  }
  lines.push("");
  return lines.join("\n");
}
