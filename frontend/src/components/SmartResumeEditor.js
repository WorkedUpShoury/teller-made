// =============================
// ResumeBuilder.jsx (Corrected)
// =============================
import React, { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./ResumeEditor.css";
import ResumeVersionsSidebar from "./ResumeVersionsSidebar";
import ResumePreview from './ResumePreview';

// Preset options for categorized skills
const SKILL_OPTIONS = {
    languages: ["Python", "TypeScript", "Java", "C++", "Go", "Rust", "SQL", "R", "Scala", "Kotlin"],
    soft: ["Leadership", "Communication", "Mentoring", "Collaboration", "Problem-Solving", "Time Management"],
    concepts: ["OOP", "Functional Programming", "Distributed Systems", "ML", "DL", "NLP", "Data Engineering"],
    tools: ["Git", "Docker", "Kubernetes", "Terraform", "Jenkins", "Airflow", "Snowflake", "Spark"],
    platforms: ["AWS", "GCP", "Azure", "Linux", "iOS", "Android", "Salesforce"],
};

// --- Section templates (Unchanged) ------------------------------------------------
const SECTION_TEMPLATES = {
    experience: { name: "Experience", itemFields: [{ key: "company", label: "Company", type: "text" }, { key: "role", label: "Role / Title", type: "text" }, { key: "location", label: "Location", type: "text" }, { key: "start", label: "Start", type: "month" }, { key: "end", label: "End", type: "month", dependsOn: { key: "current", value: false } }, { key: "current", label: "Current", type: "checkbox" },], bullets: true, md: (it) => { if (!(it.company || it.role)) return null; const dates = formatDates(it.start, it.end, it.current); return `**${it.role || ""}**, ${it.company || ""}${it.location ? " — " + it.location : ""}  _${dates}_`; }, },
    projects: { name: "Projects", itemFields: [{ key: "name", label: "Name", type: "text" }, { key: "link", label: "Link", type: "url" }, { key: "summary", label: "One-line summary", type: "text" },], bullets: true, md: (it) => { if (!(it.name || it.summary)) return null; const title = it.link ? `[${it.name || "Project"}](${it.link})` : it.name || "Project"; return `**${title}** — ${it.summary || ""}`; }, },
    education: { name: "Education", itemFields: [{ key: "school", label: "School", type: "text" }, { key: "degree", label: "Degree", type: "text" }, { key: "field", label: "Field", type: "text" }, { key: "start", label: "Start", type: "month" }, { key: "end", label: "End", type: "month" }, { key: "location", label: "Location", type: "text" }, { key: "score", label: "Score (GPA/%)", type: "text" },], bullets: false, md: (it) => { if (!(it.school || it.degree)) return null; const dates = [it.start, it.end].filter(Boolean).join(" — "); return `**${it.degree || ""}**, ${it.school || ""}${it.location ? " — " + it.location : ""}  _${dates}_${it.score ? `\n- Score: ${it.score}` : ""}`; }, },
    certifications: { name: "Certifications", itemFields: [{ key: "name", label: "Name", type: "text" }, { key: "authority", label: "Authority", type: "text" }, { key: "id", label: "Credential ID", type: "text" }, { key: "url", label: "Verify URL", type: "url" }, { key: "date", label: "Date", type: "month" },], bullets: false, md: (it) => { if (!it.name) return null; const left = it.url ? `[${it.name}](${it.url})` : it.name; const right = [it.authority, it.id, it.date].filter(Boolean).join(" • "); return `${left}${right ? ` — ${right}` : ""}`; }, },
    awards: { name: "Awards", itemFields: [{ key: "name", label: "Name", type: "text" }, { key: "issuer", label: "Issuer", type: "text" }, { key: "date", label: "Date", type: "month" }, { key: "location", label: "Location", type: "text" }, { key: "url", label: "Link", type: "url" },], bullets: true, md: (it) => { if (!it.name) return null; const title = it.url ? `[${it.name}](${it.url})` : it.name; const meta = [it.issuer, it.location, it.date].filter(Boolean).join(" • "); return `**${title}**${meta ? ` — ${meta}` : ""}`; }, },
    publications: { name: "Publications", itemFields: [{ key: "title", label: "Title", type: "text" }, { key: "venue", label: "Journal / Venue", type: "text" }, { key: "authors", label: "Authors", type: "text" }, { key: "date", label: "Date", type: "month" }, { key: "link", label: "Link", type: "url" },], bullets: true, md: (it) => { if (!it.title) return null; const left = it.link ? `[${it.title}](${it.link})` : it.title; const meta = [it.authors, it.venue, it.date].filter(Boolean).join(" • "); return `**${left}**${meta ? ` — ${meta}` : ""}`; }, },
    volunteer: { name: "Volunteer", itemFields: [{ key: "organization", label: "Organization", type: "text" }, { key: "role", label: "Role", type: "text" }, { key: "location", label: "Location", type: "text" }, { key: "start", label: "Start", type: "month" }, { key: "end", label: "End", type: "month", dependsOn: { key: "current", value: false } }, { key: "current", label: "Current", type: "checkbox" },], bullets: true, md: (it) => { if (!(it.organization || it.role)) return null; const dates = formatDates(it.start, it.end, it.current); return `**${it.role || ""}**, ${it.organization || ""}${it.location ? " — " + it.location : ""}  _${dates}_`; }, },
    courses: { name: "Courses", itemFields: [{ key: "name", label: "Course", type: "text" }, { key: "provider", label: "Provider", type: "text" }, { key: "date", label: "Date", type: "month" }, { key: "link", label: "Link", type: "url" },], bullets: false, md: (it) => { if (!it.name) return null; const left = it.link ? `[${it.name}](${it.link})` : it.name; const meta = [it.provider, it.date].filter(Boolean).join(" • "); return `${left}${meta ? ` — ${meta}` : ""}`; }, },
    languages: { name: "Languages", itemFields: [{ key: "name", label: "Language", type: "text" }, { key: "proficiency", label: "Proficiency", type: "text" },], bullets: false, md: (it) => (it.name ? `- ${it.name}${it.proficiency ? ` — ${it.proficiency}` : ""}` : null), },
    interests: { name: "Interests", itemFields: [{ key: "name", label: "Interest", type: "text" }, { key: "details", label: "Details (optional)", type: "text" },], bullets: false, md: (it) => (it.name ? `- ${it.name}${it.details ? ` — ${it.details}` : ""}` : null), },
    references: { name: "References", itemFields: [{ key: "name", label: "Name", type: "text" }, { key: "relation", label: "Relation", type: "text" }, { key: "email", label: "Email", type: "text" }, { key: "phone", label: "Phone", type: "text" },], bullets: false, md: (it) => it.name ? `- **${it.name}** — ${[it.relation, it.email, it.phone].filter(Boolean).join(" • ")}` : null, },
    achievements: { name: "Achievements", itemFields: [{ key: "title", label: "Title", type: "text" }, { key: "date", label: "Date", type: "month" }, { key: "summary", label: "Summary", type: "textarea" }, { key: "link", label: "Link", type: "url" },], bullets: true, md: (it) => { if (!it.title) return null; const left = it.link ? `[${it.title}](${it.link})` : it.title; const meta = [it.date].filter(Boolean).join(" • "); return `**${left}**${meta ? ` — ${meta}` : ""}${it.summary ? `\n- ${it.summary}` : ""}`; }, },
    patents: { name: "Patents", itemFields: [{ key: "title", label: "Title", type: "text" }, { key: "number", label: "Number", type: "text" }, { key: "date", label: "Date", type: "month" }, { key: "link", label: "Link", type: "url" },], bullets: false, md: (it) => { if (!it.title) return null; const left = it.link ? `[${it.title}](${it.link})` : it.title; const meta = [it.number, it.date].filter(Boolean).join(" • "); return `${left}${meta ? ` — ${meta}` : ""}`; }, },
    talks: { name: "Talks / Conferences", itemFields: [{ key: "title", label: "Title", type: "text" }, { key: "event", label: "Event", type: "text" }, { key: "location", label: "Location", type: "text" }, { key: "date", label: "Date", type: "month" }, { key: "link", label: "Link", type: "url" },], bullets: true, md: (it) => { if (!it.title) return null; const left = it.link ? `[${it.title}](${it.link})` : it.title; const meta = [it.event, it.location, it.date].filter(Boolean).join(" • "); return `**${left}**${meta ? ` — ${meta}` : ""}`; }, },
    custom: { name: "Custom (freeform)", itemFields: [{ key: "content", label: "Content", type: "textarea" }], bullets: false, md: (it) => (it.content ? it.content : null), },
    skillsets: { name: "Skills", itemFields: [{ key: "languages", label: "Languages", type: "tags", options: SKILL_OPTIONS.languages }, { key: "soft", label: "Soft Skills", type: "tags", options: SKILL_OPTIONS.soft }, { key: "concepts", label: "Concepts", type: "tags", options: SKILL_OPTIONS.concepts }, { key: "tools", label: "Tools", type: "tags", options: SKILL_OPTIONS.tools }, { key: "platforms", label: "Platforms", type: "tags", options: SKILL_OPTIONS.platforms },], bullets: false, md: (it) => { const rows = []; const show = (k, label) => Array.isArray(it[k]) && it[k].length ? rows.push(`- **${label}:** ${it[k].join(", ")}`) : null; show("languages", "Languages"); show("soft", "Soft Skills"); show("concepts", "Concepts"); show("tools", "Tools"); show("platforms", "Platforms"); return rows.length ? rows.join("\n") : null; }, },
};

// --- Utility helpers (Unchanged) ----------------------------------------------------
function defaultItemFor(type) { const t = SECTION_TEMPLATES[type]; if (!t) return {}; const it = {}; (t.itemFields || []).forEach((f) => { if (f.type === "checkbox") it[f.key] = false; else if (f.type === "tags") it[f.key] = []; else it[f.key] = ""; }); if (t.bullets) it.bullets = [""]; return it; }
function formatDates(start, end, current) { const s = start || ""; const e = current ? "Present" : end || ""; return [s, e].filter(Boolean).join(" — "); }
function uid() { return Math.random().toString(36).slice(2, 9); }
const DEFAULT_SECTIONS = ["experience", "projects", "education", "skillsets"];
function dedupeAndSort(arr) { return Array.from(new Set((arr || []).map((s) => s.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)); }
function cleanedSkillsetsLines(f) { const rows = []; const items = (f.sections || []).filter((s) => s.type === "skillsets").flatMap((s) => s.items || []); if (!items.length) return rows; const acc = { languages: [], soft: [], concepts: [], tools: [], platforms: [] }; items.forEach((it) => { Object.keys(acc).forEach((k) => { if (Array.isArray(it[k])) acc[k].push(...it[k]); }); }); Object.keys(acc).forEach((k) => (acc[k] = dedupeAndSort(acc[k]))); const label = { languages: "Languages", soft: "Soft Skills", concepts: "Concepts", tools: "Tools", platforms: "Platforms", }; Object.entries(acc).forEach(([k, vals]) => { if (vals.length) rows.push(`- **${label[k]}:** ${vals.join(", ")}`); }); return rows; }
function slugName(fullName = "", title = "") { const base = [fullName, title].filter(Boolean).join("_").trim(); return (base || "resume") .replace(/\s+/g, "_") .replace(/[^A-Za-z0-9._-]/g, "_") .replace(/^_+|_+$/g, ""); }
function toMarkdown(f) { const lines = []; lines.push(`# ${f.fullName}${f.title ? " — " + f.title : ""}`); lines.push(`${f.email} | ${f.phone}${f.location ? " | " + f.location : ""}`); if (f.profiles?.length) { const row = f.profiles .filter((l) => l.label || l.url) .map((l) => (l.url ? `[${l.label || l.url}](${l.url})` : l.label)) .join(" • "); if (row) lines.push(row); } if (f.summary?.trim()) lines.push(`\n${f.summary.trim()}`); const skillsetRows = cleanedSkillsetsLines(f); if (skillsetRows.length) { lines.push(`\n**Skills**`); lines.push(skillsetRows.join("\n")); } else if (f.skills?.length) { const flat = dedupeAndSort(f.skills); lines.push(`\n**Skills**\n${flat.join(", ")}`); } (f.sections || []).forEach((sec) => { if (sec.type === "skillsets") return; const t = SECTION_TEMPLATES[sec.type]; if (!t) return; const body = []; (sec.items || []).forEach((it) => { const head = t.md ? t.md(it) : null; if (!head) return; body.push(`\n${head}`); (it.bullets || []).forEach((b) => b && body.push(`- ${b}`)); }); if (body.length) { lines.push(`\n## ${sec.title || t.name}`); lines.push(...body); } }); lines.push(""); return lines.join("\n"); }

// ============================= Component ===================================
export default function ResumeBuilder() {
    const [form, setForm] = useState(() => ({
        fullName: "", title: "", email: "", phone: "", location: "",
        profiles: [{ label: "LinkedIn", url: "" }],
        summary: "",
        skills: ["Python", "TensorFlow", "React"],
        sections: DEFAULT_SECTIONS.map((type) => createSection(type)),
    }));

    const [activeSectionId, setActiveSectionId] = useState("basics"); // 'basics' or a section.id
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [pdfPreviewBlob, setPdfPreviewBlob] = useState(null); // State for the PDF blob
    const [isPreviewOpen, setIsPreviewOpen] = useState(false); // State for modal visibility
    const [initialLoad, setInitialLoad] = useState(true);

    const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:8000/api";

    const requiredOk = useMemo(
        () => form.fullName.trim() && form.email.trim() && form.phone.trim(),
        [form.fullName, form.email, form.phone]
    );

    // --- CORRECTED: useEffect to load the current workspace version on mount ---
    useEffect(() => {
        const fetchCurrentResume = async () => {
            setInitialLoad(true);
            try {
                // Step 1: Fetch workspace metadata to find the currently selected version,
                // aligning with the logic used in the ResumeVersionsSidebar.
                const wsRes = await fetch(`${API_BASE}/workspace/get`);
                if (!wsRes.ok) {
                    console.error("Could not fetch workspace info:", await wsRes.text());
                    // Fail gracefully by allowing the app to start with the default empty form.
                    return; 
                }

                const workspaceInfo = await wsRes.json();
                const currentVersionId = workspaceInfo?.selectedVersionId;

                if (currentVersionId) {
                    // Step 2: If a version is selected in the workspace, load its full data.
                    const versionRes = await fetch(`${API_BASE}/versions/load/${currentVersionId}`);
                    if (!versionRes.ok) {
                        console.error(`Failed to load selected version ${currentVersionId}:`, await versionRes.text());
                        return; // Exit if loading the specific version fails.
                    }

                    const versionPayload = await versionRes.json();
                    // As seen in the sidebar's `open` function, the form data is nested inside a 'data' property.
                    if (versionPayload && versionPayload.data) {
                        setForm(versionPayload.data);
                    } else {
                         console.warn("Loaded version is missing the 'data' property.", versionPayload);
                         // Fallback for safety, in case API returns a flat object.
                         if (typeof versionPayload === 'object' && versionPayload !== null) {
                            setForm(versionPayload);
                         }
                    }
                } else {
                    // No version is selected in the workspace, so we'll use the default empty form state.
                    console.log("No version selected in workspace. Initializing with a default form.");
                }
            } catch (error) {
                console.error("Error during initial resume load:", error);
            } finally {
                setInitialLoad(false);
            }
        };

        fetchCurrentResume();
    }, []); // The empty dependency array ensures this runs only once on mount.

    // ---- Backend exports (Unchanged) -----------------------------------------
    async function postAndDownload(path, body, fallbackName, withProgress = false) { let timer = null; const startProgress = () => { setLoading(true); setProgress(5); timer = window.setInterval(() => { setProgress((p) => (p < 90 ? p + Math.max(0.5, (100 - p) * 0.03) : p)); }, 200); }; const stopProgress = (final = 100) => { if (timer) { clearInterval(timer); timer = null; } setProgress(final); setTimeout(() => setLoading(false), 300); }; try { if (withProgress) startProgress(); const res = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), }); if (!res.ok) { const ct = res.headers.get("content-type") || ""; const err = ct.includes("application/json") ? await res.json() : await res.text(); alert(`Export failed:\n${typeof err === "string" ? err : JSON.stringify(err, null, 2)}`); if (withProgress) stopProgress(0); return; } const cd = res.headers.get("content-disposition") || ""; const match = /filename\*=UTF-8''([^;]+)|filename="?([^"]+)"?/i.exec(cd); const filename = decodeURIComponent(match?.[1] || match?.[2] || fallbackName); const blob = await res.blob(); if (withProgress) setProgress(98); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); if (withProgress) stopProgress(100); } catch (e) { alert(`Export failed:\n${String(e)}`); if (withProgress) stopProgress(0); } }

    const exportLaTeX = () =>
        postAndDownload("/render/latex", { form: form }, `${slugName(form.fullName, form.title)}.tex`, false);
    const exportPDF = () =>
        postAndDownload("/render/pdf", { form: form }, `${slugName(form.fullName, form.title)}.pdf`, true);
    const exportJSON = () =>
        postAndDownload("/render/json", { form: form }, `${slugName(form.fullName, form.title)}.json`, false);

    // ---- New function to handle PDF preview (Unchanged) --------------------
    const handlePreview = async () => {
        if (!requiredOk) return;

        setLoading(true);
        setProgress(5);

        try {
            const res = await fetch(`${API_BASE}/render/pdf`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ form: form }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Server returned status ${res.status}: ${errorText}`);
            }

            const blob = await res.blob();
            setPdfPreviewBlob(blob);
            setIsPreviewOpen(true);
        } catch (e) {
            console.error("Failed to generate PDF for preview:", e);
            alert(`Preview failed:\n${String(e)}`);
        } finally {
            setLoading(false);
            setProgress(0);
        }
    };

    // ---- Data handling functions (Unchanged) ---------------------------------
    const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
    const addProfile = () => setForm((f) => ({ ...f, profiles: [...f.profiles, { label: "", url: "" }] }));
    const updateProfile = (idx, key, value) => setForm((f) => { const arr = f.profiles.map((p, i) => (i === idx ? { ...p, [key]: value } : p)); return { ...f, profiles: arr }; });
    const removeProfile = (idx) => setForm((f) => { const arr = f.profiles.slice(); arr.splice(idx, 1); return { ...f, profiles: arr.length ? arr : [{ label: "", url: "" }] }; });
    const addSkill = (value) => { const v = value.trim(); if (!v) return; setForm((f) => (f.skills.includes(v) ? f : { ...f, skills: [...f.skills, v] })); };
    const removeSkill = (skill) => setForm((f) => ({ ...f, skills: f.skills.filter((s) => s !== skill) }));
    function createSection(type) { const t = SECTION_TEMPLATES[type]; return { id: uid(), type, title: t?.name || "Section", items: [defaultItemFor(type)], }; }
    const addSection = (type) => { const newSection = createSection(type); setForm((f) => ({ ...f, sections: [...f.sections, newSection] })); setActiveSectionId(newSection.id); };
    const removeSection = (id) => { setForm((f) => ({ ...f, sections: f.sections.filter((s) => s.id !== id) })); setActiveSectionId("basics"); };
    const moveSection = (id, dir) => { setForm((f) => { const idx = f.sections.findIndex((s) => s.id === id); if (idx < 0) return f; const arr = f.sections.slice(); const swapIdx = dir === "up" ? Math.max(0, idx - 1) : Math.min(arr.length - 1, idx + 1); [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]]; return { ...f, sections: arr }; }); };
    const renameSection = (id, title) => setForm((f) => ({ ...f, sections: f.sections.map((s) => (s.id === id ? { ...s, title } : s)) }));
    const addItem = (sectionId) => setForm((f) => { const arr = f.sections.map((s) => s.id === sectionId ? { ...s, items: [...s.items, defaultItemFor(s.type)] } : s ); return { ...f, sections: arr }; });
    const removeItem = (sectionId, idx) => setForm((f) => { const arr = f.sections.map((s) => { if (s.id !== sectionId) return s; const items = s.items.slice(); items.splice(idx, 1); return { ...s, items }; }); return { ...f, sections: arr }; });
    const updateItem = (sectionId, idx, key, value) => setForm((f) => { const arr = f.sections.map((s) => { if (s.id !== sectionId) return s; const items = s.items.map((it, i) => (i === idx ? { ...it, [key]: value } : it)); return { ...s, items }; }); return { ...f, sections: arr }; });
    const addBullet = (sectionId, idx) => setForm((f) => { const arr = f.sections.map((s) => { if (s.id !== sectionId) return s; const items = s.items.slice(); const it = { ...items[idx] }; it.bullets = [...(it.bullets || []), ""]; items[idx] = it; return { ...s, items }; }); return { ...f, sections: arr }; });
    const removeBullet = (sectionId, idx, bidx) => setForm((f) => { const arr = f.sections.map((s) => { if (s.id !== sectionId) return s; const items = s.items.slice(); const it = { ...items[idx] }; const bs = (it.bullets || []).slice(); bs.splice(bidx, 1); it.bullets = bs.length ? bs : [""]; items[idx] = it; return { ...s, items }; }); return { ...f, sections: arr }; });
    const updateBullet = (sectionId, idx, bidx, value) => setForm((f) => { const arr = f.sections.map((s) => { if (s.id !== sectionId) return s; const items = s.items.slice(); const it = { ...items[idx] }; const bs = (it.bullets || []).slice(); bs[bidx] = value; it.bullets = bs; items[idx] = it; return { ...s, items }; }); return { ...f, sections: arr }; });

    // ---- Animation Variants (Unchanged) --------------------------------------
    const pageVariants = {
        enter: { opacity: 0, y: 20, scale: 0.99 },
        center: { zIndex: 1, opacity: 1, y: 0, scale: 1 },
        exit: { zIndex: 0, opacity: 0, y: -20, scale: 1.01 },
    };

    const activeSection = useMemo(() => {
        if (activeSectionId === 'basics') return null;
        return form.sections.find(s => s.id === activeSectionId);
    }, [activeSectionId, form.sections]);
    
    // Render a loading state while fetching the initial data
    if (initialLoad) {
        return <ProgressOverlay show={true} label="Loading resume..." value={50} />;
    }

    return (
        <div className="rb-page">
            <div className="rb-bg"><div className="rb-cloud rb-cloud--1"></div><div className="rb-cloud rb-cloud--2"></div></div>
            <div className="rb-root">
                <header className="rb-header">
                    <div className="rb-header-inner">
                        <div className="rb-title">
                            <span className="rb-badge" aria-hidden="true">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M3 12h3M18 12h3M12 3v3M12 18v3" /></svg>
                            </span>
                            <span>Resume Builder</span>
                        </div>
                        <div className="rb-actions">
                            <button className="rb-btn" disabled={loading} onClick={exportJSON} title="Download JSON">⭳ JSON</button>
                            <button className="rb-btn" disabled={loading} onClick={exportLaTeX} title="Download LaTeX">.tex</button>
                            <button className="rb-btn" disabled={!requiredOk || loading} onClick={handlePreview} title="Preview PDF">Preview</button>
                            <button className="rb-btn primary" disabled={!requiredOk || loading} onClick={exportPDF} title="Download PDF">PDF</button>
                        </div>
                    </div>
                </header>

                <div className="rb-layout">
                    <main className="rb-main rb-main--twocol">
                        <SectionNavigator
                            sections={form.sections}
                            activeSectionId={activeSectionId}
                            onSelect={setActiveSectionId}
                            onAdd={addSection}
                            onRemove={removeSection}
                            onMove={moveSection}
                        />
                        <div className="rb-editor-pane">
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeSectionId}
                                    variants={pageVariants}
                                    initial="enter"
                                    animate="center"
                                    exit="exit"
                                    transition={{ type: "spring", stiffness: 350, damping: 35 }}
                                >
                                    {activeSectionId === "basics" && (
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
                                            <Field label="Summary">
                                                <textarea className="rb-textarea" rows={4} value={form.summary} onChange={(e) => setField("summary", e.target.value)} />
                                            </Field>
                                        </section>
                                    )}
                                    {activeSection && (
                                        <SectionCard section={activeSection} onRename={(t) => renameSection(activeSection.id, t)}>
                                            <SectionItems
                                                section={activeSection}
                                                onAddItem={() => addItem(activeSection.id)}
                                                onRemoveItem={(i) => removeItem(activeSection.id, i)}
                                                onUpdateItem={(i, k, v) => updateItem(activeSection.id, i, k, v)}
                                                onAddBullet={(i) => addBullet(activeSection.id, i)}
                                                onRemoveBullet={(i, b) => removeBullet(activeSection.id, i, b)}
                                                onUpdateBullet={(i, b, v) => updateBullet(activeSection.id, i, b, v)}
                                            />
                                        </SectionCard>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </main>

                    <aside className="rb-side">
                        <ResumeVersionsSidebar className="rb-side-panel" currentJson={form} onSelect={setForm} onAfterSave={() => {}} showModeControls={true}/>
                    </aside>
                </div>

                <ProgressOverlay show={loading} label="Compiling PDF…" value={progress} />
            </div>

            {/* Render the ResumePreview component here */}
            <ResumePreview pdfBlob={pdfPreviewBlob} isOpen={isPreviewOpen} onClose={() => setIsPreviewOpen(false)} />
        </div>
    );
}

// --- Sub Components (Unchanged) ---------------------------------------------------------
function SectionNavigator({ sections, activeSectionId, onSelect, onAdd, onRemove, onMove }) {
    return (
        <div className="rb-navigator">
            <nav className="rb-nav-list">
                <button
                    className={`rb-nav-item ${activeSectionId === 'basics' ? 'active' : ''}`}
                    onClick={() => onSelect('basics')}
                >
                    Basics
                </button>
                {sections.map(sec => (
                    <div key={sec.id} className={`rb-nav-item-wrapper ${activeSectionId === sec.id ? 'active' : ''}`}>
                        <button className="rb-nav-item" onClick={() => onSelect(sec.id)}>
                            {sec.title}
                        </button>
                        <div className="rb-nav-actions">
                            <button onClick={() => onMove(sec.id, 'up')} title="Move Up">↑</button>
                            <button onClick={() => onMove(sec.id, 'down')} title="Move Down">↓</button>
                            <button className="danger" onClick={() => onRemove(sec.id)} title="Remove">🗑</button>
                        </div>
                    </div>
                ))}
            </nav>
            <div className="rb-nav-footer">
                <SectionPicker onAdd={onAdd} />
            </div>
        </div>
    )
}

function SectionPicker({ onAdd }) {
    const [sel, setSel] = useState("experience");
    const options = Object.entries(SECTION_TEMPLATES);
    return (
        <div className="rb-section-picker">
            <select className="rb-input" value={sel} onChange={(e) => setSel(e.target.value)}>
                {options.map(([key, t]) => ( <option key={key} value={key}>{t.name}</option> ))}
            </select>
            <button className="rb-btn" onClick={() => onAdd(sel)}>＋ Add</button>
        </div>
    );
}

function SectionCard({ section, children, onRename }) {
    const t = SECTION_TEMPLATES[section.type] || { name: section.title };
    return (
        <section className="rb-card">
            <div className="rb-list-header">
                <h3 className="rb-card-title">
                    <input className="rb-input" value={section.title} onChange={(e) => onRename(e.target.value)} aria-label={`${t.name} title`} />
                </h3>
            </div>
            {children}
        </section>
    );
}

function Field({ label, children }) { return ( <label className="rb-field"> <span className="rb-label">{label}</span> {children} </label> ); }
function SectionItems({ section, onAddItem, onRemoveItem, onUpdateItem, onAddBullet, onRemoveBullet, onUpdateBullet, }) { const template = SECTION_TEMPLATES[section.type]; const fields = template?.itemFields || []; return ( <div className="rb-items"> <div className="rb-list-header"> <h4>Entries</h4> <button className="rb-btn ghost" onClick={onAddItem}> ＋ Add entry </button> </div> {section.items.map((it, i) => ( <div className="rb-item" key={`${section.id}-item-${i}`}> <div className="rb-item-head"> <strong>Entry #{i + 1}</strong> <button className="rb-icon danger" onClick={() => onRemoveItem(i)} title="Remove"> 🗑 </button> </div> <div className="rb-grid"> {fields.map((f) => ( <Field key={f.key} label={f.label}> {renderField(section.type, it, f, (val) => onUpdateItem(i, f.key, val))} </Field> ))} </div> {template?.bullets ? ( <Bullets bullets={it.bullets || [""]} onAdd={() => onAddBullet(i)} onRemove={(b) => onRemoveBullet(i, b)} onChange={(b, val) => onUpdateBullet(i, b, val)} /> ) : null} </div> ))} </div> ); }
function renderField(sectionType, item, f, onChange) { const disabled = f.dependsOn ? item[f.dependsOn.key] !== f.dependsOn.value : false; const commonProps = { className: "rb-input", value: item[f.key] ?? "", onChange: (e) => onChange(e.target.value), disabled, }; switch (f.type) { case "checkbox": return ( <label className="rb-check"> <input type="checkbox" checked={!!item[f.key]} onChange={(e) => onChange(e.target.checked)} />{" "} {f.label} </label> ); case "textarea": return ( <textarea className="rb-textarea" rows={3} value={item[f.key] || ""} onChange={(e) => onChange(e.target.value)} /> ); case "month": return <input type="month" {...commonProps} />; case "url": return <input type="url" placeholder="https://" {...commonProps} />; case "tags": return ( <TagInput value={Array.isArray(item[f.key]) ? item[f.key] : []} onChange={(arr) => onChange(arr)} options={f.options || []} /> ); default: return <input type="text" {...commonProps} />; } }
function SkillsChips({ skills, onAdd, onRemove }) { const [draft, setDraft] = useState(""); const add = () => { onAdd(draft); setDraft(""); }; const onKeyDown = (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }; return ( <div className="rb-skills"> <div className="rb-chipwrap"> {skills.map((s) => ( <span className="rb-chip" key={s}> {s}{" "} <button className="rb-chip-x" onClick={() => onRemove(s)} title="Remove"> × </button> </span> ))} </div> <div className="rb-row"> <input className="rb-input" placeholder="Add a skill and press Enter" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} /> <button className="rb-btn" onClick={add}> ＋ Add </button> </div> </div> ); }
function TagInput({ value, onChange, options = [], placeholder = "Add and press Enter" }) { const [draft, setDraft] = useState(""); const add = (v) => { const t = (v || draft).trim(); if (!t) return; if (!value.includes(t)) onChange([...(value || []), t]); setDraft(""); }; const remove = (tag) => onChange((value || []).filter((x) => x !== tag)); const onKeyDown = (e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }; return ( <div className="rb-tags"> <div className="rb-chipwrap"> {(value || []).map((s) => ( <span className="rb-chip" key={s}> {s}{" "} <button className="rb-chip-x" onClick={() => remove(s)} title="Remove"> × </button> </span> ))} </div> <div className="rb-row"> <input list="rb-tag-options" className="rb-input" placeholder={placeholder} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKeyDown} /> <button className="rb-btn" type="button" onClick={() => add()}> ＋ Add </button> <datalist id="rb-tag-options"> {options.map((o) => ( <option key={o} value={o} /> ))} </datalist> </div> {options.length ? ( <div className="rb-quickpick"> {options.map((o) => ( <button key={o} type="button" className="rb-chip ghost" onClick={() => add(o)}> {o} </button> ))} </div> ) : null} </div> ); }
function Bullets({ bullets, onAdd, onRemove, onChange }) { return ( <div className="rb-bullets"> <div className="rb-list-header"> <h5>Highlights</h5> <button className="rb-icon" onClick={onAdd} title="Add bullet"> ＋ </button> </div> {bullets.map((b, bidx) => ( <div className="rb-row" key={`b-${bidx}`}> <textarea className="rb-textarea" rows={2} value={b} onChange={(e) => onChange(bidx, e.target.value)} /> <button className="rb-icon danger" onClick={() => onRemove(bidx)} title="Remove"> 🗑 </button> </div> ))} </div> ); }
function ProgressOverlay({ show, label = "Compiling PDF…", value = 0 }) { if (!show) return null; return ( <div className="rb-overlay"> <div className="rb-overlay-card"> <div className="rb-spinner" aria-hidden="true" /> <div className="rb-overlay-title">{label}</div> <div className="rb-progress"> <div className="rb-progress-bar" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /> </div> <div className="rb-progress-text">{Math.floor(value)}%</div> </div> </div> ); }