// src/components/ChatAssistant.js
import React, { useEffect, useRef, useState } from "react";
import "./ChatAssistant.css";

export default function ChatAssistant() {
  const [messages, setMessages] = useState(() => [
    {
      id: uid(),
      role: "assistant",
      content:
        "Hi! I can analyze your resume, tailor bullet points, and generate role-specific keywords. Ask me anything.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const endRef = useRef(null);
  const taRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  useEffect(() => {
    // auto-resize textarea
    if (!taRef.current) return;
    taRef.current.style.height = "0px";
    const h = Math.min(168, taRef.current.scrollHeight);
    taRef.current.style.height = h + "px";
  }, [input]);

  const send = async () => {
    if (!input.trim() || isThinking) return;
    const userMsg = { id: uid(), role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsThinking(true);

    // show typing placeholder
    const typingId = uid();
    setMessages((m) => [...m, { id: typingId, role: "assistant", typing: true }]);

    // mock reply – replace with your API call
    const reply = await mockInference(userMsg.content);

    setIsThinking(false);
    setMessages((m) =>
      m
        .filter((x) => x.id !== typingId)
        .concat({ id: uid(), role: "assistant", content: reply })
    );
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <div className="tm-root">
        {/* Header */}
        <header className="tm-header">
          <div className="tm-header-inner">
            <div className="tm-title">
              <span className="tm-badge" aria-hidden>
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2">
                  <path d="M12 3l3 3-3 3-3-3 3-3zM6 9l3 3-3 3-3-3 3-3zm12 0l3 3-3 3-3-3 3-3zM12 15l3 3-3 3-3-3 3-3z" />
                </svg>
              </span>
              <span>Resume Assistant</span>
            </div>
            <span className="tm-note">Free • No card required</span>
          </div>
        </header>

        {/* Timeline */}
        <main className="tm-main">
          {messages.map((m) => (
            <Message key={m.id} role={m.role} typing={m.typing} content={m.content} />
          ))}
          {isThinking && <div className="tm-spacer" />}
          <div ref={endRef} />
        </main>

        {/* Composer */}
        <footer className="tm-composer-wrap">
          <div className="tm-composer">
            {/* animated bot by the input */}
            <div className="tm-mini-bot" aria-hidden>
              <div className="tm-mini-bot-core">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M3 12h3M18 12h3M12 3v3M12 18v3" />
                </svg>
              </div>
              <span className="tm-mini-bot-ping" />
            </div>

            <div className="tm-input-row">
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
                {isThinking ? (
                  <span className="tm-spinner" />
                ) : (
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden>
                    <path d="M2 21l20-9L2 3v6l14 3L2 15v6z" />
                  </svg>
                )}
              </button>
            </div>

            <div className="tm-hints">
              <span>
                Press <kbd>Enter</kbd> to send • <kbd>Shift</kbd>+<kbd>Enter</kbd> for newline
              </span>
              <span>Model: demo • Responses are simulated</span>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

function Message({ role, typing, content }) {
  const isUser = role === "user";
  return (
    <div className={`tm-row ${isUser ? "tm-row-user" : "tm-row-assistant"}`}>
      {!isUser && (
        <div className="tm-avatar" aria-hidden>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="white" strokeWidth="2">
            <circle cx="12" cy="12" r="4" />
            <path d="M3 12h3M18 12h3M12 3v3M12 18v3" />
          </svg>
        </div>
      )}

      <div className={`tm-bubble ${isUser ? "tm-bubble-user" : "tm-bubble-assistant"}`}>
        {typing ? (
          <Typing />
        ) : (
          <Copyable text={content}>
            <p className="tm-text">{content}</p>
          </Copyable>
        )}
      </div>

      {isUser && (
        <div className="tm-userpill" aria-hidden>
          You
        </div>
      )}
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
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };
  return (
    <div className="tm-copyable">
      {children}
      {text ? (
        <button className="tm-copy" onClick={copy} title="Copy" aria-label="Copy to clipboard">
          {copied ? "✔" : "⧉"}
        </button>
      ) : null}
    </div>
  );
}

// --- utilities --------------------------------------------------------------
function uid() {
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(36);
}

async function mockInference(_prompt) {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  await delay(900 + Math.random() * 700);
  const canned = [
    "Here are 5 high-impact keywords to improve ATS matching for AI/ML roles: Python, TensorFlow/PyTorch, MLOps, NLP, Cloud (AWS/GCP/Azure).",
    "Tip: Start each bullet with a strong verb and quantify outcomes: “Deployed BERT-based classifier cutting false negatives by 18%.”",
    "Paste a job description and I’ll tailor your resume bullets to match it while keeping them truthful.",
  ];
  return canned[Math.floor(Math.random() * canned.length)] + "\n\n(Mock reply — connect to your API here.)";
}
