import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Welcome back{user?.email ? `, ${user.email}` : ""}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total conversations", value: "0" },
          { label: "Resolved today", value: "0" },
          { label: "Avg. response time", value: "—" },
          { label: "CSAT score", value: "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4"
          >
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {stat.label}
            </p>
            <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <h2 className="text-lg font-semibold">Recent conversations</h2>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
          No conversations yet. Once your widget is live, they will appear here.
        </p>
      </div>
    </div>
  );
}
