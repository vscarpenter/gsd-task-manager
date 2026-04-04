"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * Fade-in-up animation triggered by IntersectionObserver.
 * Uses CSS classes instead of inline opacity to avoid layout issues
 * with large invisible sections. Respects prefers-reduced-motion.
 */
export function ScrollReveal({ children, className, delay = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) {
      el.classList.add("scroll-reveal--visible");
      return;
    }

    // Check if element is already in viewport on mount (above the fold)
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      el.classList.add("scroll-reveal--visible");
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add("scroll-reveal--visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0, rootMargin: "0px 0px 400px 0px" }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [delay]);

  return (
    <div
      ref={ref}
      className={cn("scroll-reveal", className)}
    >
      {children}
    </div>
  );
}
