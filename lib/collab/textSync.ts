import type * as Y from "yjs";

/**
 * Translates a plain-textarea value change into minimal Y.Text
 * delete/insert operations (common-prefix/common-suffix diff) instead of
 * replacing the whole string. This matters for two reasons: it keeps CRDT
 * update payloads small, and it means a keystroke from one user doesn't
 * clobber a concurrent edit from another the way a full-text overwrite
 * would once this is wired into real-time collaboration.
 */
export function applyTextareaEdit(ytext: Y.Text, oldValue: string, newValue: string, origin: unknown = "textarea-input"): void {
  if (oldValue === newValue) {
    return;
  }

  const maxCommon = Math.min(oldValue.length, newValue.length);

  let start = 0;
  while (start < maxCommon && oldValue[start] === newValue[start]) {
    start++;
  }

  let oldEnd = oldValue.length;
  let newEnd = newValue.length;
  while (oldEnd > start && newEnd > start && oldValue[oldEnd - 1] === newValue[newEnd - 1]) {
    oldEnd--;
    newEnd--;
  }

  const applyOps = () => {
    if (oldEnd > start) {
      ytext.delete(start, oldEnd - start);
    }
    if (newEnd > start) {
      ytext.insert(start, newValue.slice(start, newEnd));
    }
  };

  if (ytext.doc) {
    ytext.doc.transact(applyOps, origin);
  } else {
    applyOps();
  }
}
