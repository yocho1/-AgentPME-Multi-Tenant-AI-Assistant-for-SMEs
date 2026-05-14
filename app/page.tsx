import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <span className="text-xl font-bold tracking-tight">AgentPME</span>
          <nav className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-primary-foreground)] hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <section className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          An AI assistant built for small businesses
        </h1>
        <p className="mt-6 max-w-xl text-lg text-[var(--color-muted-foreground)]">
          Answer customer questions 24/7 via your website widget and WhatsApp.
          Set up in minutes, no code required.
        </p>
        <div className="mt-10 flex items-center gap-4">
          <Link
            href="/register"
            className="rounded-md bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-[var(--color-primary-foreground)] hover:opacity-90 transition-opacity"
          >
            Start free trial
          </Link>
          <Link
            href="/login"
            className="rounded-md border border-[var(--color-border)] px-6 py-3 text-sm font-semibold hover:bg-[var(--color-accent)] transition-colors"
          >
            Log in
          </Link>
        </div>
      </section>

      <footer className="border-t border-[var(--color-border)] py-6 text-center text-sm text-[var(--color-muted-foreground)]">
        &copy; {new Date().getFullYear()} AgentPME. All rights reserved.
      </footer>
    </main>
  );
}
