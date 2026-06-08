// Debounced auto-save of the working project to a draft, plus a one-time
// restore of that draft on startup.

import { useEffect, useRef } from "react";
import { useEditor } from "../state/store";
import { loadDraft, saveDraft } from "./projectIO";

export function useAutosave() {
  const project = useEditor((s) => s.project);
  const setProject = useEditor((s) => s.setProject);
  const restored = useRef(false);

  // Restore the last draft once, before the user starts editing.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    void loadDraft().then((p) => {
      if (p) setProject(p);
    });
  }, [setProject]);

  // Debounced auto-save on change.
  useEffect(() => {
    const id = setTimeout(() => void saveDraft(project), 1500);
    return () => clearTimeout(id);
  }, [project]);
}
