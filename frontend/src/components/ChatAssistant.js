import React, { useEffect, useRef, useState } from "react";
import "./ChatAssistant.css";
import ResumeVersionsSidebar from "./ResumeVersionsSidebar";

// --- tiny helper for authorized fetch (direct FastAPI call) -------------
async function authFetch(path, init = {}) {
  const token = localStorage.getItem("token");
  const headers = { "Content-Type": "application/json", ...(init.headers || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  // 👇 Absolute URL for FastAPI backend
  const baseUrl = "http://localhost:8000";
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });

  if (!res.ok) {
    const msg = await res.text().catch(() => `${res.status} ${res.statusText}`);
    throw new Error(msg || `${res.status} ${res.statusText}`);
  }

  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

// --- helpers to detect and parse JSON ops from a message --------------------
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

export default function ChatAssistant() {
  const [messages, setMessages] = useState(() => [
    {
      id: uid(),
      role: "assistant",
      content:
        "Hi! I can analyze your resume, tailor bullet points, and generate role-specific keywords. Ask me anything.\nuse the Apply button to update your resume.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [activeResume, setActiveResume] = useState(null);
  const [wsMeta, setWsMeta] = useState(null);

  const endRef = useRef(null);
  const taRef = useRef(null);
  const uploadRef = useRef(null);

  // Scroll to bottom on updates
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  // Auto-resize textarea
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "0px";
    const h = Math.min(180, taRef.current.scrollHeight);
    taRef.current.style.height = h + "px";
  }, [input]);

  // Load current workspace on mount
  useEffect(() => {
    (async () => {
      try {
        const s = await authFetch("/api/workspace/get");
        setWsMeta(s);
        setActiveResume(s?.data || null);
      } catch (e) {
        console.error("workspace/get failed", e);
      }
    })();
  }, []);

  // Send message → get assistant suggestion from FastAPI
  const send = async () => {
    if (!input.trim() || isThinking) return;
    const userMsg = { id: uid(), role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsThinking(true);

    const typingId = uid();
    setMessages((m) => [...m, { id: typingId, role: "assistant", typing: true }]);

    try {
      const data = await authFetch("/api/chat/complete", {
        method: "POST",
        body: JSON.stringify({
          message: userMsg.content,
          resume: activeResume, // optional context
        }),
      });

      setIsThinking(false);
      setMessages((m) =>
        m.filter((x) => x.id !== typingId).concat({
          id: uid(),
          role: "assistant",
          content: data.reply,
        })
      );
    } catch (e) {
      setIsThinking(false);
      setMessages((m) =>
        m.filter((x) => x.id !== typingId).concat({
          id: uid(),
          role: "assistant",
          content: `❌ Chat failed: ${e.message || "Unknown error"}`,
        })
      );
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  // Apply ops from the latest assistant message that has JSON ops
const applyOpsFromMessage = async (content) => {
  const ops = extractOpsFromText(content);
  if (!ops || !ops.length) {
    alert("No JSON patch ops found in the assistant message.");
    return;
  }
  try {
    // Optional concurrency header
    const rev = wsMeta?.rev;

    const data = await authFetch("/api/resume/patch?snapshot=1&name=Chat%20Edit", {
      method: "POST",
      headers: rev != null ? { "X-Resume-Rev": String(rev) } : undefined,
      body: JSON.stringify({
        base: activeResume, // 👈 REQUIRED by backend
        ops,
        render: "none",
      }),
    });

    // Update local state with server-validated JSON
    setActiveResume(data.updated);

    // Refresh workspace meta
    const s = await authFetch("/api/workspace/get");
    setWsMeta(s);

    // Add a system message acknowledging apply
    setMessages((m) => [
      ...m,
      {
        id: uid(),
        role: "assistant",
        content: "✅ Changes applied to your active resume (and snapshotted).",
      },
    ]);
  } catch (e) {
    console.error(e);
    alert("Failed to apply changes: " + e.message);
  }
};


  const onSelectVersion = async (json) => {
    setActiveResume(json);
    try {
      const s = await authFetch("/api/workspace/get");
      setWsMeta(s);
    } catch {}
  };

  const triggerUpload = () => uploadRef.current?.click();
  const onChooseFile = (e) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  };

  async function uploadFile(file) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("token");
      const res = await fetch("http://localhost:8000/api/files/upload", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text());
      await res.json().catch(() => ({}));
      setMessages((m) => [
        ...m,
        {
          id: uid(),
          role: "assistant",
          content: `📎 Uploaded **${file.name}**. Tell me how to use it (e.g., “extract skills”, “tailor bullets to this JD”, “parse to resume JSON”).`,
        },
      ]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { id: uid(), role: "assistant", content: `❌ Upload failed: ${e.message || "Unknown error"}` },
      ]);
    }
  }

  return (
    <div className="tm-app light">
      {/* Header */}
      <header className="tm-header" role="banner">
        <div className="tm-header-inner">
          <div className="tm-brand">
            <div className="tm-brand-mark" aria-hidden>TM</div>
            <div className="tm-brand-text">
              <div className="tm-brand-title">TellerMade</div>
              <div className="tm-brand-sub">Resume Assistant</div>
            </div>
          </div>
          <div className="tm-header-meta">
            <span className="tm-meta-pill">Free • No card required</span>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="tm-body">
        <section className="tm-chat" aria-label="Chat">
          <div className="tm-timeline" role="log" aria-live="polite">
            {messages.map((m) => (
              <Message
                key={m.id}
                role={m.role}
                typing={m.typing}
                content={m.content}
                onApply={() => applyOpsFromMessage(m.content)}
              />
            ))}
            {isThinking && <div className="tm-spacer" />}
            <div ref={endRef} />
          </div>

          {/* Composer */}
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
                placeholder="Ask your resume assistant…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
              />
              <button
                className="tm-send"
                onClick={send}
                disabled={isThinking || !input.trim()}
                title="Send"
                aria-label="Send message"
              >
                {isThinking ? <span className="tm-spinner" /> : <SendIcon />}
              </button>
            </div>

            <div className="tm-hints">
              <span>Press <kbd>Enter</kbd> to send • <kbd>Shift</kbd>+<kbd>Enter</kbd> for newline</span>
              <span>Model: Gemini • Responses are real</span>
            </div>
          </footer>
        </section>

        <aside className="tm-sidewrap" aria-label="Resume versions">
          <ResumeVersionsSidebar className="tm-sidebar" currentJson={activeResume} onSelect={onSelectVersion} />
        </aside>
      </div>
    </div>
  );
}

function Message({ role, typing, content, onApply }) {
  const isUser = role === "user";
  const hasOps = !isUser && !typing && !!extractOpsFromText(content);

  return (
    <div className={`tm-msg ${isUser ? "tm-msg-user" : "tm-msg-assistant"}`}>
      <div className="tm-orb" aria-hidden />
      <div className={`tm-bubble ${isUser ? "tm-bubble-user" : "tm-bubble-assistant"}`}>
        {typing ? (
          <Typing />
        ) : (
          <Copyable text={content}>
            <div className="tm-textwrap">
              <p className="tm-text">{content}</p>
              {hasOps ? (
                <div className="tm-applybar">
                  <button className="tm-apply" onClick={onApply} title="Apply changes to your resume">
                    Apply changes
                  </button>
                </div>
              ) : null}
            </div>
          </Copyable>
        )}
      </div>
      {isUser && <div className="tm-you">You</div>}
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
      {text ? (
        <button
          className="tm-copy"
          onClick={copy}
          title={copied ? "Copied" : "Copy"}
          aria-label={copied ? "Copied" : "Copy to clipboard"}
        >
          {copied ? <CheckIcon /> : <ClipboardIcon />}
        </button>
      ) : null}
    </div>
  );
}

// --- icons --------------------------------------------------------------
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

// --- utilities --------------------------------------------------------------
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(36);
}
