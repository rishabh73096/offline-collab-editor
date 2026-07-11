"use client";

import type { CSSProperties } from "react";
import { Toaster } from "sonner";

/**
 * Sonner is themed entirely through its documented CSS custom properties
 * (--normal-bg, --success-border, etc.), pointed at the same root-level
 * design tokens the rest of the app uses (app/globals.css) — so toasts
 * pick up light/dark automatically instead of needing a separate theme prop.
 */
const toastStyle = {
  "--normal-bg": "var(--surface)",
  "--normal-border": "var(--border)",
  "--normal-text": "var(--ink)",
  "--success-bg": "var(--moss-soft)",
  "--success-border": "var(--moss)",
  "--success-text": "var(--moss)",
  "--error-bg": "var(--brick-soft)",
  "--error-border": "var(--brick)",
  "--error-text": "var(--brick)",
  "--warning-bg": "var(--ochre-soft)",
  "--warning-border": "var(--ochre)",
  "--warning-text": "var(--ochre)",
  "--info-bg": "var(--teal-soft)",
  "--info-border": "var(--teal)",
  "--info-text": "var(--teal)",
  "--border-radius": "0.75rem",
} as CSSProperties;

export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: toastStyle,
        classNames: {
          toast: "font-sans shadow-lg",
          title: "text-sm font-medium",
          description: "text-xs",
        },
      }}
    />
  );
}
