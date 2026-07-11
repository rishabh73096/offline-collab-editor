"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Fades + slides content in the first time it scrolls into view. The
 * motion-reduce: overrides neutralize this via CSS alone for
 * prefers-reduced-motion, rather than skipping the animation entirely, so
 * there's exactly one setState call site (the observer callback) and no
 * server/client hydration mismatch risk from reading matchMedia during render.
 */
export function Reveal({
  children,
  delayMs = 0,
  className,
}: {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`motion-reduce:translate-y-0! motion-reduce:opacity-100! motion-reduce:transition-none! transition-all duration-700 ease-out ${visible ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"} ${className ?? ""}`}
      style={{ transitionDelay: visible ? `${delayMs}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}
