export default function ConversationsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Conversations</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Manage customer conversations across web widget and WhatsApp.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No conversations yet. Once your widget is live, they will appear here.
        </p>
      </div>
    </div>
  );
}
