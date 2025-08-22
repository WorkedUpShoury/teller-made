import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Send, Loader2, Copy, Check } from "lucide-react";

/**
 * ChatGPT‑style UI for your resume assistant
 * — React + TailwindCSS + Framer Motion + lucide-react
 *
 * Notes
 * - Uses Tailwind utility classes for styling (no Bootstrap needed)
 * - Accent palette is violet→fuchsia to echo your hero gradient
 * - Bubbles, subtle shadows, and motion give a friendly, conversational feel
 * - Includes: typing/“Analyzing…” indicator, animated bot next to the composer, Enter-to-send, Shift+Enter for newline
 * - Swap `mockInference()` with your real API call
 */

// Design tokens (reference only; Tailwind classes use nearest equivalents)
const TOKENS = {
  bg: "#0B0F14", // background (≈ zinc-950)
  panel: "#111827", // panel (≈ slate-900)
  text: "#E5E7EB", // text (≈ gray-200)
  subtext: "#A1A1AA", // subtext (≈ zinc-400)
  border: "#27272A", // border (≈ zinc-800)
  accentFrom: "#7C3AED", // violet-600
  accentTo: "#C026D3", // fuchsia-600
  userBubble: ["from-violet-600", "to-fuchsia-600"],
};

export default function ChatLikeUI() {
  const [messages, setMessages] = useState(() => [
    {
      id: cryptoRandomId(),
      role: "assistant",
      content:
        "Hi! I can analyze your resume, tailor bullet points, and generate role‑specific keywords. Ask me anything.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    // Auto-scroll to the latest message
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  const sendMessage = async () => {
    if (!input.trim() || isThinking) return;

    const userMsg = { id: cryptoRandomId(), role: "user", content: input.trim() };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setIsThinking(true);

    // Show a temporary typing placeholder while “analyzing”
    const typingId = cryptoRandomId();
    setMessages((m) => [
      ...m,
      { id: typingId, role: "assistant", content: "", typing: true },
    ]);

    // Mock inference — replace with your API call
    const reply = await mockInference(userMsg.content);

    setIsThinking(false);
    setMessages((m) =>
      m
        .filter((msg) => msg.id !== typingId)
        .concat({ id: cryptoRandomId(), role: "assistant", content: reply })
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 selection:bg-violet-600/30">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-800/80 bg-zinc-950/75 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/60">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2 font-medium">
            <span className="relative grid h-7 w-7 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg shadow-fuchsia-900/20">
              <Bot className="h-4 w-4" />
            </span>
            <span>Resume Assistant</span>
          </div>
          <span className="text-xs text-zinc-400">Free • No card required</span>
        </div>
      </header>

      {/* Chat timeline */}
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 pb-40 pt-6">
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <ChatBubble key={m.id} role={m.role} typing={m.typing}>
              {m.content}
            </ChatBubble>
          ))}
        </AnimatePresence>
        {/* Explicit thinking state keeps the bottom spacer true to ChatGPT */}
        {isThinking && <span className="text-xs text-zinc-500"> </span>}
        <div ref={scrollRef} />
      </main>

      {/* Composer */}
      <Composer
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        onKeyDown={handleKeyDown}
        disabled={isThinking}
      />
    </div>
  );
}

function ChatBubble({ role, children, typing }) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 28, mass: 0.6 }}
      className={`flex w-full items-end gap-2 ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-md">
          <Bot className="h-4 w-4" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={`max-w-[78%] rounded-2xl p-3 shadow-sm ${
          isUser
            ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-br-md"
            : "bg-zinc-900 text-zinc-100 border border-zinc-800 rounded-bl-md"
        }`}
      >
        {typing ? <TypingDots /> : <MessageText text={children} isUser={isUser} />}
      </div>

      {/* (Optional) user avatar placeholder for symmetry */}
      {isUser && (
        <div className="grid h-8 w-8 place-items-center rounded-full border border-zinc-800/70 bg-zinc-900/60 text-zinc-400">
          <span className="text-[10px]">You</span>
        </div>
      )}
    </motion.div>
  );
}

function MessageText({ text, isUser }) {
  const [copied, setCopied] = useState(false);
  const showCopy = !isUser && String(text).length > 0;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(text));
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  return (
    <div className="group relative">
      <p className="whitespace-pre-wrap leading-relaxed tracking-wide">
        {text}
      </p>
      {showCopy && (
        <button
          onClick={copy}
          className="absolute -right-1 -top-1 hidden rounded-full border border-zinc-800 bg-zinc-900/80 p-1 text-zinc-300 shadow-sm hover:bg-zinc-800 group-hover:block"
          title="Copy"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

function TypingDots() {
  // ChatGPT-like analyzing indicator
  return (
    <div className="inline-flex items-center gap-2 text-zinc-400">
      <span className="text-xs">Analyzing</span>
      <span className="mt-1 inline-flex items-end gap-1">
        <Dot delay="-300ms" />
        <Dot delay="-150ms" />
        <Dot />
      </span>
    </div>
  );
}

function Dot({ delay = "0ms" }) {
  return (
    <span
      className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500"
      style={{ animationDelay: delay }}
    />
  );
}

function Composer({ value, onChange, onSend, onKeyDown, disabled }) {
  const taRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "0px";
    const h = Math.min(168, taRef.current.scrollHeight);
    taRef.current.style.height = h + "px";
  }, [value]);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
      <div className="pointer-events-auto mx-auto max-w-3xl px-4 pb-6">
        <div className="relative">
          {/* Tiny animated chatbot next to the input */}
          <motion.div
            aria-hidden
            className="absolute -left-10 bottom-4 hidden sm:block"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <div className="relative grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 shadow-lg">
              <Bot className="h-4 w-4 text-white" />
              <span className="absolute -inset-1 animate-ping rounded-xl bg-violet-600/30" />
            </div>
          </motion.div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2 shadow-xl shadow-black/30 backdrop-blur">
            <div className="flex items-end gap-2">
              <textarea
                ref={taRef}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask your resume assistant…"
                className="min-h-[44px] max-h-40 w-full resize-none rounded-xl bg-transparent px-3 py-2 text-sm leading-relaxed placeholder:text-zinc-500 focus:outline-none"
              />
              <button
                onClick={onSend}
                disabled={disabled || !value.trim()}
                className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white shadow-md transition disabled:opacity-50"
                title="Send"
              >
                {disabled ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="mt-1 flex items-center justify-between px-1">
              <p className="text-[10px] text-zinc-500">
                Press <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1">Enter</kbd> to send • <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1">Shift</kbd>+<kbd className="rounded border border-zinc-700 bg-zinc-800 px-1">Enter</kbd> for newline
              </p>
              <p className="text-[10px] text-zinc-500">Model: demo • Responses are simulated</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Utilities -------------------------------------------------------------
function cryptoRandomId() {
  // Works in modern browsers; in Node, you can fallback to Math.random
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    return `${arr[0].toString(16)}-${arr[1].toString(16)}`;
  }
  return Math.random().toString(16).slice(2);
}

async function mockInference(prompt) {
  // Simulate latency + a helpful response
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  // Short, realistic stagger while the typing indicator shows
  await delay(900 + Math.random() * 700);

  const canned = [
    "Here are 5 high‑impact keywords to improve ATS matching for AI/ML roles: Python, TensorFlow/PyTorch, MLOps, NLP, Cloud (AWS/GCP/Azure).",
    "Tip: Start each bullet with a strong verb and quantify outcomes: ‘Deployed BERT‑based classifier cutting false negatives by 18%.’",
    "You can paste a job description and I’ll tailor your resume bullets to match it while keeping them truthful.",
  ];

  const pick = canned[Math.floor(Math.random() * canned.length)];
  return pick + "\n\n(Mock reply — connect to your API here.)";
}
