import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./ChatAssistant.css";

// --- API endpoint ---
const API_BASE = (process.env.REACT_APP_FASTAPI_BASE || "http://127.0.0.1:8000") + "/api";

// --- Authorized fetch ---
async function authFetch(path, init = {}) {
  const headers = { "Content-Type": "application/json", ...(init.headers || {}) };
  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status} ${res.statusText}`);
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/pdf")) return res.blob();
  return ct.includes("application/json") ? res.json() : res.text();
}

// --- Extract patch operations ---
function extractOpsFromText(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (parsed && Array.isArray(parsed.ops)) return parsed.ops;
  } catch {}
  return null;
}

// --- Apply JSON Patch ---
function applyPatch(doc, patch) {
  const newDoc = JSON.parse(JSON.stringify(doc));
  patch.forEach(op => {
    const path = op.path.split('/').slice(1);
    let current = newDoc;
    for (let i = 0; i < path.length - 1; i++) current = current[path[i]];
    const key = path[path.length - 1];
    if (op.op === 'replace') current[key] = op.value;
    else if (op.op === 'add') Array.isArray(current) ? current.splice(parseInt(key, 10), 0, op.value) : current[key] = op.value;
    else if (op.op === 'remove') Array.isArray(current) ? current.splice(parseInt(key, 10), 1) : delete current[key];
  });
  return newDoc;
}

// --- Generate unique ID ---
function uid() {
  return Math.random().toString(36).substring(2, 9) + Date.now();
}

export default function ChatAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [activeResume, setActiveResume] = useState(null);
  const [wsMeta, setWsMeta] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [previewPdf, setPreviewPdf] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chatHistory, setChatHistory] = useState({});
  const [versions, setVersions] = useState([]);
  const [showWelcome, setShowWelcome] = useState(true);

  const endRef = useRef(null);
  const taRef = useRef(null);
  const uploadRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  // Auto-resize textarea
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = `${Math.min(120, taRef.current.scrollHeight)}px`;
  }, [input]);

  // Initialize workspace
  useEffect(() => {
    (async () => {
      try {
        const workspaceData = await authFetch("/workspace/get");
        if (workspaceData && workspaceData.data) {
          setActiveResume(workspaceData.data);
          setWsMeta({ name: workspaceData.name, id: workspaceData.selectedVersionId });
          
          const welcomeMsg = {
            id: uid(),
            role: "assistant",
            content: `👋 Hi! I'm your AI Resume Assistant, ready to help with **${workspaceData.name || "your resume"}**.\n\n💡 **Quick Tips:**\n• Ask me to improve specific sections\n• Request keyword optimization for jobs\n• Get suggestions for achievements\n• Rewrite in different tones\n\nWhat would you like to work on first?`
          };
          
          setMessages([welcomeMsg]);
          setChatHistory({ [workspaceData.id]: [welcomeMsg] });
          
          // Load all versions
          loadVersionsList();
        } else {
          setMessages([{ 
            id: uid(), 
            role: "assistant", 
            content: "👋 Welcome! Upload a resume to get started with AI-powered optimization." 
          }]);
        }
      } catch (e) {
        setMessages([{ 
          id: uid(), 
          role: "assistant", 
          content: `❌ Error loading workspace: ${e.message}` 
        }]);
      } finally {
        setIsLoading(false);
        setTimeout(() => setShowWelcome(false), 5000);
      }
    })();
  }, []);

  // Load versions list
  const loadVersionsList = async () => {
    try {
      // Fetch data from the /versions endpoint
      const versionsData = await authFetch("/versions/list"); 

      // Check if response is an object with a 'versions' key, like in ResumeVersionsSidebar.js
      if (versionsData && Array.isArray(versionsData.versions)) {
        setVersions(versionsData.versions);
      } else if (Array.isArray(versionsData)) {
        // Fallback in case the /versions endpoint just returns an array
        setVersions(versionsData);
      } else {
        setVersions([]); // Default to empty array on unexpected data
        console.error("Unexpected versions data format:", versionsData);
      }
    } catch (e) {
      console.error("Failed to load versions:", e);
    }
  };

  // Send message
  const send = async () => {
    if (!input.trim() || isThinking || !activeResume) return;
    
    setShowWelcome(false);
    const userMsg = { id: uid(), role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsThinking(true);

    try {
      const aiResponse = await authFetch("/chat/complete", {
        method: "POST",
        body: JSON.stringify({ message: userMsg.content, resume: activeResume }),
      });

      const ops = extractOpsFromText(aiResponse.reply);
      
      if (ops && ops.length > 0) {
        const patchedResume = applyPatch(activeResume, ops);
        await authFetch(`/versions/overwrite/${wsMeta.id}`, {
          method: "POST",
          body: JSON.stringify(patchedResume),
        });
        setActiveResume(patchedResume);
        
        const assistantMsg = {
          id: uid(),
          role: "assistant",
          content: aiResponse.reply.replace(/```json[\s\S]*?```/, "\n✅ Changes applied! You can preview it."),
          showPreviewButton: true,
        };
        const updatedMessages = [...newMessages, assistantMsg];
        setMessages(updatedMessages);
        setChatHistory(prev => ({ ...prev, [wsMeta.id]: updatedMessages }));
      } else {
        const assistantMsg = {
          id: uid(),
          role: "assistant",
          content: aiResponse.reply,
        };
        const updatedMessages = [...newMessages, assistantMsg];
        setMessages(updatedMessages);
        setChatHistory(prev => ({ ...prev, [wsMeta.id]: updatedMessages }));
      }
    } catch (e) {
      setMessages(prev => [...prev, {
        id: uid(),
        role: "assistant",
        content: `❌ Error: ${e.message || "Unknown error"}`,
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  // Preview PDF
  const handlePreview = async () => {
    if (!activeResume) return;
    setIsPreviewOpen(true);
    try {
      const blob = await authFetch("/render/pdf", {
        method: "POST",
        body: JSON.stringify({ form: activeResume }),
      });
      setPreviewPdf(blob);
    } catch (e) {
      alert(`PDF rendering failed: ${e.message}`);
      setIsPreviewOpen(false);
    }
  };

  // Handle keyboard shortcuts
  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Trigger file upload
  const triggerUpload = () => uploadRef.current?.click();

  // Handle file selection
  const onChooseFile = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  // Upload file
  const uploadFile = async (file) => {
    setShowWelcome(false);
    setIsThinking(true);
    const thinkingId = uid();
    setMessages((m) => [...m, { 
      id: thinkingId, 
      role: "assistant", 
      content: `📤 Processing **${file.name}**...` 
    }]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jd", "General resume, no job description yet.");

      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${API_BASE}/resumes/upload-and-optimize`, true);
      xhr.responseType = "json";

      const optimizedResume = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
          else reject(new Error(xhr.response?.detail || `Server error: ${xhr.status}`));
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(formData);
      });

      const versionData = { name: file.name, content: optimizedResume };
      const newVersion = await authFetch("/versions", {
        method: "POST",
        body: JSON.stringify(versionData),
      });

      setActiveResume(newVersion.content);
      setWsMeta({ name: newVersion.name, id: newVersion.id });
      
      const successMsg = {
        id: uid(),
        role: "assistant",
        content: `✅ Uploaded **${file.name}** successfully! How can I help you improve it?`,
      };
      
      setMessages((m) => m.filter((msg) => msg.id !== thinkingId).concat(successMsg));
      setChatHistory(prev => ({ ...prev, [newVersion.id]: [successMsg] }));
      
      // Reload versions list
      loadVersionsList();
    } catch (err) {
      setMessages((m) =>
        m.filter((msg) => msg.id !== thinkingId).concat({
          id: uid(),
          role: "assistant",
          content: `❌ Upload Failed: ${err.message}`,
        })
      );
    } finally {
      setIsThinking(false);
    }
  };

  // Load a specific version
  const loadVersion = async (versionId, versionName) => {
    try {
      const versionData = await authFetch(`/versions/load/${versionId}`);
      setActiveResume(versionData.data);
      setWsMeta({ id: versionId, name: versionName });
      
      // Load chat history for this version or start fresh
      const history = chatHistory[versionId] || [{
        id: uid(),
        role: "assistant",
        content: `📄 Loaded **${versionName}**. How can I help you improve it?`
      }];
      setMessages(history);
      setIsSidebarOpen(false);
    } catch (e) {
      alert(`Failed to load version: ${e.message}`);
    }
  };

  // Close preview
  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewPdf(null);
  };

  // Set quick prompt
  const setQuickPrompt = (prompt) => {
    setInput(prompt);
    taRef.current?.focus();
  };

  return (
    <div className="tm-app">
      {/* Animated Background */}
      <div className="tm-bg-animation">
        <div className="tm-orb-1"></div>
        <div className="tm-orb-2"></div>
        <div className="tm-orb-3"></div>
        <div className="tm-grid"></div>
      </div>

      {/* Sidebar Toggle */}
      <button className="tm-sidebar-toggle" onClick={() => setIsSidebarOpen(true)}>
        <MenuIcon />
      </button>

      {/* Sidebar */}
      {isSidebarOpen && (
        <>
          <div className="tm-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
          <div className="tm-sidebar">
            <div className="tm-sidebar-header">
              <div className="tm-brand">
                <div className="tm-brand-mark">TM</div>
                <div className="tm-brand-text">
                  <div className="tm-brand-title">TellerMade</div>
                  <div className="tm-brand-sub">Resume Assistant</div>
                </div>
              </div>
              <button className="tm-sidebar-close" onClick={() => setIsSidebarOpen(false)}>
                <CloseIcon />
              </button>
            </div>

            <div className="tm-sidebar-section">
              <div className="tm-section-title">
                <VersionIcon />
                <span>Resume Versions</span>
              </div>
              <div className="tm-versions-list">
                {versions.length > 0 ? (
                  versions.map((version) => (
                    <button
                      key={version.id}
                      className={`tm-version-item ${wsMeta?.id === version.id ? 'active' : ''}`}
                      onClick={() => loadVersion(version.id, version.name)}
                    >
                      <DocumentIcon />
                      <div className="tm-version-info">
                        <div className="tm-version-name">{version.name}</div>
                        <div className="tm-version-meta">
                          {chatHistory[version.id]?.length || 0} messages
                        </div>
                      </div>
                      {wsMeta?.id === version.id && <CheckIcon />}
                    </button>
                  ))
                ) : (
                  <div style={{ padding: '1rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    No versions yet. Upload a resume to start!
                  </div>
                )}
              </div>
            </div>

            <div className="tm-sidebar-section">
              <div className="tm-section-title">
                <InfoIcon />
                <span>Features</span>
              </div>
              <div className="tm-feature-list">
                <div className="tm-feature-item">
                  <SparkleIcon />
                  <span>AI-Powered Suggestions</span>
                </div>
                <div className="tm-feature-item">
                  <TargetIcon />
                  <span>ATS Optimization</span>
                </div>
                <div className="tm-feature-item">
                  <ZapIcon />
                  <span>Instant Previews</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Chat Area */}
      <div className="tm-body">
        <section className="tm-chat">
          {/* Welcome Card */}
          {showWelcome && messages.length === 1 && (
            <div className="tm-welcome-card">
              <div className="tm-welcome-icon">
                <RobotIcon />
              </div>
              <h2 className="tm-welcome-title">Welcome to TellerMade! 🚀</h2>
              <p className="tm-welcome-text">
                Your AI-powered resume assistant is ready to help you create an outstanding resume.
              </p>
              <div className="tm-welcome-features">
                <div className="tm-welcome-feature">
                  <UploadCloudIcon />
                  <span>Upload your resume</span>
                </div>
                <div className="tm-welcome-feature">
                  <MessageSquareIcon />
                  <span>Chat with AI assistant</span>
                </div>
                <div className="tm-welcome-feature">
                  <EyeIcon />
                  <span>Preview changes instantly</span>
                </div>
              </div>
            </div>
          )}

          {/* Messages Timeline */}
          <div className="tm-timeline">
            {isLoading ? (
              <div className="tm-msg tm-msg-assistant">
                <div className="tm-orb tm-orb-assistant" />
                <div className="tm-bubble tm-bubble-assistant">
                  <Typing />
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <Message
                  key={m.id}
                  role={m.role}
                  content={m.content}
                  typing={m.typing}
                  showPreviewButton={m.showPreviewButton}
                  onPreview={handlePreview}
                />
              ))
            )}
            {isThinking && !isLoading && (
              <div className="tm-msg tm-msg-assistant">
                <div className="tm-orb tm-orb-assistant" />
                <div className="tm-bubble tm-bubble-assistant">
                  <Typing />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Input Composer */}
          <footer className="tm-composer">
            <div className="tm-composer-hints">
              <button className="tm-hint-chip" onClick={() => setQuickPrompt("Improve my professional summary")}>
                ✨ Improve summary
              </button>
              <button className="tm-hint-chip" onClick={() => setQuickPrompt("Add quantifiable achievements to my experience")}>
                📊 Add metrics
              </button>
              <button className="tm-hint-chip" onClick={() => setQuickPrompt("Optimize my resume for ATS systems")}>
                🎯 ATS optimize
              </button>
              <button className="tm-hint-chip" onClick={() => setQuickPrompt("Make it more concise and impactful")}>
                ⚡ Make it concise
              </button>
            </div>
            <div className="tm-input-row">
              <button className="tm-upload" onClick={triggerUpload} title="Upload resume">
                <PaperclipIcon />
              </button>
              <input
                ref={uploadRef}
                type="file"
                className="tm-upload-input"
                onChange={onChooseFile}
                accept=".pdf,.doc,.docx,.txt,.json"
              />
              <textarea
                ref={taRef}
                className="tm-textarea"
                placeholder={activeResume ? "Ask me anything about your resume... (Shift+Enter for new line)" : "Upload a resume to begin"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={isLoading || !activeResume}
                rows={1}
              />
              <button
                className="tm-send"
                onClick={send}
                disabled={isThinking || !input.trim() || !activeResume}
                title="Send message"
              >
                {isThinking ? <span className="tm-spinner" /> : <SendIcon />}
              </button>
            </div>
          </footer>
        </section>
      </div>

      {/* Preview Modal */}
      {isPreviewOpen && (
        <div className="tm-preview-overlay" onClick={closePreview}>
          <div className="tm-preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tm-preview-header">
              <h3>📄 Resume Preview</h3>
              <button onClick={closePreview}>
                <CloseIcon />
              </button>
            </div>
            <div className="tm-preview-body">
              {previewPdf ? (
                <iframe
                  src={URL.createObjectURL(previewPdf)}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                  title="Resume Preview"
                />
              ) : (
                <div className="tm-preview-placeholder">
                  <DocumentIcon />
                  <p>Loading PDF preview...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// MESSAGE COMPONENT
// ============================================
function Message({ role, typing, content, showPreviewButton, onPreview }) {
  const isUser = role === "user";
  return (
    <div className={`tm-msg ${isUser ? "tm-msg-user" : "tm-msg-assistant"}`}>
      <div className="tm-orb" />
      <div className={`tm-bubble ${isUser ? "tm-bubble-user" : "tm-bubble-assistant"}`}>
        {typing ? (
          <Typing />
        ) : (
          <Copyable text={content}>
            <div className="tm-textwrap">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              {showPreviewButton && (
                <div className="tm-applybar">
                  <button className="tm-apply" onClick={onPreview}>
                    Preview Resume
                  </button>
                </div>
              )}
            </div>
          </Copyable>
        )}
      </div>
    </div>
  );
}

// ============================================
// TYPING INDICATOR
// ============================================
function Typing() {
  return (
    <div className="tm-typing">
      <span>Analyzing</span>
      <span className="tm-dots">
        <i /><i /><i />
      </span>
    </div>
  );
}

// ============================================
// COPYABLE WRAPPER
// ============================================
function Copyable({ text, children }) {
  const [copied, setCopied] = useState(false);
  
  const copy = async () => {
    await navigator.clipboard.writeText(String(text || ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };
  
  return (
    <div className="tm-copyable">
      {children}
      {text && (
        <button className="tm-copy" onClick={copy} title={copied ? "Copied!" : "Copy message"}>
          {copied ? <CheckIcon /> : <ClipboardIcon />}
        </button>
      )}
    </div>
  );
}

// ============================================
// ICONS
// ============================================
function SendIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2 21l20-9L2 3v6l14 3L2 15v6z" /></svg>;
}

function PaperclipIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" /></svg>;
}

function ClipboardIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;
}

function CheckIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" fill="none" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>;
}

function MenuIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
}

function DocumentIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>;
}

function VersionIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>;
}

function InfoIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>;
}

function SparkleIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 0l1.8 5.5L19 7.4l-5.5 1.8L11.6 14 10 8.5 5 6.8l5-1.6L12 0zm5 12l.9 2.8 2.9.9-2.9.9-.9 2.8-.9-2.8-2.8-.9 2.8-.9.9-2.8z"/></svg>;
}

function TargetIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
}

function ZapIcon() {
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"/></svg>;
}

function RobotIcon() {
  return <svg viewBox="0 0 24 24" width="40" height="40" fill="currentColor"><path d="M12 2a2 2 0 012 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 017 7h1a1 1 0 011 1v3a1 1 0 01-1 1h-1v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1H2a1 1 0 01-1-1v-3a1 1 0 011-1h1a7 7 0 017-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 012-2zM8 14a2 2 0 100 4 2 2 0 000-4zm8 0a2 2 0 100 4 2 2 0 000-4z"/></svg>;
}

function UploadCloudIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 16l-4-4-4 4"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/><polyline points="16 16 12 12 8 16"/></svg>;
}

function MessageSquareIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>;
}

function EyeIcon() {
  return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>;
}