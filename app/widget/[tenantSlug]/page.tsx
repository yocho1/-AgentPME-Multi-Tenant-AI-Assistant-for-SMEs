"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ChatWidget from "@/components/widget/chat-widget";

interface WidgetConfig {
  tenantId: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
  greeting: string;
  position: string;
}

export default function WidgetPage() {
  const params = useParams();
  const tenantSlug = params.tenantSlug as string;
  const [config, setConfig] = useState<WidgetConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantSlug) return;

    fetch(`/api/widget/config/${tenantSlug}`)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to load widget");
        }
        return res.json();
      })
      .then((data) => setConfig(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [tenantSlug]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-gray-500">
        {error || "Widget unavailable"}
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-transparent">
      <ChatWidget
        tenantId={config.tenantId}
        tenantName={config.name}
        primaryColor={config.primaryColor}
        greeting={config.greeting}
        position={config.position as "bottom-right" | "bottom-left"}
      />
    </div>
  );
}
