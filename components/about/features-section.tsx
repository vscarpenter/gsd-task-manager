import {
  Grid2x2,
  Lock,
  BarChart3,
  Keyboard,
  RefreshCw,
  Tags,
  CheckSquare,
  Smartphone,
  Bot,
  Cloud,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ScrollReveal } from "@/components/about/scroll-reveal";
import { FeatureCard } from "@/components/about/feature-card";

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

// First three are hero features (Eisenhower Matrix, Privacy First, MCP Server) —
// they render full-width on the first row. Layout is driven by index, not a flag.
const features: Feature[] = [
  {
    icon: Grid2x2,
    title: "Eisenhower Matrix",
    description:
      "Four quadrants. One clear picture of what deserves your attention right now.",
  },
  {
    icon: Lock,
    title: "Privacy First",
    description:
      "Your tasks never leave your browser. No account, no server, no tracking.",
  },
  {
    icon: Bot,
    title: "MCP Server",
    description:
      "Let Claude query your tasks with natural language. AI meets your to-do list.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Completion rates, streaks, quadrant distribution. See where your time actually goes.",
  },
  {
    icon: Keyboard,
    title: "Keyboard Driven",
    description:
      "Press n to create. \u2318K for everything else. Fast by design.",
  },
  {
    icon: RefreshCw,
    title: "Recurring Tasks",
    description:
      "Daily standup prep. Weekly reviews. Monthly goals. Set once, repeat automatically.",
  },
  {
    icon: Tags,
    title: "Tags and Filters",
    description:
      "Label tasks with custom tags. Smart views filter in one click.",
  },
  {
    icon: CheckSquare,
    title: "Subtasks",
    description:
      "Break complex work into steps. Track progress with a checklist.",
  },
  {
    icon: Smartphone,
    title: "Works as a PWA",
    description:
      "Install on desktop or mobile. Full offline support. No app store required.",
  },
  {
    icon: Cloud,
    title: "Optional Cloud Sync",
    description:
      "Optional sync to a server you control — protected in transit by TLS and owner-scoped access.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <p className="text-xs uppercase tracking-widest text-accent mb-3 text-center">
            Features
          </p>
          <h2 className="rd-serif font-normal text-display tracking-tight text-foreground mb-12 text-center">
            Everything you need. Nothing you don&apos;t.
          </h2>
        </ScrollReveal>

        <ScrollReveal>
          {/* lg layout uses a 12-col grid:
                row 1: 3 hero cards × col-span-4  → 12
                row 2: 4 regular cards × col-span-3 → 12
                row 3: 3 regular cards × col-span-4 → 12
              No lonely cards.
          */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
            {features.map((feature, i) => {
              const isHeroRow = i < 3;
              const isFinalRow = i >= 7;
              const lgSpan =
                isHeroRow || isFinalRow ? "lg:col-span-4" : "lg:col-span-3";
              return (
                <FeatureCard
                  key={feature.title}
                  icon={feature.icon}
                  title={feature.title}
                  description={feature.description}
                  className={lgSpan}
                />
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
