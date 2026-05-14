export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Team</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Manage workspace members and roles.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Invite team members to collaborate on your AI assistant.
        </p>
      </div>
    </div>
  );
}
