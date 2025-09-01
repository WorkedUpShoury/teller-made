import React, { useState, useRef, useEffect } from "react";
import "./ResumeUploadPage.css";

const MAX_MB = 5;
const ACCEPTED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// Optional: set your API hosts here so you can change them without touching code elsewhere.
const FASTAPI_BASE = process.env.REACT_APP_FASTAPI_BASE || "http://127.0.0.1:8000";
const FLASK_BASE = process.env.REACT_APP_FLASK_BASE || "http://127.0.0.1:5001";

export default function ResumeUploadPage() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDesc, setJobDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const fileInputRef = useRef(null);

  const step = !resumeFile ? 1 : jobDesc.trim() ? 3 : 2;

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(""), 4000);
      return () => clearTimeout(t);
    }
  }, [error]);

  const clickFilePicker = () => fileInputRef.current?.click();

  const validateFile = (file) => {
    if (!file) return "No file selected.";
    if (!ACCEPTED.includes(file.type))
      return "Please upload a PDF or Word document (.pdf, .doc, .docx).";
    if (file.size > MAX_MB * 1024 * 1024) return `File is too large (max ${MAX_MB}MB).`;
    return "";
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    const err = validateFile(file);
    if (err) {
      setError(err);
      setResumeFile(null);
    } else {
      setResumeFile(file);
      setSuccess("");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    const err = validateFile(file);
    if (err) {
      setError(err);
      setResumeFile(null);
    } else {
      setResumeFile(file);
      setSuccess("");
    }
  };

  // Utility: extract filename from Content-Disposition (if server provides it)
  const getFilenameFromHeaders = (response, fallback) => {
    const cd = response.headers.get("Content-Disposition") || response.headers.get("content-disposition");
    if (!cd) return fallback;
    // Example: attachment; filename="Shoury_Sinha_Resume.pdf"
    const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(cd);
    const raw = decodeURIComponent(match?.[1] || match?.[2] || match?.[3] || "").trim();
    return raw || fallback;
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    setSuccess("");
    setError("");
    if (!resumeFile || !jobDesc.trim()) {
      setError("Please upload your resume and paste the job description.");
      return;
    }

    setLoading(true);

    try {
      // Route based on file type:
      // - PDF → FastAPI (/resumes/pdf) expects "file" + "jd", returns PDF
      // - DOC/DOCX → Flask (/api/optimize) expects "resumeFile" + "jobDesc", returns DOCX
      const isPDF = resumeFile.type === "application/pdf";

      if (isPDF) {
        const formData = new FormData();
        formData.append("file", resumeFile);
        formData.append("jd", jobDesc);

        const response = await fetch(`${FASTAPI_BASE}/resumes/pdf`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          throw new Error(errJson?.detail || `HTTP error! Status: ${response.status}`);
        }

        const blob = await response.blob();
        const filename = getFilenameFromHeaders(response, "optimized_resume.pdf");
        downloadBlob(blob, filename);
        setSuccess("Your resume has been optimized and downloaded as PDF.");
      } else {
        // DOC/DOCX path to Flask
        const formData = new FormData();
        formData.append("resumeFile", resumeFile);
        formData.append("jobDesc", jobDesc);

        const response = await fetch(`${FLASK_BASE}/api/optimize`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errJson = await response.json().catch(() => null);
          throw new Error(errJson?.error || `HTTP error! Status: ${response.status}`);
        }

        const blob = await response.blob();
        const filename = getFilenameFromHeaders(response, "optimized_resume.docx");
        downloadBlob(blob, filename);
        setSuccess("Your resume has been optimized and downloaded as DOCX.");
      }
    } catch (err) {
      console.error("Error optimizing resume:", err);
      setError(`Optimization failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const removeFile = () => setResumeFile(null);

  return (
    <div className="ru-root">
      <div className="ru-bg" aria-hidden />

      <section className="ru-hero">
        <h1 className="ru-title">
          Tailor Your Resume with <span className="ru-grad">AI Precision</span>
        </h1>
        <p className="ru-subtitle">
          Upload your resume, optimize keywords, and pass ATS filters to land your dream job.
        </p>
      </section>

      <div className="ru-layout">
        {/* Main */}
        <div className="ru-main">
          <div className="ru-card" aria-busy={loading}>
            <div className="ru-ribbon" aria-hidden />

            {/* Stepper */}
            <ol className="ru-steps" aria-label="Progress">
              <li className={step >= 1 ? "is-active" : ""}>
                <span>1</span> Upload
              </li>
              <li className={step >= 2 ? "is-active" : ""}>
                <span>2</span> Paste JD
              </li>
              <li className={step >= 3 ? "is-active" : ""}>
                <span>3</span> Optimize
              </li>
            </ol>

            {error && (
              <div className="ru-alert ru-alert-error" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className="ru-alert ru-alert-success" role="status">
                {success}
              </div>
            )}

            {/* Dropzone */}
            <div
              className={`ru-drop ${dragActive ? "is-drag" : ""} ${resumeFile ? "has-file" : ""}`}
              onClick={clickFilePicker}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={(e) => {
                e.preventDefault();
                setDragActive(false);
              }}
              onDrop={handleDrop}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clickFilePicker()}
              aria-label="Upload resume"
            >
              <input
                ref={fileInputRef}
                type="file"
                // Accept PDF + DOC/DOCX (we route accordingly in handleSubmit)
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="ru-file"
                onChange={handleFileChange}
              />

              {!resumeFile ? (
                <div className="ru-drop-inner">
                  <div className="ru-drop-icon" aria-hidden>
                    <svg viewBox="0 0 24 24" width="44" height="44">
                      <path fill="currentColor" opacity=".25" d="M12 3l3 3-3 3-3-3 3-3z" />
                      <path fill="currentColor" d="M11 6h2v8h-2z" />
                    </svg>
                  </div>
                  <div className="ru-drop-text">
                    <strong>Drag & drop your resume</strong> or{" "}
                    <span className="ru-link">browse files</span>
                  </div>
                  <div className="ru-hint">PDF, DOC, DOCX — max {MAX_MB}MB</div>
                </div>
              ) : (
                <div className="ru-filechip" onClick={(e) => e.stopPropagation()}>
                  <div className="ru-filemeta">
                    <span className="ru-filename">{resumeFile.name}</span>
                    <span className="ru-filesize">
                      {(resumeFile.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                  <button className="ru-remove" onClick={removeFile} aria-label="Remove file">
                    ×
                  </button>
                </div>
              )}
              <div className="ru-drop-pattern" aria-hidden />
            </div>

            {/* Divider */}
            <div className="ru-divider" aria-hidden />

            {/* Job description */}
            <div className="ru-field">
              <label htmlFor="jd" className="ru-label">Job Description</label>
              <textarea
                id="jd"
                rows={8}
                className="ru-textarea"
                placeholder="Paste the job description here…"
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
              />
              <div className="ru-counter">{jobDesc.length.toLocaleString()} characters</div>
            </div>

            <button
              className="ru-btn ru-btn-primary"
              onClick={handleSubmit}
              disabled={loading || !resumeFile || !jobDesc.trim()}
            >
              {loading ? <span className="ru-spinner" aria-hidden /> : null}
              {loading ? "Optimizing…" : "Optimize My Resume"}
            </button>
          </div>

          {/* Feature band with pattern */}
          <div className="ru-band">
            <div className="ru-feature">
              <div className="ru-feature-emblem">✨</div>
              <div>
                <h3>AI Optimization</h3>
                <p>Smart keyword alignment to your target role.</p>
              </div>
            </div>
            <div className="ru-feature">
              <div className="ru-feature-emblem">📄</div>
              <div>
                <h3>ATS Friendly</h3>
                <p>Formatting that passes modern tracking systems.</p>
              </div>
            </div>
            <div className="ru-feature">
              <div className="ru-feature-emblem">⚡</div>
              <div>
                <h3>Fast Results</h3>
                <p>Get an optimized resume in seconds.</p>
              </div>
            </div>
            <div className="ru-band-pattern" aria-hidden />
          </div>

          {/* CTA */}
          <div className="ru-cta">
            <div>
              <h4>Ready to transform your job search?</h4>
              <p>Free forever • No credit card required</p>
            </div>
            <button className="ru-btn ru-btn-light" onClick={clickFilePicker}>Try it now</button>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="ru-side">
          <div className="ru-sidecard">
            <h4 className="ru-side-title">Pro tips</h4>
            <ul className="ru-tips">
              <li><span>🧠</span> Paste the full JD (responsibilities + requirements) for best matching.</li>
              <li><span>🎯</span> Mention impact with numbers (e.g., “reduced costs by 18%”).</li>
              <li><span>🔑</span> Include domain terms (cloud, NLP, compliance, etc.).</li>
            </ul>
          </div>

          <div className="ru-sidecard">
            <h4 className="ru-side-title">Shortcuts</h4>
            <div className="ru-shortcuts">
              <kbd>Ctrl</kbd> + <kbd>V</kbd> <span>Paste JD</span>
              <kbd>Enter</kbd> <span>Optimize</span>
            </div>
          </div>

          <div className="ru-sidecard ru-sidecard-accent">
            <h4 className="ru-side-title">Private & Secure</h4>
            <p className="ru-side-text">We only process your file to generate the optimized version you download.</p>
          </div>
        </aside>
      </div>

      {loading && (
        <div className="ru-overlay" aria-hidden>
          <div className="ru-loader" />
        </div>
      )}
    </div>
  );
}
