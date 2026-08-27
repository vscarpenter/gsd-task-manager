import { Shield, Check } from "lucide-react";
import { ScrollReveal } from "@/components/about/scroll-reveal";

const privacyParagraphs = [
  "GSD stores everything in your browser's IndexedDB. There's no account required, no server receiving your data by default, and no analytics tracking what you type.",
  "If you want sync across devices, the optional cloud backend stores your tasks securely — encrypted in transit and protected by authentication and owner-scoped access controls.",
  "If you send feedback from Settings, you see the exact message before it goes: no account, no device identifier, and nothing from your tasks. It's anonymous, which also means I have no way to write back.",
];

const privacyChecklist = [
  "No account required",
  "IndexedDB local storage",
  "Optional secure cloud sync",
  "Export your data anytime as JSON",
  "Works entirely offline",
  "Feedback is anonymous and opt-in",
];

export function PrivacySection() {
  return (
    <section className="py-20 sm:py-28 bg-background-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="max-w-2xl mx-auto text-center">
            <Shield className="h-10 w-10 text-accent mx-auto mb-6" aria-hidden="true" />
            <h2 className="text-h2 font-semibold tracking-tight text-foreground sm:text-h1 mb-4">
              Your tasks stay on your device.
            </h2>
            <div className="text-foreground-muted leading-relaxed mb-8 space-y-4">
              {privacyParagraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)}>{paragraph}</p>
              ))}
            </div>
            <div className="text-left max-w-sm mx-auto space-y-3">
              {privacyChecklist.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 shrink-0 text-status-success" aria-hidden="true" />
                  <span className="text-sm text-foreground-muted">{item}</span>
                </div>
              ))}
            </div>
            <a
              href="https://gsdtaskmanager.com/privacy/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block text-sm text-accent transition-colors hover:text-accent-hover"
            >
              Read the full Privacy Policy &rarr;
            </a>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
