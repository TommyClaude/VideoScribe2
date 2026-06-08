// Editor keyboard shortcuts: Space toggles play/pause, Delete/Backspace removes
// the selected element. Ignored while typing in a field.

import { useEffect } from "react";
import { useEditor } from "../state/store";

function inField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

export function useKeyboard() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (inField(e.target)) return;
      const s = useEditor.getState();
      if (e.code === "Space") {
        e.preventDefault();
        s.setPlaying(!s.isPlaying);
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (s.selectedElementId) {
          e.preventDefault();
          s.removeElement(s.selectedElementId);
        }
      } else if (e.key === "Escape") {
        s.selectElement(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
