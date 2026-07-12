"use client";

import { useEffect, useRef, useState } from "react";
import type * as Y from "yjs";
import { applyTextareaEdit } from "@/lib/collab/textSync";

export function DocumentEditor({
  ytext,
  readOnly,
  textareaRef,
}: {
  ytext: Y.Text;
  readOnly: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}) {
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
    <div className="rounded-2xl border border-border bg-surface shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-soft">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        readOnly={readOnly}
        aria-label="Document content"
        placeholder="Start typing…"
        className="min-h-[60vh] w-full resize-none rounded-2xl bg-transparent p-6 font-serif text-base leading-relaxed text-ink outline-none placeholder:text-ink-faint disabled:opacity-70 sm:p-8 sm:text-lg"
      />
    </div>
  );
}
