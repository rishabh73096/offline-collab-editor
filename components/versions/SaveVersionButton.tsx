"use client";

import { useState } from "react";

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
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  }

  const labels: Record<typeof status, string> = {
    idle: "Save version",
    saving: "Saving…",
    saved: "Saved",
    error: "Failed — retry",
  };

  return (
    <button
      type="button"
      onClick={() => void handleSave()}
      disabled={status === "saving"}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {labels[status]}
    </button>
  );
}
