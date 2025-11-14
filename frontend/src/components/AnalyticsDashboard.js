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
   ATS heuristics (All fixes included)
   ========================= */
const asText = (obj) => {
  if (obj == null) return "";
  if (typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map(asText).join(" ");
  if (typeof obj === "object") return Object.entries(obj).map(([k, v]) => `${k} ${asText(v)}`).join(" ");
  return String(obj);
};

const wordsCount = (t) => Math.max(1, t.trim().split(/\s+/).filter(Boolean).length);

const lenientReadability = (t) => {
  const W = wordsCount(t);
  const score = (W / 500) * 100;
  return Math.max(0, Math.min(100, score));
};

const sectionScore = (rec) => {
  if (!rec) return 0;
  const found = new Set();
  
  if (rec.summary) found.add("summary");
  if (rec.skills && rec.skills.length > 0) found.add("skills");

  (rec.sections || []).forEach(sec => {
    if (sec.type) found.add(sec.type.toLowerCase());
  });

  const coreExpected = ["summary", "education", "skills"];
  let hits = coreExpected.filter((k) => found.has(k)).length;

  const expLike = ["experience", "projects", "volunteer", "work"];
  if (expLike.some(k => found.has(k))) {
    hits += 1;
  }
  
  const bonusExpected = ["achievements", "certifications"];
  hits += bonusExpected.filter((k) => found.has(k)).length;
  
  const totalExpected = 6;
  return (hits / totalExpected) * 100;
};

const skillsScore = (rec) => {
  let allSkills = [];

  let topSkills = rec?.skills || rec?.Skills || [];
  if (typeof topSkills === "string") {
    allSkills = allSkills.concat(topSkills.split(",").map((s) => s.trim()).filter(Boolean));
  } else if (Array.isArray(topSkills)) {
    allSkills = allSkills.concat(topSkills);
  }

  const skillsetsSection = (rec?.sections || []).find(s => s.type === "skillsets");
  if (skillsetsSection && Array.isArray(skillsetsSection.items)) {
    skillsetsSection.items.forEach(item => {
      if (item) {
        if (Array.isArray(item.languages)) allSkills = allSkills.concat(item.languages);
        if (Array.isArray(item.soft)) allSkills = allSkills.concat(item.soft);
        if (Array.isArray(item.concepts)) allSkills = allSkills.concat(item.concepts);
        if (Array.isArray(item.tools)) allSkills = allSkills.concat(item.tools);
        if (Array.isArray(item.platforms)) allSkills = allSkills.concat(item.platforms);
      }
    });
  }
  
  const skillsSection = (rec?.sections || []).find(s => s.type === "skills");
  if (skillsSection && Array.isArray(skillsSection.items)) {
     skillsSection.items.forEach(item => {
        if (typeof item === 'string') allSkills.push(item);
        else if (item && typeof item.name === 'string') allSkills.push(item.name);
     });
  }

  const uniqueSkills = [...new Set(allSkills.filter(Boolean))];
  return Math.min(100, uniqueSkills.length * 4);
};

const experienceScore = (rec) => {
  const expSection = (rec?.sections || []).find(s => s.type === "experience");
  let expItems = expSection?.items || rec?.experience || rec?.work || rec?.Work || [];
  if (!Array.isArray(expItems)) expItems = expItems ? [expItems] : [];

  const projSection = (rec?.sections || []).find(s => s.type === "projects");
  let projItems = projSection?.items || [];
  if (!Array.isArray(projItems)) projItems = projItems ? [projItems] : [];

  const volSection = (rec?.sections || []).find(s => s.type === "volunteer");
  let volItems = volSection?.items || [];
  if (!Array.isArray(volItems)) volItems = volItems ? [volItems] : [];

  const roles = expItems.length;
  const roleBullets = expItems.reduce((n, r) => n + ((r && Array.isArray(r.bullets)) ? r.bullets.length : 0), 0);
  const roleScore = roles * 12 + roleBullets * 2;

  const projects = projItems.length;
  const projectBullets = projItems.reduce((n, r) => n + ((r && Array.isArray(r.bullets)) ? r.bullets.length : 0), 0);
  const projectScore = projects * 10 + projectBullets * 2;

  const volunteer = volItems.length;
  const volunteerBullets = volItems.reduce((n, r) => n + ((r && Array.isArray(r.bullets)) ? r.bullets.length : 0), 0);
  const volunteerScore = volunteer * 8 + volunteerBullets * 2;
  
  return Math.min(100, roleScore + projectScore + volunteerScore);
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

async function fetchProfile() {
  try {
    return await fetchJSON("/api/profile");
  } catch {
    return null;
  }
}

/* =========================
   New UI Components
   ========================= */

function Header({ profile, searchQuery, setSearchQuery }) {
  return (
    <header className="ad-header">
      <h1>Analytics</h1>
      <div className="ad-header-right">
        <input
          type="text"
          placeholder="Search..."
          className="ad-search-bar"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {profile && (
          <div className="ad-profile">
            <div className="ad-profile-name">{profile.name || "User"}</div>
            <img
              src={profile.avatar_url || "/default-avatar.png"}
              alt="Profile"
              className="ad-profile-img"
            />
          </div>
        )}
      </div>
    </header>
  );
}

function KpiCard({ title, value, caption }) {
  const show = Number.isFinite(value);
  return (
    <div className="kpi-card">
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{show ? Math.round(value) : "—"}%</div>
      {caption && <div className="kpi-caption">{caption}</div>}
    </div>
  );
}

function BreakdownLegend({ breakdown }) {
  const items = [
    { label: "Formatting", value: Math.round(breakdown?.formatting || 0) },
    { label: "Skills", value: Math.round(breakdown?.skills || 0) },
    { label: "Experience", value: Math.round(breakdown?.experience || 0) },
    { label: "Readability", value: Math.round(breakdown?.readability || 0) },
  ];
  
  return (
    <div className="breakdown-legend">
      {items.map((i) => (
        <div key={i.label} className="breakdown-legend-item">
          <span>{i.label}</span>
          <span>{i.value}%</span>
        </div>
      ))}
    </div>
  );
}

function TrendsChart({ labels = [], datasets = [] }) {
  const ref = useRef(null);
  
  useEffect(() => {
    if (!ref.current) return;

    const css = getComputedStyle(document.documentElement);
    const palette = [
      css.getPropertyValue("--primary-purple").trim() || "#7C3AED",
      css.getPropertyValue("--primary-pink").trim() || "#EC4899",
      "#22C55E", // Fallback green
    ];
    const border = css.getPropertyValue("--border-color").trim() || "#E2E8F0";
    const muted = css.getPropertyValue("--text-secondary").trim() || "#6B7280";
    const primaryText = css.getPropertyValue("--text-primary").trim() || "#1E1A3F";

    const ctx = ref.current.getContext("2d");
    const mkFill = (hex) => {
      const g = ctx.createLinearGradient(0, 0, 0, ref.current.height || 300);
      g.addColorStop(0, hex + "33");
      g.addColorStop(1, hex + "00");
      return g;
    };
    
    const styled = (datasets || []).map((d, i) => {
      const color = palette[i % palette.length];
      return {
        ...d,
        borderColor: color,
        backgroundColor: mkFill(color),
        borderWidth: 2.5,
        pointRadius: 0,
        pointHitRadius: 10,
        pointHoverRadius: 5,
        pointHoverBorderWidth: 3,
        pointHoverBackgroundColor: color,
        pointHoverBorderColor: "#FFFFFF",
        tension: 0.4,
        fill: true,
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
            align: "end",
            labels: { 
              color: muted, 
              boxWidth: 12, 
              boxHeight: 12, 
              usePointStyle: true, 
              padding: 20,
              font: { weight: '500' }
            },
          },
          tooltip: {
            backgroundColor: "#FFFFFF",
            titleColor: primaryText,
            bodyColor: muted,
            padding: 12,
            cornerRadius: 10,
            borderColor: border,
            borderWidth: 1,
            displayColors: true,
            callbacks: { 
              title: (tooltipItems) => labels[tooltipItems[0].dataIndex],
              label: (c) => ` ${c.dataset.label}: ${c.parsed.y}%`
            },
          },
        },
        scales: {
          x: { 
            grid: { display: false }, 
            ticks: { display: false } 
          },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: { color: muted, stepSize: 20, callback: (v) => `${v}%` },
            grid: { color: border, drawBorder: false }
          },
        },
      },
    });

    return () => chart.destroy();
  }, [labels, datasets]);

  return <canvas ref={ref} />;
}

/* --- NEW VersionCard with POPUP --- */
function VersionCard({ v }) {
  const score = Math.round(v?.score_overall ?? 0);
  const b = v?.score_breakdown || {};

  return (
    <div className="version-card">
      
      {/* Front (Small Square) */}
      <div className="version-card-front">
        <div className="version-card-front-header">
          <div className="version-card-front-title">{v?.name || v?.id}</div>
          <div className="version-card-front-score">{Number.isFinite(score) ? score : "—"}%</div>
        </div>
        
        <div className="version-card-chips">
          <div className="version-chip-small">Skills: {Math.round(b.skills ?? 0)}%</div>
          <div className="version-chip-small">Exp: {Math.round(b.experience ?? 0)}%</div>
          <div className="version-chip-small">Format: {Math.round(b.formatting ?? 0)}%</div>
          <div className="version-chip-small">Cover: {Math.round(b.keyword_coverage ?? 0)}%</div>
        </div>
      </div>

      {/* Back (The Popup) */}
      <div className="version-card-popup">
        <div className="version-title">{v?.name || v?.id}</div>
        <div className="version-summary">
          {v?.summary || "No summary available."}
        </div>
        <div className="details-title">Detailed Score Breakdown</div>
        <ul>
          <li><span>Skills Match:</span> <span>{Math.round(b.skills ?? 0)}%</span></li>
          <li><span>Experience:</span> <span>{Math.round(b.experience ?? 0)}%</span></li>
          <li><span>Formatting:</span> <span>{Math.round(b.formatting ?? 0)}%</span></li>
          <li><span>Readability:</span> <span>{Math.round(b.readability ?? 0)}%</span></li>
          <li><span>Keyword Coverage:</span> <span>{Math.round(b.keyword_coverage ?? 0)}%</span></li>
        </ul>
      </div>
    </div>
  );
}

/* =========================
   Main Dashboard Component
   ========================= */
export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [versions, setVersions] = useState([]);
  const [overview, setOverview] = useState(null);
  const [trend, setTrend] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [profile, setProfile] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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
          const sReadability = lenientReadability(text); 
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

        br.formatting_readability = (br.formatting + br.readability) / 2;

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
  
  const filteredVersions = versions.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="analytics-container">
        <main className="ad-main-content">
          <Header profile={profile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          <div>Loading...</div>
          {/* Add Skeleton Loaders here */}
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-container">
        <main className="ad-main-content">
          <Header profile={profile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
          <div className="ad-card">
            <h2 className="ad-card-title" style={{color: 'var(--danger)'}}>Couldn’t load dashboard</h2>
            <p>{error}</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="analytics-container">
      <main className="ad-main-content">
        <Header profile={profile} searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        
        <div className="kpi-grid">
          <KpiCard title="Average ATS Score" value={overview?.avg_score} />
          <KpiCard title="Best Version" value={overview?.best_score} caption={overview?.best_version} />
          <KpiCard title="Avg. Keyword Coverage" value={overview?.avg_keyword_coverage} />
        </div>

        <div className="ad-card">
          <div className="ad-card-header">
            <div className="ad-card-title">Score Overview</div>
            <div className="ad-card-toolbar">
              <button className="ad-button">Weekly</button>
            </div>
          </div>
          <div className="chart-container">
            <TrendsChart
              labels={trend?.labels || []}
              datasets={(trend?.series || []).map((s) => ({ label: s.label, data: s.data }))}
            />
          </div>
        </div>

        <div className="ad-bottom-grid">
          <div className="ad-card">
            <div className="ad-card-title">Component Breakdown</div>
            <div className="metric-bar" style={{marginTop: '1.5rem'}}>
              <div className="metric-bar-fill" style={{ width: `${overview?.avg_score || 0}%` }} />
            </div>
            <BreakdownLegend breakdown={breakdown} />
          </div>

          <div className="ad-card">
            <div className="ad-card-header">
              <div className="ad-card-title">Versions Snapshot</div>
              <div className="ad-card-toolbar">
                <button className="ad-button" onClick={exportCSV}>Export</button>
              </div>
            </div>
            <ul style={{listStyle: 'none', fontSize: '0.9rem', color: 'var(--text-secondary)'}}>
              {versions.slice(0, 5).map((v) => (
                <li key={v.id} style={{display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)'}}>
                  <span>{v.name}</span>
                  <span style={{fontWeight: 600, color: 'var(--text-primary)'}}>{Math.round(v.score_overall)}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="ad-card">
          <div className="ad-card-header">
            <div className="ad-card-title">All Versions</div>
          </div>
          {!filteredVersions.length ? (
            <div style={{color: 'var(--text-secondary)'}}>
              {versions.length > 0 ? "No versions match your search." : "No versions found."}
            </div>
          ) : (
            <div className="version-grid">
              {filteredVersions.map((v) => <VersionCard key={v.id || v.name} v={v} />)}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}

function avg(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0) / arr.length;
}

