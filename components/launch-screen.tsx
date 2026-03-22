"use client";

import { useState, useEffect, useRef } from "react";
import { X, Zap, CalendarClock, Users, Sparkles, ArrowRight } from "lucide-react";
import { quadrants } from "@/lib/quadrants";

const STORAGE_KEY = "gsd-has-launched";

const TILE_ICONS: React.ComponentType<{ className?: string }>[] = [Zap, CalendarClock, Users, Sparkles];

const TILE_VISUALS = [
  { gradient: "from-blue-500 to-indigo-600", glowColor: "rgba(59, 130, 246, 0.4)" },
  { gradient: "from-amber-500 to-orange-600", glowColor: "rgba(245, 158, 11, 0.4)" },
  { gradient: "from-emerald-500 to-teal-600", glowColor: "rgba(16, 185, 129, 0.4)" },
  { gradient: "from-violet-500 to-pink-600", glowColor: "rgba(139, 92, 246, 0.4)" },
];

/** BEM helper: returns `base` + `base--visible` when animateIn is true */
function vis(base: string, active: boolean): string {
  return active ? `${base} ${base}--visible` : base;
}

export function LaunchScreen() {
  const [visible, setVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return true;
  });
  const isFirstTime = typeof window !== "undefined" && !localStorage.getItem(STORAGE_KEY);
  const [fadeOut, setFadeOut] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const dismissedRef = useRef(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const animTimer = requestAnimationFrame(() => setAnimateIn(true));

    if (!isFirstTime) {
      const timer = setTimeout(() => dismiss(), 1500);
      return () => {
        cancelAnimationFrame(animTimer);
        clearTimeout(timer);
      };
    }

    return () => cancelAnimationFrame(animTimer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => clearTimeout(fadeTimerRef.current);
  }, []);

  function dismiss(): void {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setFadeOut(true);
    localStorage.setItem(STORAGE_KEY, "true");
    fadeTimerRef.current = setTimeout(() => setVisible(false), 600);
  }

  if (!visible) return null;

  return (
    <div
      className={`launch-screen ${fadeOut ? "launch-screen--exit" : ""}`}
      role="dialog"
      aria-label="Welcome to GSD Task Manager"
    >
      <div className="launch-screen__dots" aria-hidden="true" />
      <div className="launch-screen__glow" aria-hidden="true" />

      <button
        onClick={dismiss}
        className={vis("launch-screen__close", animateIn)}
        aria-label="Close launch screen"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="launch-screen__content">
        <div className={vis("launch-screen__title", animateIn)}>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl md:text-7xl">
            <span className="launch-screen__title-gsd">GSD</span>
          </h1>
          <p className="mt-2 text-lg font-medium text-white/60 sm:text-xl">
            Prioritize what matters.
          </p>
        </div>

        <div className={vis("launch-screen__axis-labels", animateIn)}>
          <div className="launch-screen__axis-x">
            <span className="launch-screen__axis-tag launch-screen__axis-tag--urgent">
              URGENT
            </span>
            <span className="launch-screen__axis-tag launch-screen__axis-tag--not-urgent">
              NOT URGENT
            </span>
          </div>
          <div className="launch-screen__axis-y">
            <span className="launch-screen__axis-tag launch-screen__axis-tag--important">
              IMPORTANT
            </span>
            <span className="launch-screen__axis-tag launch-screen__axis-tag--not-important">
              NOT IMPORTANT
            </span>
          </div>
        </div>

        <div className="launch-screen__matrix">
          {quadrants.map((q, idx) => {
            const Icon = TILE_ICONS[idx];
            const visual = TILE_VISUALS[idx];
            return (
              <div
                key={q.id}
                className={vis("launch-screen__tile", animateIn)}
                style={{
                  animationDelay: `${idx * 100}ms`,
                  "--tile-glow": visual.glowColor,
                } as React.CSSProperties}
              >
                <div className={`launch-screen__tile-bg bg-gradient-to-br ${visual.gradient}`} />
                <div className="launch-screen__tile-content">
                  <div className="launch-screen__tile-icon">
                    <Icon className="h-6 w-6" />
                  </div>
                  <div className="launch-screen__tile-label">{q.title}</div>
                  <div className="launch-screen__tile-subtitle">{q.subtitle}</div>
                </div>
              </div>
            );
          })}

          <div
            className={vis("launch-screen__center-mark", animateIn)}
            aria-hidden="true"
          >
            <div className="launch-screen__center-ring" />
          </div>
        </div>

        {isFirstTime && (
          <div className={vis("launch-screen__cta", animateIn)}>
            <button onClick={dismiss} className="launch-screen__cta-button">
              <span>Get Started</span>
              <ArrowRight className="h-5 w-5" />
            </button>
            <p className="mt-3 text-sm text-white/40">
              Privacy-first. All data stored on your device.
            </p>
          </div>
        )}

        {!isFirstTime && (
          <div className={vis("launch-screen__returning", animateIn)}>
            <div className="launch-screen__loading-bar" />
          </div>
        )}
      </div>
    </div>
  );
}
