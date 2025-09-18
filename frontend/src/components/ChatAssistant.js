import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./ChatAssistant.css";
import ResumeVersionsSidebar from "./ResumeVersionsSidebar";
import ResumePreview from "./ResumePreview";

// --- API endpoint for the backend ---
const API_BASE = (process.env.REACT_APP_FASTAPI_BASE || "http://127.0.0.1:8000") + "/api";

// --- Helper for authorized fetch ---
async function authFetch(path, init = {}) {
  const headers = { "Content-Type": "application/json", ...(init.headers || {}) };
  // In a real app, you might get a token from localStorage
  // const token = localStorage.getItem("token");
  // if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status} ${res.statusText}`);
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/pdf")) {
    return res.blob();
  }
  return ct.includes("application/json") ? res.json() : res.text();
}

// --- Helper to parse JSON Patch operations from AI response ---
function extractOpsFromText(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed; // Direct array of ops
    if (parsed && Array.isArray(parsed.ops)) return parsed.ops; // Ops nested in an object
  } catch {}
  return null;
}

export default function ChatAssistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [activeResume, setActiveResume] = useState(null);
  const [wsMeta, setWsMeta] = useState(null); // Holds metadata like version name/id
  const [isLoading, setIsLoading] = useState(true);
  const [previewPdf, setPreviewPdf] = useState(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // State to control the sidebar overlay's visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navigate = useNavigate();
  const endRef = useRef(null);
  const taRef = useRef(null);
  const uploadRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    const h = Math.min(180, taRef.current.scrollHeight);
    taRef.current.style.height = `${h}px`;
  }, [input]);

  useEffect(() => {
    // Optional: Only focus if a resume is already loaded
    if (activeResume) {
      taRef.current?.focus();
    }
  }, [isLoading, activeResume]);
  // Load initial workspace and resume
  useEffect(() => {
    (async () => {
      try {
        const workspaceData = await authFetch("/workspace/get");
        if (workspaceData && workspaceData.data) {
          setActiveResume(workspaceData.data);
          setWsMeta({ name: workspaceData.name, id: workspaceData.id });
          setMessages([{ id: uid(), role: "assistant", content: `Hi! I'm ready to work on **${workspaceData.name || 'your resume'}**. Ask me anything.` }]);
        } else {
          setMessages([{ id: uid(), role: "assistant", content: "Welcome! Upload a resume to get started." }]);
        }
      } catch (e) {
        console.error("Failed to load initial data", e);
        setMessages([{ id: uid(), role: "assistant", content: `❌ Error loading your workspace: ${e.message}` }]);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const send = async () => {
    if (!input.trim() || isThinking || !activeResume) return;
    const userMsg = { id: uid(), role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsThinking(true);
    const typingId = uid();
    setMessages((m) => [...m, { id: typingId, role: "assistant", typing: true }]);

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
        setMessages((m) =>
          m.filter((x) => x.id !== typingId).concat({
            id: uid(),
            role: "assistant",
            content: aiResponse.reply.replace(/```json[\s\S]*?```/, "\n✅ Changes applied. You can preview the updated PDF."),
            showPreviewButton: true,
          })
        );
      } else {
        setMessages((m) =>
          m.filter((x) => x.id !== typingId).concat({
            id: uid(),
            role: "assistant",
            content: aiResponse.reply,
          })
        );
      }
    } catch (e) {
      setMessages((m) =>
        m.filter((x) => x.id !== typingId).concat({
          id: uid(),
          role: "assistant",
          content: `❌ An error occurred: ${e.message || "Unknown error"}`,
        })
      );
    } finally {
      setIsThinking(false);
    }
  };

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
      console.error("PDF rendering failed", e);
      alert(`PDF rendering failed: ${e.message}`);
      setIsPreviewOpen(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const onSelectVersion = (resumeJson, versionMeta) => {
    if (!resumeJson || !versionMeta || !versionMeta.id) {
      console.error("onSelectVersion called with invalid data", { resumeJson, versionMeta });
      return;
    }
    setActiveResume(resumeJson);
    setWsMeta({ name: versionMeta.name, id: versionMeta.id });
    setMessages((m) => [...m, { id: uid(), role: "assistant", content: `✅ Switched to version: **${versionMeta.name}**` }]);
    setIsSidebarOpen(false); // Close sidebar after selecting
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewPdf(null);
  };

  const triggerUpload = () => uploadRef.current?.click();
  const onChooseFile = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  const uploadFile = async (file) => {
    setIsThinking(true);
    const thinkingId = uid();
    setMessages((m) => [...m, { id: thinkingId, role: "assistant", content: `Processing **${file.name}**...` }]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("jd", "General resume, no specific job description provided yet.");

      const optimizedResume = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/resumes/upload-and-optimize`, true);
        xhr.responseType = "json";
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.response);
          } else {
            reject(new Error(xhr.response?.detail || `Server error: ${xhr.status}`));
          }
        };
        xhr.onerror = () => reject(new Error("Network error during upload."));
        xhr.send(formData);
      });

      const versionData = {
        name: file.name,
        content: optimizedResume,
      };
      const newVersion = await authFetch("/versions", {
        method: "POST",
        body: JSON.stringify(versionData),
      });

      setActiveResume(newVersion.content);
      setWsMeta({ name: newVersion.name, id: newVersion.id });

      setMessages((m) =>
        m.filter((msg) => msg.id !== thinkingId).concat({
          id: uid(),
          role: "assistant",
          content: `✅ Successfully processed **${file.name}**. It's now the active resume.`,
        })
      );
    } catch (err) {
      console.error("Error uploading file:", err);
      setMessages((m) =>
        m.filter((msg) => msg.id !== thinkingId).concat({
          id: uid(),
          role: "assistant",
          content: `❌ **Upload Failed:** ${err.message}`,
        })
      );
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="tm-app light">
      <header className="tm-header" role="banner">
        <div className="tm-header-inner">
          <div className="tm-brand">
            <div className="tm-brand-mark" aria-hidden>TM</div>
            <div className="tm-brand-text">
              <div className="tm-brand-title">TellerMade</div>
              <div className="tm-brand-sub">Resume Assistant</div>
            </div>
          </div>
          <div className="tm-header-actions">
            <button className="tm-header-btn" onClick={() => setIsSidebarOpen(true)}>
              Versions
            </button>
          </div>
        </div>
      </header>
      <div className="tm-body">
        <section className="tm-chat" aria-label="Chat">
          <div className="tm-timeline" role="log" aria-live="polite">
            {isLoading ? (
              <div className="tm-msg tm-msg-assistant"><Typing /></div>
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
            {isThinking && !isLoading && <div className="tm-msg tm-msg-assistant"><Typing /></div>}
            <div ref={endRef} />
          </div>
          <footer className="tm-composer" role="form" aria-label="Message composer">
            <div className="tm-input-row">
              <button className="tm-upload" onClick={triggerUpload} title="Upload a file" aria-label="Upload file">
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
                rows={1}
                placeholder={activeResume ? "Ask your resume assistant…" : "Upload a resume to begin"}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                disabled={isLoading || !activeResume}
              />
              <button
                className="tm-send"
                onClick={send}
                disabled={isLoading || isThinking || !input.trim() || !activeResume}
                title="Send"
                aria-label="Send message"
              >
                {isThinking ? <span className="tm-spinner" /> : <SendIcon />}
              </button>
            </div>
            <div className="tm-hints">
              <span>Press <kbd>Enter</kbd> to send • <kbd>Shift</kbd>+<kbd>Enter</kbd> for newline</span>
            </div>
          </footer>
        </section>
      </div>

      {isSidebarOpen && (
        <div className="tm-sidebar-overlay">
          <div className="tm-sidebar-backdrop" onClick={() => setIsSidebarOpen(false)} />
          <ResumeVersionsSidebar
            className="tm-sidebar"
            currentJson={activeResume}
            onSelect={onSelectVersion}
            onClose={() => setIsSidebarOpen(false)}
          />
        </div>
      )}

      <ResumePreview
        isOpen={isPreviewOpen}
        onClose={closePreview}
        pdfBlob={previewPdf}
      />
    </div>
  );
}

// Helper components and functions below are complete and unchanged
function applyPatch(doc, patch) {
  const newDoc = JSON.parse(JSON.stringify(doc));
  patch.forEach(op => {
    const path = op.path.split('/').slice(1).map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
    let current = newDoc;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    const finalKey = path[path.length - 1];
    if (op.op === 'replace') {
      current[finalKey] = op.value;
    } else if (op.op === 'add') {
      if (Array.isArray(current)) {
        current.splice(parseInt(finalKey, 10), 0, op.value);
      } else if (typeof current === 'object' && current !== null) {
        current[finalKey] = op.value;
      }
    } else if (op.op === 'remove') {
      if (Array.isArray(current)) {
        current.splice(parseInt(finalKey, 10), 1);
      } else {
        delete current[finalKey];
      }
    }
  });
  return newDoc;
}

function Message({ role, typing, content, showPreviewButton, onPreview }) {
  const isUser = role === "user";
  return (
    <div className={`tm-msg ${isUser ? "tm-msg-user" : "tm-msg-assistant"}`}>
      <div className="tm-orb" aria-hidden />
      <div className={`tm-bubble ${isUser ? "tm-bubble-user" : "tm-bubble-assistant"}`}>
        {typing ? ( <Typing /> ) : (
          <Copyable text={content}>
            <div className="tm-textwrap">
              <div dangerouslySetInnerHTML={{ __html: content.replace(/\n/g, '<br />') }} />
              {showPreviewButton && (
                <div className="tm-applybar">
                  <button className="tm-apply" onClick={onPreview} title="Preview the updated resume as a PDF">
                    Preview
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

function Typing() {
  return (
    <div className="tm-typing" aria-live="polite" aria-label="Assistant is typing">
      <span>Analyzing</span>
      <span className="tm-dots" aria-hidden>
        <i style={{ animationDelay: "-300ms" }} />
        <i style={{ animationDelay: "-150ms" }} />
        <i />
      </span>
    </div>
  );
}

function Copyable({ text, children }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(text || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 900);
    } catch {}
  };
  return (
    <div className="tm-copyable">
      {children}
      {text && (
        <button
          className="tm-copy"
          onClick={copy}
          title={copied ? "Copied" : "Copy"}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />}
        </button>
      )}
    </div>
  );
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M2 21l20-9L2 3v6l14 3L2 15v6z" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
      <path d="M16.5 6.5l-6.8 6.8a3 3 0 104.2 4.2l7.2-7.2a5 5 0 10-7.1-7.1L5.8 11.4" />
    </svg>
  );
}

function ClipboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 3h6a2 2 0 012 2v1h1a2 2 0 012 2v11a2 2 0 01-2 2H8a2 2 0 01-2-2V8a2 2 0 012-2h1V5a2 2 0 012-2z"/>
      <rect x="7" y="9" width="10" height="10" rx="2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 6L9 17l-5-5"/>
    </svg>
  );
}

function uid() {
  return Math.random().toString(36).substring(2, 9) + Date.now();
}