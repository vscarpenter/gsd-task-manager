import { Shield, Check } from "lucide-react";
import { ScrollReveal } from "@/components/about/scroll-reveal";

const privacyChecklist = [
  "No account required",
  "IndexedDB local storage",
  "Optional E2E encrypted sync",
  "Export your data anytime as JSON",
  "Works entirely offline",
];

export function PrivacySection() {
  return (
    <section className="py-20 sm:py-28 bg-background-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="max-w-2xl mx-auto text-center">
            <Shield className="h-10 w-10 text-accent mx-auto mb-6" aria-hidden="true" />
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-4">
              Your tasks stay on your device.
            </h2>
            <div className="text-foreground-muted leading-relaxed mb-8 space-y-4">
              <p>
                GSD stores everything in your browser&apos;s IndexedDB. There&apos;s no
                account required, no server receiving your data by default, and no
                analytics tracking what you type.
              </p>
              <p>
                If you want sync across devices, the optional cloud backend uses
                end-to-end client-side encryption. The server receives only
                ciphertext — it cannot read your tasks. Ever.
              </p>
            </div>
            <div className="text-left max-w-sm mx-auto space-y-3">
              {privacyChecklist.map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <Check className="h-4 w-4 text-emerald-500 shrink-0" aria-hidden="true" />
                  <span className="text-sm text-foreground-muted">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
