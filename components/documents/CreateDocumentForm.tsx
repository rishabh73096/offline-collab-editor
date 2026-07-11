"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { FilePlus2 } from "lucide-react";

const createDocumentSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
});

type FormValues = z.infer<typeof createDocumentSchema>;

export function CreateDocumentForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(createDocumentSchema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.error ?? "Could not create document");
      return;
    }

    reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-2 sm:flex-row sm:items-start">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="title" className="sr-only">
          Document title
        </label>
        <input
          id="title"
          type="text"
          placeholder="Untitled document"
          aria-invalid={Boolean(errors.title)}
          className="w-full rounded-lg border border-border bg-surface px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
          {...register("title")}
        />
        {errors.title && <p className="text-sm text-brick">{errors.title.message}</p>}
        {formError && (
          <p role="alert" className="text-sm text-brick">
            {formError}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        <FilePlus2 className="h-4 w-4" aria-hidden="true" />
        {isSubmitting ? "Creating…" : "New document"}
      </button>
    </form>
  );
}
