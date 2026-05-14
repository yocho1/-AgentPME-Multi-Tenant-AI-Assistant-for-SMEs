"use client";

import { useEffect, useState } from "react";
import {
  MessageSquare,
  Phone,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";

interface Analytics {
  totalConversations: number;
  openConversations: number;
  closedConversations: number;
  escalatedConversations: number;
  widgetConversations: number;
  whatsappConversations: number;
  totalMessages: number;
  recentConversations: {
    id: string;
    channel: string;
    status: string;
    created_at: string;
    updated_at: string;
  }[];
  topQueries: { query: string; channel: string }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analytics")
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading analytics…
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-[var(--color-destructive)]">{error}</p>;
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Conversation metrics and insights.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Conversations"
          value={data.totalConversations}
          icon={<MessageSquare className="h-4 w-4 text-blue-500" />}
        />
        <KpiCard
          title="Open"
          value={data.openConversations}
          icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
        />
        <KpiCard
          title="Closed"
          value={data.closedConversations}
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
        />
        <KpiCard
          title="Escalated"
          value={data.escalatedConversations}
          icon={<TrendingUp className="h-4 w-4 text-red-500" />}
        />
      </div>

      {/* Channels */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h3 className="text-sm font-medium">By Channel</h3>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <MessageSquare className="h-4 w-4 text-blue-500" />
                Web Widget
              </div>
              <span className="text-sm font-semibold">{data.widgetConversations}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-green-500" />
                WhatsApp
              </div>
              <span className="text-sm font-semibold">{data.whatsappConversations}</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
          <h3 className="text-sm font-medium">Messages Sent</h3>
          <p className="mt-2 text-3xl font-bold">{data.totalMessages}</p>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Total across all conversations
          </p>
        </div>
      </div>

      {/* Top Queries */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h3 className="text-sm font-medium">Recent Customer Queries</h3>
        {data.topQueries.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
            No queries yet.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.topQueries.map((q, i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2"
              >
                <p className="text-sm truncate max-w-[70%]">{q.query}</p>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {q.channel === "whatsapp" ? "WhatsApp" : "Widget"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
        <h3 className="text-sm font-medium">Recent Activity (Last 7 Days)</h3>
        {data.recentConversations.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">
            No recent activity.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {data.recentConversations.map((conv) => (
              <div
                key={conv.id}
                className="flex items-center justify-between rounded-md border border-[var(--color-border)] px-3 py-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  {conv.channel === "whatsapp" ? (
                    <Phone className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                  )}
                  <span className="capitalize">{conv.channel}</span>
                  <StatusBadge status={conv.status} />
                </div>
                <span className="text-xs text-[var(--color-muted-foreground)]">
                  {new Date(conv.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-[var(--color-muted-foreground)]">{title}</h3>
        {icon}
      </div>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "open") {
    return (
      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-950 dark:text-blue-400">
        Open
      </span>
    );
  }
  if (status === "escalated") {
    return (
      <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600 dark:bg-orange-950 dark:text-orange-400">
        Escalated
      </span>
    );
  }
  return (
    <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-600 dark:bg-green-950 dark:text-green-400">
      Closed
    </span>
  );
}
