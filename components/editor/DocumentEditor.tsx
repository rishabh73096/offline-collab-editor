"use client";

import { useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import { applyTextareaEdit } from "@/lib/collab/textSync";

export function DocumentEditor({ ytext, readOnly }: { ytext: Y.Text; readOnly: boolean }) {
  const [value, setValue] = useState(() => ytext.toString());
  const isLocalEdit = useRef(false);

  useEffect(() => {
    const observer = () => {
      if (isLocalEdit.current) {
        isLocalEdit.current = false;
        return;
      }
      setValue(ytext.toString());
    };

    ytext.observe(observer);
    setValue(ytext.toString());

    return () => ytext.unobserve(observer);
  }, [ytext]);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const newValue = event.target.value;
    isLocalEdit.current = true;
    applyTextareaEdit(ytext, value, newValue);
    setValue(newValue);
  }

  return (
    <textarea
      value={value}
      onChange={handleChange}
      readOnly={readOnly}
      aria-label="Document content"
      placeholder="Start typing..."
      className="min-h-[60vh] w-full resize-none rounded-lg border border-zinc-300 bg-white p-4 font-mono text-sm text-zinc-950 outline-none focus:border-zinc-500 disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
    />
  );
}
