"use client";

import { useState } from "react";
import { Save, Check, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

export function SaveVersionButton({ documentId }: { documentId: string }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setStatus("saving");
    try {
      const response = await fetch(`/api/documents/${documentId}/versions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) {
        throw new Error("Request failed");
      }
      setStatus("saved");
      toast.success("Version saved");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      toast.error("Could not save version");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const config = {
    idle: { icon: Save, label: "Save version" },
    saving: { icon: Loader2, label: "Saving…" },
    saved: { icon: Check, label: "Saved" },
    error: { icon: TriangleAlert, label: "Failed — retry" },
  }[status];

  return (
    <button
      type="button"
      onClick={() => void handleSave()}
      disabled={status === "saving"}
      className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-ink-soft transition-colors hover:border-border-strong hover:text-ink disabled:opacity-60"
    >
      <config.icon className={`h-3.5 w-3.5 ${status === "saving" ? "animate-spin" : ""}`} aria-hidden="true" />
      {config.label}
    </button>
  );
}
