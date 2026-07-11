"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { User, Mail, Lock, TriangleAlert } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validation/auth";

export function RegisterForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setFormError(body?.error ?? "Could not create account");
      return;
    }

    const signInResult = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });

    if (signInResult?.error) {
      router.push("/login");
      return;
    }

    router.push("/documents");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="name" className="text-sm font-medium text-ink-soft">
          Name
        </label>
        <div className="relative">
          <User className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            id="name"
            type="text"
            autoComplete="name"
            aria-invalid={Boolean(errors.name)}
            className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            {...register("name")}
          />
        </div>
        {errors.name && <p className="text-sm text-brick">{errors.name.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink-soft">
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            {...register("email")}
          />
        </div>
        {errors.email && <p className="text-sm text-brick">{errors.email.message}</p>}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink-soft">
          Password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
            {...register("password")}
          />
        </div>
        {errors.password && <p className="text-sm text-brick">{errors.password.message}</p>}
        <p className="text-xs text-ink-faint">At least 8 characters.</p>
      </div>

      {formError && (
        <p role="alert" className="flex items-center gap-2 rounded-lg bg-brick-soft px-3 py-2 text-sm text-brick">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
