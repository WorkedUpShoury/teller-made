import React, { useState, useRef, useEffect } from "react";
import "./ResumeUploadPage.css";
import ResumeVersionsSidebar from "./ResumeVersionsSidebar";

const MAX_MB = 5;
const ACCEPTED = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

// One backend: FastAPI, mounted under /api
const API_BASE =
  (process.env.REACT_APP_FASTAPI_BASE || "http://127.0.0.1:8000") + "/api";

export default function ResumeUploadPage() {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDesc, setJobDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [pulseDrop, setPulseDrop] = useState(false);
  const [mounted, setMounted] = useState(false);
  const fileInputRef = useRef(null);

  // Base JSON shown in versions sidebar (optional)
  const [baseJson, setBaseJson] = useState(null);

  const step = !resumeFile ? 1 : jobDesc.trim() ? 3 : 2;

  useEffect(() => setMounted(true), []);

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
      setBaseJson(null); // Clear any selection from sidebar
      setSuccess("");
      setPulseDrop(true);
      setTimeout(() => setPulseDrop(false), 900);
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
      setBaseJson(null); // Clear any selection from sidebar
      setSuccess("");
      setPulseDrop(true);
      setTimeout(() => setPulseDrop(false), 900);
    }
  };

  const handleVersionSelect = (json) => {
    setBaseJson(json);
    // Create a mock file object for UI consistency and to advance the stepper
    setResumeFile({
      name: json.meta?.fileName || "Previously Saved Version",
      size: 0, // Differentiates from a real file
      isVirtual: true, // A flag to identify this as a JSON-based resume
    });
    setError("");
    setSuccess(`Selected "${json.meta?.fileName || 'resume'}" from your versions.`);
    
    // Animate the dropzone
    setPulseDrop(true);
    setTimeout(() => setPulseDrop(false), 900);
  };

  const getFilenameFromHeaders = (raw, fallback) => {
    if (!raw) return fallback;
    const match = /filename\*=UTF-8''([^;]+)|filename="([^"]+)"|filename=([^;]+)/i.exec(raw);
    const name = decodeURIComponent(match?.[1] || match?.[2] || match?.[3] || "").trim();
    return name || fallback;
  };

  const postWithProgress = ({ url, formData, jsonData, fileSize, fallbackName }) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let fakeTimer = null;

      const setPct = (n) => setProgress((p) => (n > p ? Math.min(100, Math.round(n)) : p));

      xhr.open("POST", url, true);
      
      if (jsonData) {
        // Handle JSON request
        xhr.setRequestHeader("Content-Type", "application/json");
        xhr.responseType = "blob";
      } else {
        // Handle FormData request
        xhr.responseType = "blob";
      }

      if (xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const uploaded = (e.loaded / (e.total || fileSize || 1)) * 25;
            setPct(uploaded);
          }
        };
      }

      xhr.onloadstart = () => setPct(5);

      xhr.onprogress = (e) => {
        if (fakeTimer) {
          clearInterval(fakeTimer);
          fakeTimer = null;
        }
        if (e.lengthComputable && e.total > 0) {
          const dl = (e.loaded / e.total) * 15;
          setPct(85 + dl);
        } else {
          setPct(92);
        }
      };

      const startProcessingSim = () => {
        if (fakeTimer) return;
        fakeTimer = setInterval(() => {
          setProgress((p) => {
            if (p < 85) return p + 0.6;
            clearInterval(fakeTimer);
            fakeTimer = null;
            return p;
          });
          return;
        }, 120);
      };
      if (xhr.upload) {
        xhr.upload.onload = startProcessingSim;
      } else {
        // For JSON requests, start sim immediately
        startProcessingSim();
      }
      
      xhr.onerror = () => {
        if (fakeTimer) clearInterval(fakeTimer);
        reject(new Error("Network error"));
      };

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 4) {
          if (fakeTimer) clearInterval(fakeTimer);
          if (xhr.status >= 200 && xhr.status < 300) {
            setPct(100);
            const cd = xhr.getResponseHeader("Content-Disposition");
            const filename = getFilenameFromHeaders(cd, fallbackName);
            resolve({ blob: xhr.response, filename });
          } else {
            try {
              const reader = new FileReader();
              reader.onload = () => {
                try {
                  const j = JSON.parse(reader.result);
                  reject(new Error(j?.detail || j?.error || `HTTP error! Status: ${xhr.status}`));
                } catch {
                  reject(new Error(`HTTP error! Status: ${xhr.status}`));
                }
              };
              reader.readAsText(xhr.response || new Blob());
            } catch {
              reject(new Error(`HTTP error! Status: ${xhr.status}`));
            }
          }
        }
      };

      if (jsonData) {
        xhr.send(JSON.stringify(jsonData));
      } else {
        xhr.send(formData);
      }
    });

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
      setError("Please select your resume and paste the job description.");
      return;
    }
    setLoading(true);
    setProgress(0);

    try {
      let result;
      // Check if it's a virtual file from the sidebar or a real uploaded file
      if (resumeFile.isVirtual && baseJson) {
        // If it's from the sidebar, send the JSON data
        result = await postWithProgress({
          url: `${API_BASE}/resumes/json-to-pdf`, // Assumes a new endpoint for this flow
          jsonData: { resume_json: baseJson, jd: jobDesc },
          fallbackName: "optimized_resume.pdf",
        });
      } else {
        // Otherwise, send the actual file via FormData
        const formData = new FormData();
        formData.append("file", resumeFile);
        formData.append("jd", jobDesc);
        result = await postWithProgress({
          url: `${API_BASE}/resumes/file-to-pdf`, // Assumes endpoint for file uploads
          formData,
          fileSize: resumeFile.size,
          fallbackName: "optimized_resume.pdf",
        });
      }
      
      const { blob, filename } = result;
      downloadBlob(blob, filename);
      setSuccess("Your resume has been optimized and downloaded as PDF.");
      
    } catch (err) {
      console.error("Error optimizing resume:", err);
      setError(`Optimization failed: ${err.message}`);
    } finally {
      setLoading(false);
      setProgress(0);
    }
  };

  const removeFile = () => {
    setResumeFile(null);
    setBaseJson(null);
  };

  return (
    <div className={`ru-root ${mounted ? "is-mounted" : ""}`}>
      {/* Subtle gradient background */}
      <div className="ru-background" aria-hidden />

      {/* Header */}
      <header className="ru-header">
        <div className="ru-header-content">
          <h1 className="ru-title">
            Resume <span className="ru-title-accent">Optimizer</span>
          </h1>
          <p className="ru-subtitle">
            AI-powered resume tailoring for ATS optimization and job matching
          </p>
        </div>
      </header>

      <div className="ru-layout">
        {/* Main content */}
        <main className="ru-main">
          <div className="ru-card">
            <div className="ru-card-header">
              <h2>Optimize Your Resume</h2>
              <p>Upload your resume and job description to get started</p>
            </div>

            {/* Stepper */}
            <div className="ru-stepper">
              <div className="ru-stepper-progress" style={{ width: `${(step - 1) * 50}%` }} />
              <div className={`ru-stepper-step ${step >= 1 ? "is-active" : ""}`}>
                <div className="ru-stepper-number">1</div>
                <span>Upload Resume</span>
              </div>
              <div className={`ru-stepper-step ${step >= 2 ? "is-active" : ""}`}>
                <div className="ru-stepper-number">2</div>
                <span>Job Description</span>
              </div>
              <div className={`ru-stepper-step ${step >= 3 ? "is-active" : ""}`}>
                <div className="ru-stepper-number">3</div>
                <span>Optimize</span>
              </div>
            </div>

            {error && (
              <div className="ru-alert ru-alert-error" role="alert">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="ru-alert ru-alert-success" role="status">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                </svg>
                <span>{success}</span>
              </div>
            )}

            {/* File upload area */}
            <div className="ru-upload-section">
              <div
                className={`ru-dropzone ${dragActive ? "is-dragover" : ""} ${resumeFile ? "has-file" : ""} ${pulseDrop ? "is-pulse" : ""}`}
                onClick={clickFilePicker}
                onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                onDrop={handleDrop}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && clickFilePicker()}
                aria-label="Upload resume"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="ru-file-input"
                  onChange={handleFileChange}
                />

                {!resumeFile ? (
                  <div className="ru-dropzone-content">
                    <div className="ru-dropzone-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 4V16M12 16L9 13M12 16L15 13" stroke="var(--c3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M20 16V18C20 19.1046 19.1046 20 18 20H6C4.89543 20 4 19.1046 4 18V16" stroke="var(--c3)" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <div className="ru-dropzone-text">
                      <h3>Drag & drop your resume</h3>
                      <p>or <span className="ru-link">browse files</span></p>
                    </div>
                    <div className="ru-dropzone-hint">Supports PDF, DOC, DOCX (max {MAX_MB}MB)</div>
                  </div>
                ) : (
                  <div className="ru-file-preview" onClick={(e) => e.stopPropagation()}>
                    <div className="ru-file-icon">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z" stroke="var(--c3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M14 2V8H20" stroke="var(--c3)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                    <div className="ru-file-info">
                      <div className="ru-file-name">{resumeFile.name}</div>
                      <div className="ru-file-size">
                        {!resumeFile.isVirtual && `${(resumeFile.size / (1024 * 1024)).toFixed(2)} MB`}
                      </div>
                    </div>
                    <button className="ru-file-remove" onClick={removeFile} aria-label="Remove file">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M3.646 3.646a.5.5 0 01.708 0L8 7.293l3.646-3.647a.5.5 0 01.708.708L8.707 8l3.647 3.646a.5.5 0 01-.708.708L8 8.707l-3.646 3.647a.5.5 0 01-.708-.708L7.293 8 3.646 4.354a.5.5 0 010-.708z" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Job description input */}
            <div className="ru-input-section">
              <label htmlFor="jobDescription" className="ru-input-label">Job Description</label>
              <textarea
                id="jobDescription"
                rows={6}
                className="ru-textarea"
                placeholder="Paste the job description you're targeting..."
                value={jobDesc}
                onChange={(e) => setJobDesc(e.target.value)}
              />
              <div className="ru-input-counter">
                <span>{jobDesc.length.toLocaleString()}</span> characters
              </div>
            </div>

            <button
              className="ru-primary-button"
              onClick={handleSubmit}
              disabled={loading || !resumeFile || !jobDesc.trim()}
            >
              {loading ? (
                <>
                  <svg className="ru-button-spinner" width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/>
                    <path d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z">
                      <animateTransform attributeName="transform" type="rotate" dur="0.75s" values="0 12 12;360 12 12" repeatCount="indefinite" />
                    </path>
                  </svg>
                  Optimizing...
                </>
              ) : (
                "Optimize My Resume"
              )}
            </button>
          </div>

          {/* Features section */}
          <div className="ru-features">
            <h3 className="ru-features-title">Why use our Resume Optimizer?</h3>
            <div className="ru-features-grid">
              <div className="ru-feature-card">
                <div className="ru-feature-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="var(--c1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h4>ATS Optimization</h4>
                <p>Formatting and keywords that pass Applicant Tracking Systems</p>
              </div>
              <div className="ru-feature-card">
                <div className="ru-feature-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9.66317 17H4.66296C3.55839 17 2.66296 16.1046 2.66296 15V5C2.66296 3.89543 3.55839 3 4.66296 3H14.6632C15.7677 3 16.6632 3.89543 16.6632 5V10M16.6632 13V11.5C16.6632 10.1193 17.7825 9 19.1632 9C20.5439 9 21.6632 10.1193 21.6632 11.5V13M16.6632 13H21.6632M16.6632 13V17M21.6632 13V17M6.66296 7H12.6632M6.66296 11H10.6632" stroke="var(--c2)" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <h4>Keyword Matching</h4>
                <p>Align your resume with job requirements using AI analysis</p>
              </div>
              <div className="ru-feature-card">
                <div className="ru-feature-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="var(--c4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <h4>Fast Results</h4>
                <p>Get an optimized, professional resume in minutes</p>
              </div>
            </div>
          </div>
        </main>

        {/* Right rail: Versions Sidebar */}
        <aside className="ru-sidebar">
          <ResumeVersionsSidebar
            currentJson={baseJson}
            onSelect={handleVersionSelect}
            showModeControls={true}
          />
        </aside>
      </div>

      {/* Progress overlay */}
      {loading && (
        <div className="ru-overlay" role="status" aria-live="polite">
          <div className="ru-progress-modal">
            <div className="ru-progress-content">
              <h3>Optimizing Your Resume</h3>
              <div className="ru-progress-value">{Math.round(progress)}%</div>
              <div className="ru-progress-bar">
                <div
                  className="ru-progress-fill"
                  style={{ width: `${Math.min(100, Math.round(progress))}%` }}
                />
              </div>
              <div className="ru-progress-steps">
                <span className={progress > 10 ? "is-complete" : ""}>Uploading</span>
                <span className={progress > 40 ? "is-complete" : ""}>Analyzing</span>
                <span className={progress > 70 ? "is-complete" : ""}>Optimizing</span>
                <span className={progress >= 100 ? "is-complete" : ""}>Finalizing</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}