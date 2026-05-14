"use client";

import { useEffect, useState } from "react";
import {
  MessageCircle,
  Phone,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  ArrowUpCircle,
  Mail,
  Clock,
} from "lucide-react";

interface Conversation {
  id: string;
  channel: "widget" | "whatsapp";
  status: "open" | "closed" | "escalated";
  user_name: string | null;
  user_email: string | null;
  user_phone: string | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
}

export default function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 5000);
    return () => clearInterval(interval);
  }, []);

  async function fetchConversations() {
    try {
      const res = await fetch("/api/conversations");
      const data = await res.json();
      if (res.ok) {
        setConversations(data.conversations ?? []);
      } else {
        setError(data.error || "Failed to load");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  async function selectConversation(id: string) {
    setSelectedId(id);
    setMessages([]);
    try {
      const res = await fetch(`/api/conversations/${id}`);
      const data = await res.json();
      if (res.ok) {
        setMessages(data.messages ?? []);
      }
    } catch {
      // ignore
    }
  }

  async function updateStatus(id: string, status: "open" | "closed" | "escalated") {
    try {
      await fetch(`/api/conversations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchConversations();
      if (selectedId === id) {
        selectConversation(id);
      }
    } catch {
      // ignore
    }
  }

  const openCount = conversations.filter((c) => c.status === "open").length;
  const escalatedCount = conversations.filter(
    (c) => c.status === "escalated"
  ).length;

  const filtered = selectedId
    ? conversations.filter((c) => c.id === selectedId)
    : conversations;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading conversations…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Left sidebar: conversation list */}
      <div className="flex w-80 flex-col gap-4 overflow-hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {openCount} open, {escalatedCount} escalated
          </p>
        </div>

        {error && (
          <p className="text-sm text-[var(--color-destructive)]">{error}</p>
        )}

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {conversations.length === 0 && (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No conversations yet.
            </p>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={`w-full rounded-lg border p-3 text-left transition-colors ${
                selectedId === conv.id
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/5"
                  : "border-[var(--color-border)] bg-[var(--color-card)] hover:bg-[var(--color-accent)]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {conv.channel === "whatsapp" ? (
                    <Phone className="h-4 w-4 text-green-500" />
                  ) : (
                    <MessageCircle className="h-4 w-4 text-blue-500" />
                  )}
                  <span className="text-sm font-medium">
                    {conv.user_name || "Anonymous"}
                  </span>
                </div>
                <StatusBadge status={conv.status} />
              </div>
              <div className="mt-1 flex items-center gap-1 text-xs text-[var(--color-muted-foreground)]">
                {conv.user_email && <Mail className="h-3 w-3" />}
                {conv.user_phone && <Phone className="h-3 w-3" />}
                <Clock className="h-3 w-3" />
                {new Date(conv.updated_at).toLocaleTimeString()}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right panel: conversation detail */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
        {!selectedId ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
            Select a conversation to view messages
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
              <div>
                <h2 className="font-semibold">
                  {conversations.find((c) => c.id === selectedId)?.user_name ||
                    "Anonymous"}
                </h2>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {conversations.find((c) => c.id === selectedId)?.channel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateStatus(selectedId, "escalated")}
                  className="flex items-center gap-1 rounded-md bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-600 hover:bg-orange-100 dark:bg-orange-950 dark:text-orange-400"
                >
                  <ArrowUpCircle className="h-3.5 w-3.5" />
                  Escalate
                </button>
                <button
                  onClick={() => updateStatus(selectedId, "closed")}
                  className="flex items-center gap-1 rounded-md bg-green-50 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-100 dark:bg-green-950 dark:text-green-400"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Close
                </button>
                <button
                  onClick={() => setSelectedId(null)}
                  className="rounded-md p-1.5 hover:bg-[var(--color-accent)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto space-y-3 p-4">
              {messages.length === 0 && (
                <p className="text-center text-sm text-[var(--color-muted-foreground)]">
                  No messages yet.
                </p>
              )}
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
                        ? "bg-[var(--color-primary)] text-white"
                        : "bg-[var(--color-muted)] text-[var(--color-foreground)]"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "open") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
        <AlertCircle className="h-3 w-3" />
        Open
      </span>
    );
  }
  if (status === "escalated") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-950 dark:text-orange-400">
        <ArrowUpCircle className="h-3 w-3" />
        Escalated
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600 dark:bg-green-950 dark:text-green-400">
      <CheckCircle2 className="h-3 w-3" />
      Closed
    </span>
  );
}

