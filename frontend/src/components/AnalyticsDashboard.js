import React, { useEffect, useRef, useState } from "react";
import "../styles/analytics.css";
import Chart from "chart.js/auto";

/* =========================
   API helpers
   ========================= */
const API_BASE = process.env.REACT_APP_API_BASE || "http://127.0.0.1:8000";
function authHeaders() {
  const token = localStorage.getItem("token");
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}
async function fetchJSON(path, init = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const res = await fetch(url, { ...init, headers: { ...authHeaders(), ...(init.headers || {}) } });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status} ${res.statusText}`);
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

/* =========================
   ATS heuristics (client-side)
   ========================= */
const asText = (obj) => {
  if (obj == null) return "";
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map(asText).join(" ");
  if (typeof obj === "object") return Object.entries(obj).map(([k, v]) => `${k} ${asText(v)}`).join(" ");
  return String(obj);
};
const sentencesCount = (t) => Math.max(1, (t.match(/[.!?]/g) || []).length);
const wordsCount = (t) => Math.max(1, t.trim().split(/\s+/).filter(Boolean).length);
const syllablesApprox = (t) => Math.max(1, (t.match(/[aeiouy]/gi) || []).length);
const flesch = (t) => {
  const S = sentencesCount(t), W = wordsCount(t), Y = syllablesApprox(t);
  return Math.max(0, Math.min(100, 206.835 - 1.015 * (W / S) - 84.6 * (Y / W)));
};
const sectionScore = (rec) => {
  const keys = new Set(Object.keys(rec || {}).map((k) => k.toLowerCase()));
  const expected = ["summary","experience","work","education","projects","skills","achievements"];
  const hits = expected.filter((k) => keys.has(k)).length;
  return (hits / expected.length) * 100;
};
const skillsScore = (rec) => {
  let skills = rec?.skills || rec?.Skills || [];
  if (typeof skills === "string") skills = skills.split(",").map((s) => s.trim()).filter(Boolean);
  if (!Array.isArray(skills)) skills = [];
  return Math.min(100, skills.length * 4);
};
const experienceScore = (rec) => {
  let exp = rec?.experience || rec?.work || rec?.Work || [];
  if (!Array.isArray(exp)) exp = exp ? [exp] : [];
  const roles = exp.length;
  const bullets = exp.reduce((n, r) => n + ((r && Array.isArray(r.bullets)) ? r.bullets.length : 0), 0);
  return Math.min(100, roles * 12 + bullets * 2);
};
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const keywordCoverage = (text, jdKeywords) => {
  if (!jdKeywords || !jdKeywords.length) return 0;
  const low = text.toLowerCase();
  const hits = jdKeywords.reduce(
    (n, kw) => (new RegExp(`\\b${escapeRegExp(String(kw).toLowerCase())}\\b`).test(low) ? n + 1 : n),
    0
  );
  return (hits / jdKeywords.length) * 100;
};
const overallScore = ({ formatting, skills, experience, readability, coverage }) =>
  formatting * 0.20 + skills * 0.25 + experience * 0.25 + readability * 0.15 + coverage * 0.15;

/* =========================
   Keywords (JD / fallback)
   ========================= */
async function tryLoadJDKeywords() {
  try {
    const jd = await fetchJSON("/api/versions/load/current");
    const raw = jd?.data || jd || {};
    const explicit = raw?.keywords || raw?.jd_keywords;
    if (Array.isArray(explicit) && explicit.length) return explicit.map(String);
    const text = asText(raw);
    return deriveKeywordsFromText(text, 30);
  } catch {
    return null;
  }
}
function deriveKeywordsFromText(text, k = 30) {
  const stop = new Set(["the","and","to","of","in","for","a","with","on","as","by","is","at","an","be","or","your","our","we","you","are","will","from","that","this","it","&"]);
  const words = text.toLowerCase().match(/[a-zA-Z][a-zA-Z+\-#\.]{1,}/g) || [];
  const count = new Map();
  for (const w of words) {
    if (stop.has(w)) continue;
    count.set(w, (count.get(w) || 0) + 1);
  }
  return [...count.entries()].sort((a,b)=>b[1]-a[1]).slice(0,k).map(([w])=>w);
}

/* =========================
   Profile helper
   ========================= */
async function fetchProfile() {
  try {
    return await fetchJSON("/api/profile");
  } catch {
    return null;
  }
}

/* =========================
   UI atoms
   ========================= */
function Card({ className = "", children }) {
  return <div className={`card card-float ${className}`}>{children}</div>;
}
function ScoreCard({ title, value, suffix = "%", caption }) {
  const show = Number.isFinite(value);
  return (
    <Card className="kpi-card hover-lift">
      <div className="kpi-title">
        {title}
        {caption ? <span className="badge-delta up">{caption}</span> : null}
      </div>
      <div className="kpi-value">{show ? Math.round(value) : "—"}{suffix}</div>
    </Card>
  );
}
function MetricTile({ title, value, suffix = "%" }) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <Card className="metric-tile">
      <div className="text-sm text-slate-500">{title}</div>
      <div className="mt-2">
        <div className="text-2xl font-semibold">
          {Number.isFinite(value) ? Math.round(value) : "—"}{suffix}
        </div>
        <div className="metric-bar mt-3">
          <div className="metric-bar-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Card>
  );
}
function BreakdownBar({ items }) {
  const total = Math.max(1, items.reduce((s, i) => s + (i.value || 0), 0));
  return (
    <div className="w-full">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
        {items.map((i, idx) => (
          <div
            key={i.label}
            className={`grow bg-indigo-500/80 ${idx === 0 ? "rounded-l-full" : ""} ${idx === items.length - 1 ? "rounded-r-full" : ""}`}
            style={{ width: `${(100 * (i.value || 0)) / total}%` }}
            title={`${i.label}: ${Math.round(i.value || 0)}%`}
          />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-600">
        {items.map((i) => (
          <div key={i.label} className="flex items-center justify-between">
            <span>{i.label}</span>
            <span className="font-medium">{Math.round(i.value || 0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========= Polished TrendsChart ========= */
function TrendsChart({ labels = [], datasets = [] }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (!ref.current) return;

    const css = getComputedStyle(document.documentElement);
    const palette = [
      css.getPropertyValue("--tm-series-ats").trim() || "#6366F1",
      css.getPropertyValue("--tm-series-skills").trim() || "#8B5CF6",
      css.getPropertyValue("--tm-series-coverage").trim() || "#22C55E",
    ];
    const border = css.getPropertyValue("--tm-border").trim() || "#E5E7EB";
    const muted = css.getPropertyValue("--tm-muted").trim() || "#6B7280";

    const ctx = ref.current.getContext("2d");
    const mkFill = (hex) => {
      const g = ctx.createLinearGradient(0, 0, 0, ref.current.height || 300);
      g.addColorStop(0, hex + "2A");
      g.addColorStop(1, hex + "08");
      return g;
    };
    const styled = (datasets || []).map((d, i) => {
      const color = palette[i % palette.length];
      return {
        ...d,
        borderColor: color,
        backgroundColor: mkFill(color),
        borderWidth: 2,
        pointRadius: 0,
        pointHitRadius: 10,
        pointHoverRadius: 4,
        tension: 0.35,
        cubicInterpolationMode: "monotone",
        fill: true,
        spanGaps: true,
      };
    });

    const chart = new Chart(ctx, {
      type: "line",
      data: { labels: labels, datasets: styled },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        layout: { padding: { top: 8, right: 8, bottom: 0, left: 8 } },
        plugins: {
          legend: {
            display: true,
            position: "top",
            labels: { color: muted, boxWidth: 12, boxHeight: 12, usePointStyle: true, padding: 16 },
          },
          tooltip: {
            backgroundColor: "#111827",
            titleColor: "#fff",
            bodyColor: "#E5E7EB",
            padding: 10,
            cornerRadius: 8,
            displayColors: false,
            callbacks: { 
              title: (tooltipItems) => labels[tooltipItems[0].dataIndex], // Show full label on hover
              label: (c) => `${c.dataset.label}: ${c.parsed.y}%` 
            },
          },
        },
        scales: {
          x: { 
            grid: { display: false }, 
            ticks: { 
              color: muted, 
              display: false, // <-- Hides the x-axis labels
            } 
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: { color: muted, stepSize: 20, callback: (v) => `${v}%` },
            grid: { color: border, drawBorder: false }
          },
        },
        animations: { tension: { duration: 600, easing: "easeOutCubic", from: 0.1, to: 0.35 } }
      },
    });

    return () => chart.destroy();
  }, [labels, datasets]);

  return <canvas ref={ref} />;
}

function VersionCard({ v }) {
  const score = Math.round(v?.score_overall ?? 0);
  return (
    <div className="version-card card-float hover-lift">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-slate-700">{v?.name || v?.id}</div>
          <div className="text-[11px] text-slate-500">{v?.created_at || "—"}</div>
        </div>
        <div className="text-lg font-semibold">{Number.isFinite(score) ? score : "—"}%</div>
      </div>
      <div className="mt-2 text-xs text-slate-500 line-clamp-2">
        {v?.summary || "No summary available."}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="version-chip series-skills">Skills: {Math.round(v?.score_breakdown?.skills ?? 0)}%</div>
        <div className="version-chip">Experience: {Math.round(v?.score_breakdown?.experience ?? 0)}%</div>
        <div className="version-chip">Formatting: {Math.round(v?.score_breakdown?.formatting ?? 0)}%</div>
        <div className="version-chip series-coverage">Coverage: {Math.round(v?.score_breakdown?.keyword_coverage ?? 0)}%</div>
      </div>
    </div>
  );
}

/* =========================
   Main page
   ========================= */
export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versions, setVersions] = useState([]);
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [profile, setProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState(""); // State for the search bar

  useEffect(() => {
    (async () => {
      try {
        const p = await fetchProfile();
        setProfile(p);

        const list = await fetchJSON("/api/versions/list");
        const items = Array.isArray(list?.versions) ? list.versions : [];

        const full = await Promise.all(
          items.map(async (v) => {
            try {
              const r = await fetchJSON(`/api/versions/load/${encodeURIComponent(v.id)}`);
              return { meta: v, data: r?.data ?? r ?? {} };
            } catch {
              return { meta: v, data: {} };
            }
          })
        );

        let jdKeywords = await tryLoadJDKeywords();
        if (!jdKeywords || !jdKeywords.length) {
          const corpus = full.map((x) => asText(x.data)).join(" ");
          jdKeywords = deriveKeywordsFromText(corpus, 25);
        }

        const computed = full.map(({ meta, data }) => {
          const text = asText(data);
          const sFormatting = sectionScore(data);
          const sSkills = skillsScore(data);
          const sExperience = experienceScore(data);
          const sReadability = flesch(text);
          const sCoverage = keywordCoverage(text, jdKeywords);
          const overall = overallScore({
            formatting: sFormatting,
            skills: sSkills,
            experience: sExperience,
            readability: sReadability,
            coverage: sCoverage,
          });
          return {
            id: meta.id,
            name: meta.name || meta.id,
            created_at: meta.created_at || meta.createdAt || "",
            summary: data.summary || data.professional_summary || "",
            score_overall: overall,
            score_breakdown: {
              formatting: sFormatting,
              skills: sSkills,
              experience: sExperience,
              readability: sReadability,
              keyword_coverage: sCoverage,
            },
          };
        });

        const scores = computed.map((v) => v.score_overall);
        const bestIdx = scores.length ? scores.indexOf(Math.max(...scores)) : -1;

        const ov = {
          avg_score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
          best_score: bestIdx >= 0 ? computed[bestIdx].score_overall : 0,
          best_version: bestIdx >= 0 ? computed[bestIdx].name : "—",
          avg_keyword_coverage: computed.length
            ? computed.reduce((a, b) => a + (b.score_breakdown.keyword_coverage || 0), 0) / computed.length
            : 0,
        };

        const tr = {
          labels: computed.map((v) => v.name),
          series: [
            { label: "ATS Score", data: computed.map((v) => Math.round(v.score_overall)) },
            { label: "Skills", data: computed.map((v) => Math.round(v.score_breakdown.skills)) },
            { label: "Coverage", data: computed.map((v) => Math.round(v.score_breakdown.keyword_coverage)) },
          ],
        };

        const br = {
          formatting: avg(computed.map((v) => v.score_breakdown.formatting)),
          skills: avg(computed.map((v) => v.score_breakdown.skills)),
          experience: avg(computed.map((v) => v.score_breakdown.experience)),
          readability: avg(computed.map((v) => v.score_breakdown.readability)),
        };

        setVersions(computed);
        setOverview(ov);
        setTrend(tr);
        setBreakdown(br);
      } catch (e) {
        console.error(e);
        setError(e?.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const exportCSV = () => {
    if (!versions.length) return;
    const header = ["Version","ATS","Coverage","Skills","Experience","Formatting","Readability"];
    const rows = versions.map(v => [
      `"${(v.name || "").replace(/"/g,'""')}"`,
      Math.round(v.score_overall),
      Math.round(v.score_breakdown.keyword_coverage),
      Math.round(v.score_breakdown.skills),
      Math.round(v.score_breakdown.experience),
      Math.round(v.score_breakdown.formatting),
      Math.round(v.score_breakdown.readability),
    ].join(","));
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "versions_snapshot.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };
  
  // Filter versions based on search query
  const filteredVersions = versions.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="analytics-container">
        <div className="dashboard-shell space-y-6">
          <div className="skeleton h-10 w-64 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
            <div className="skeleton h-28 rounded-2xl" />
          </div>
          <div className="skeleton h-72 rounded-2xl" />
          <div className="skeleton h-56 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="skeleton h-32 rounded-xl" />
            <div className="skeleton h-32 rounded-xl" />
            <div className="skeleton h-32 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container">
        <div className="dashboard-shell">
          <div className="rounded-xl bg-rose-50 text-rose-700 p-4 shadow-sm">
            <div className="font-semibold">Couldn’t load dashboard</div>
            <div className="text-sm mt-1">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <div className="dashboard-shell space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
            <p className="text-xs text-slate-500 mt-1">Data source: your saved versions</p>
          </div>
          {profile && (
            <div className="flex items-center gap-3">
              <img
                src={profile.avatar_url || "/default-avatar.png"}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover border"
              />
              <div className="text-right">
                <div className="text-sm font-medium text-slate-700">{profile.name || "User"}</div>
                <div className="text-xs text-slate-500">{profile.email || ""}</div>
              </div>
            </div>
          )}
        </div>

        {/* KPI row */}
        <div className="kpi-grid">
          <ScoreCard title="Average ATS Score" value={overview?.avg_score} />
          <ScoreCard title="Best Version" value={overview?.best_score} caption={overview?.best_version} />
          <ScoreCard title="Avg. Keyword Coverage" value={overview?.avg_keyword_coverage} />
        </div>

        {/* Main overview + list */}
        <div className="compact-grid">
          <Card className="chart-card is-active">
            <div className="card-head">
              <div className="card-title">Score Overview</div>
              <div className="toolbar">
                <button className="btn-icon">Weekly</button>
                <button className="btn-icon">Filter</button>
                <button className="btn-icon">⋯</button>
              </div>
            </div>
            <div className="chart-container">
              <TrendsChart
                labels={trend?.labels || []}
                datasets={(trend?.series || []).map((s) => ({ label: s.label, data: s.data }))}
              />
            </div>
            <div className="card-foot">
              <span className="legend-note">Smoothed lines; values in %</span>
              <span className="legend-note">Updated just now</span>
            </div>
          </Card>

          <Card>
            <div className="card-head">
              <div className="card-title">Versions Snapshot</div>
              <div className="toolbar">
                <button className="btn-icon" onClick={exportCSV}>Export</button>
              </div>
            </div>
            {!versions.length ? (
              <div className="text-sm text-slate-500">No versions found.</div>
            ) : (
              <table className="mini-table">
                <thead>
                  <tr>
                    <th>Version</th>
                    <th>ATS</th>
                    <th>Coverage</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.slice(0, 7).map((v) => (
                    <tr key={v.id}>
                      <td style={{ maxWidth: 240, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {v.name}
                      </td>
                      <td>{Math.round(v.score_overall)}%</td>
                      <td>{Math.round(v.score_breakdown.keyword_coverage)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        {/* Breakdown tiles */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MetricTile title="Experience Alignment" value={breakdown?.experience} />
          <MetricTile title="Skills Match" value={breakdown?.skills} />
          <MetricTile title="Formatting & Readability" value={breakdown?.readability} />
        </div>

        {/* Component breakdown */}
        <Card>
          <div className="card-title">Component Breakdown</div>
          <div className="mt-4">
            <BreakdownBar
              items={[
                { label: "Formatting", value: Math.round(breakdown?.formatting || 0) },
                { label: "Skills", value: Math.round(breakdown?.skills || 0) },
                { label: "Experience", value: Math.round(breakdown?.experience || 0) },
                { label: "Readability", value: Math.round(breakdown?.readability || 0) },
              ]}
            />
          </div>
        </Card>

        {/* Detailed versions */}
        <Card>
          <div className="card-head">
            <div className="card-title">Versions</div>
            <div className="toolbar">
              <input
                type="text"
                placeholder="Search versions..."
                className="btn-icon" /* Reusing btn-icon style for consistency */
                style={{ width: '200px', paddingLeft: '0.75rem', paddingRight: '0.75rem' }}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          {!filteredVersions.length ? (
            <div className="text-sm text-slate-500">
              {versions.length > 0 ? "No versions match your search." : "No versions found."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {filteredVersions.map((v) => <VersionCard key={v.id || v.name} v={v} />)}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* utils */
function avg(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / arr.length;
}