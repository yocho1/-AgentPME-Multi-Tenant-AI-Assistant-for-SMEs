export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Configure your AI assistant, widget appearance, and integrations.
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-6">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Settings will be available once your workspace is fully set up.
        </p>
      </div>
    </div>
  );
}
