const LAST_UPDATED = "June 5, 2026";
const CONTACT_EMAIL = "vscarpenter@gmail.com";

/**
 * One titled block of the privacy policy. Keeps heading + body spacing
 * consistent across every section without repeating the markup.
 */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="space-y-3 leading-relaxed text-foreground-muted">
        {children}
      </div>
    </section>
  );
}

/**
 * Document-style privacy policy. Plain-language and privacy-first, and
 * deliberately accurate to what the code does: local-first by default,
 * optional cloud sync that is encrypted in transit but NOT end-to-end
 * encrypted, and error reporting that strips task content.
 */
export function PrivacyPolicy() {
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
      <header>
        <p className="mb-3 text-xs uppercase tracking-widest text-accent">Privacy</p>
        <h1 className="rd-serif mb-2 text-3xl text-foreground sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-foreground-muted">Last updated {LAST_UPDATED}</p>
      </header>

      <Section title="Our Approach">
        <p>
          GSD Task Manager is built privacy-first. Your tasks belong to you. By
          default, everything you create stays on your own device — there is no
          account to sign up for, no tracking of what you type, and nothing you
          create is sent to a server.
        </p>
        <p>
          The sections below explain exactly what data exists, where it lives,
          and the few cases where it leaves your device — always because you
          chose to enable a feature.
        </p>
      </Section>

      <Section title="What We Collect">
        <p>
          We do not require an account, and we do not run advertising or
          analytics trackers. The tasks, tags, notes, and settings you create
          are stored only in your browser — we never collect or see them unless
          you choose to turn on cloud sync, described below.
        </p>
        <p>
          As with any website, our hosting provider records standard technical
          logs (such as your IP address and request metadata) when your browser
          loads the app. See Third-Party Services below.
        </p>
      </Section>

      <Section title="Local-First Storage">
        <p>
          Your data is saved locally in your browser using IndexedDB. It stays
          on your device, works completely offline, and is never transmitted
          anywhere on its own.
        </p>
        <p>
          You can export all of your data to a JSON file at any time from
          Settings, and import it back into another browser or device. Clearing
          your browser storage, or using the in-app delete option, permanently
          removes the local copy.
        </p>
      </Section>

      <Section title="Optional Cloud Sync">
        <p>
          If you want your tasks available across multiple devices, you can
          choose to sign in and enable cloud sync. This is entirely optional and
          off by default. When sync is enabled:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            You sign in using a third-party provider (Google or GitHub). We never
            see or store your password.
          </li>
          <li>
            Your tasks are stored on our server (api.vinny.io) so they can be
            delivered to your other devices.
          </li>
          <li>
            Data is encrypted in transit using HTTPS, and access is protected by
            authentication and owner-scoped controls — your account can only read
            its own tasks.
          </li>
          <li>
            For full transparency: your tasks are <strong>not end-to-end
            encrypted</strong>. The content is stored in a readable form on the
            server, so our systems are technically capable of accessing it. We do
            not read, sell, or share your tasks — but unlike local-only mode, the
            server can technically access them.
          </li>
        </ul>
        <p>You can disable sync or delete your synced data at any time.</p>
      </Section>

      <Section title="Third-Party Services">
        <p>
          We rely on a small number of third parties, only to the extent needed
          to provide the features above:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Google and GitHub (OAuth sign-in)</strong> — used only to
            authenticate you when you enable sync. We receive a basic account
            identifier, not your password.
          </li>
          <li>
            <strong>Amazon Web Services (AWS)</strong> — hosts the application
            (via CloudFront and S3) and, when sync is enabled, the database that
            stores your synced tasks. As with any web host, standard server logs
            (such as IP address and request metadata) may be recorded.
          </li>
        </ul>
      </Section>

      <Section title="Error Tracking">
        <p>
          To find and fix bugs, the app can report errors to Sentry, an
          error-monitoring service. This is only active when the app is
          configured with a Sentry key.
        </p>
        <p>
          Error reports are limited to diagnostic details — such as the error
          type, a device or task identifier, and status codes. The app is
          designed to exclude your task content (titles, descriptions, notes,
          and tags) from these reports, and we never use error tracking to
          collect or profile what you write.
        </p>
      </Section>

      <Section title="Your Choices">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Use the app without an account — full functionality works offline
            with no sign-in.
          </li>
          <li>Export your data to JSON at any time from Settings.</li>
          <li>Enable or disable cloud sync whenever you like.</li>
          <li>
            Delete your tasks, or clear your browser storage, to remove the local
            copy.
          </li>
          <li>
            If you enabled sync, you can delete your synced data and account.
          </li>
        </ul>
      </Section>

      <Section title="Changes to This Policy">
        <p>
          If this policy changes, we will update the &ldquo;Last updated&rdquo;
          date at the top of this page. Significant changes will be reflected
          here.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about privacy or this policy? Contact us at{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-accent transition-colors hover:text-accent-hover"
          >
            {CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </article>
  );
}
