"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { PasswordInput } from "@/components/auth/PasswordInput";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    try {
      await toast
        .promise(
          async () => {
            const result = await signIn("credentials", { ...values, redirect: false });
            if (result?.error) {
              throw new Error("Invalid email or password");
            }
          },
          {
            loading: "Signing in…",
            success: "Welcome back",
            error: (error) => (error instanceof Error ? error.message : "Could not sign in"),
          },
        )
        .unwrap();
    } catch {
      return;
    }

    router.push(searchParams.get("callbackUrl") ?? "/documents");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink-soft">
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input
            id="email"
            type="email"
            placeholder="you@example.com"
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
        <PasswordInput
          id="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          ariaInvalid={Boolean(errors.password)}
          registration={register("password")}
        />
        {errors.password && <p className="text-sm text-brick">{errors.password.message}</p>}
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 rounded-full bg-accent px-5 py-2.5 text-sm font-medium text-surface transition-colors hover:bg-accent-hover disabled:opacity-60"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
