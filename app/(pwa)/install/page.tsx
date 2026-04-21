export const metadata = {
  title: "Install GSD Task Manager"
};

export default function InstallPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-3xl font-semibold text-foreground">Install GSD Task Manager</h1>
      <p className="mt-4 text-foreground-muted">
        The app works fully offline. Follow these steps to install the Progressive Web App on your device.
      </p>
      <section className="mt-8 space-y-6 text-sm text-foreground-muted">
        <div
          className="rounded-[20px] border border-border bg-card p-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h2 className="text-lg font-medium text-foreground">Desktop</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-foreground-muted">
            <li>Open the app in Chrome or Edge.</li>
            <li>Click the install icon in the address bar.</li>
            <li>Launch from your dock or start menu for a distraction-free workspace.</li>
          </ol>
        </div>
        <div
          className="rounded-[20px] border border-border bg-card p-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h2 className="text-lg font-medium text-foreground">iOS</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-foreground-muted">
            <li>Open the app in Safari.</li>
            <li>Use the share button and choose &ldquo;Add to Home Screen&rdquo;.</li>
            <li>Launch from your home screen to stay offline.</li>
          </ol>
        </div>
        <div
          className="rounded-[20px] border border-border bg-card p-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <h2 className="text-lg font-medium text-foreground">Android</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-4 text-foreground-muted">
            <li>Open the app in Chrome.</li>
            <li>Tap the install banner or use the browser menu.</li>
            <li>Use the installed app for quick capture on the go.</li>
          </ol>
        </div>
      </section>
    </main>
  );
}
