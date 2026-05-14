"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Copy, Check, MessageCircle } from "lucide-react";

interface TenantSettings {
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  widget_enabled: boolean;
  widget_greeting: string | null;
  widget_position: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<TenantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tenant/settings");
      const data = await res.json();
      if (res.ok) setSettings(data);
    } catch {
      setError("Failed to load settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setSaveMsg(null);

    try {
      const res = await fetch("/api/tenant/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          widget_enabled: settings.widget_enabled,
          widget_greeting: settings.widget_greeting,
          widget_position: settings.widget_position,
          primary_color: settings.primary_color,
        }),
      });
      if (res.ok) {
        setSaveMsg("Settings saved.");
      } else {
        const data = await res.json();
        setError(data.error || "Save failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  const embedCode = settings
    ? `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/api/widget/script?tenant=${settings.slug}"></script>`
    : "";

  function copyEmbedCode() {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading settings…
      </div>
    );
  }

  if (!settings) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Unable to load settings.
      </p>
    );
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Configure your AI assistant, widget appearance, and integrations.
        </p>
      </div>

      <form
        onSubmit={handleSave}
        className="space-y-6 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6"
      >
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Widget</h2>

          <div className="flex items-center gap-3">
            <input
              id="widget_enabled"
              type="checkbox"
              checked={settings.widget_enabled}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSettings({ ...settings, widget_enabled: e.target.checked })
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <Label htmlFor="widget_enabled" className="cursor-pointer">
              Enable chat widget
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="widget_greeting">Greeting message</Label>
            <Input
              id="widget_greeting"
              value={settings.widget_greeting || ""}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSettings({ ...settings, widget_greeting: e.target.value })
              }
              placeholder="Hello! How can I help you today?"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="widget_position">Position</Label>
            <select
              id="widget_position"
              value={settings.widget_position}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                setSettings({ ...settings, widget_position: e.target.value })
              }
              className="flex h-9 w-full rounded-md border border-[var(--color-border)] bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-ring)]"
            >
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="primary_color">Primary color</Label>
            <div className="flex items-center gap-2">
              <input
                id="primary_color"
                type="color"
                value={settings.primary_color || "#0f172a"}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSettings({ ...settings, primary_color: e.target.value })
                }
                className="h-9 w-9 cursor-pointer rounded border border-[var(--color-border)] p-0.5"
              />
              <Input
                value={settings.primary_color || "#0f172a"}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSettings({ ...settings, primary_color: e.target.value })
                }
                className="w-32"
              />
            </div>
          </div>
        </div>

        {error && (
          <p className="text-sm text-[var(--color-destructive)]">{error}</p>
        )}
        {saveMsg && (
          <p className="text-sm text-green-600">{saveMsg}</p>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Save settings"
          )}
        </Button>
      </form>

      <div className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="text-lg font-semibold">Embed code</h2>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Paste this single line into your website&apos;s HTML to add the chat
          widget.
        </p>

        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-[var(--color-muted)] px-3 py-2 text-xs break-all">
            {embedCode}
          </code>
          <Button
            variant="outline"
            size="icon"
            onClick={copyEmbedCode}
            className="shrink-0"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <MessageCircle className="h-4 w-4 text-[var(--color-muted-foreground)]" />
          <a
            href={`/widget/${settings.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium underline underline-offset-4"
          >
            Preview widget
          </a>
        </div>
      </div>
    </div>
  );
}
