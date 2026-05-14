"use client";

import { useState, useRef, useEffect } from "react";
import { Send, X, MessageCircle, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface ChatWidgetProps {
  tenantId: string;
  tenantName: string;
  primaryColor: string;
  greeting: string;
  position?: "inline" | "bottom-right" | "bottom-left";
}

export default function ChatWidget({
  tenantId,
  tenantName,
  primaryColor,
  greeting,
  position = "bottom-right",
}: ChatWidgetProps) {
  const [open, setOpen] = useState(position === "inline");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: greeting },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMsg,
          conversationId,
          tenantId,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.reply },
        ]);
        if (data.conversationId) {
          setConversationId(data.conversationId);
        }
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.error || "Something went wrong. Please try again.",
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Network error. Please check your connection and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const panelContent = (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <MessageCircle className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-semibold text-white">{tenantName}</span>
        </div>
        {position !== "inline" && (
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 px-4 py-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${
              msg.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "text-white"
                  : "bg-gray-100 text-gray-800"
              }`}
              style={
                msg.role === "user" ? { backgroundColor: primaryColor } : {}
              }
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="flex max-w-[80%] items-center gap-2 rounded-2xl bg-gray-100 px-3.5 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-gray-100 px-3 py-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm outline-none focus:border-gray-300 focus:ring-1 focus:ring-gray-200"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex h-9 w-9 items-center justify-center rounded-full text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          style={{ backgroundColor: primaryColor }}
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );

  if (position === "inline") {
    return (
      <div className="h-full w-full p-4">
        <div className="mx-auto h-full max-w-md">{panelContent}</div>
      </div>
    );
  }

  const positionClass =
    position === "bottom-left"
      ? "bottom-4 left-4"
      : "bottom-4 right-4";

  return (
    <div className={`fixed z-50 ${positionClass}`}>
      {open ? (
        <div className="h-[28rem] w-80 sm:w-96">{panelContent}</div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105"
          style={{ backgroundColor: primaryColor }}
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </button>
      )}
    </div>
  );
}
