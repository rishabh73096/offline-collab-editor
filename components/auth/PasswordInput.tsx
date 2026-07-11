"use client";

import { useState } from "react";
import { Lock, Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

export function PasswordInput({
  id,
  placeholder,
  autoComplete,
  ariaInvalid,
  registration,
}: {
  id: string;
  placeholder?: string;
  autoComplete?: string;
  ariaInvalid?: boolean;
  registration: UseFormRegisterReturn;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input
        id={id}
        type={visible ? "text" : "password"}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={ariaInvalid}
        className="w-full rounded-lg border border-border bg-surface py-2 pr-10 pl-9 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft"
        {...registration}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute top-1/2 right-3 -translate-y-1/2 text-ink-faint transition-colors hover:text-ink-soft"
      >
        {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
}
