import { ScrollReveal } from "@/components/about/scroll-reveal";

const quadrants = [
  {
    label: "Q1",
    name: "Do First",
    description: "Crises, deadlines. Handle now.",
    className: "border-q1/40 bg-q1/12",
  },
  {
    label: "Q2",
    name: "Schedule",
    description: "Strategy, growth. Protect this time.",
    className: "border-q2/40 bg-q2/12",
  },
  {
    label: "Q3",
    name: "Delegate",
    description: "Interruptions. Hand these off.",
    className: "border-q3/40 bg-q3/12",
  },
  {
    label: "Q4",
    name: "Eliminate",
    description: "Noise. Stop doing these.",
    className: "border-q4/40 bg-q4/12",
  },
] as const;

export function MatrixSection() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-background-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="lg:grid lg:grid-cols-2 lg:gap-16 lg:items-center">
          {/* Explanation column */}
          <div className="order-2 lg:order-1 mt-12 lg:mt-0">
            <ScrollReveal>
              <p className="text-xs uppercase tracking-widest text-accent mb-3">
                The Eisenhower Matrix
              </p>
              <h2 className="rd-serif font-normal text-display tracking-tight text-foreground mb-6">
                Prioritize by urgency and importance. Not just vibes.
              </h2>
              <div className="text-foreground-muted leading-relaxed space-y-4">
                <p>
                  President Eisenhower noticed that urgent tasks are rarely important, and
                  important tasks are rarely urgent. GSD puts that insight to work.
                </p>
                <p>
                  Every task you add gets sorted into one of four quadrants based on two
                  simple questions: Is it urgent? Is it important?
                </p>
                <p>
                  The result is a clear picture of where to focus, what to schedule, what
                  to hand off, and what to stop doing entirely.
                </p>
              </div>
            </ScrollReveal>
          </div>

          {/* Matrix visual column */}
          <div className="order-1 lg:order-2">
            <ScrollReveal delay={200}>
              <div className="grid grid-cols-2 gap-3">
                {quadrants.map((q) => (
                  <div
                    key={q.label}
                    className={`rounded-xl border p-4 sm:p-5 ${q.className}`}
                  >
                    <span className="text-[10px] uppercase tracking-widest text-foreground-muted font-medium">
                      {q.label}
                    </span>
                    <h3 className="rd-serif text-base text-foreground mt-1">
                      {q.name}
                    </h3>
                    <p className="text-caption text-foreground-muted mt-0.5">
                      {q.description}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
