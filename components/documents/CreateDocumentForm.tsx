"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { z } from "zod";

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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex items-start gap-3">
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="title" className="sr-only">
          Document title
        </label>
        <input
          id="title"
          type="text"
          placeholder="Untitled document"
          aria-invalid={Boolean(errors.title)}
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          {...register("title")}
        />
        {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-60 dark:hover:bg-[#ccc]"
      >
        {isSubmitting ? "Creating..." : "New document"}
      </button>
    </form>
  );
}
