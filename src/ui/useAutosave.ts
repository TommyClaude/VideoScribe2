// Draft handling: auto-saves the working project, but does NOT silently replace
// the editor with the last draft on startup (that made a freshly built app show
// the previous session's content). Instead a fresh project opens immediately and
// `pending` exposes any saved draft so the UI can offer to restore it.
//
// Auto-save is "armed" only after the user decides (restore/dismiss) or when no
// draft exists — otherwise the fresh empty project would overwrite the draft
// before the user can recover it.

import { useEffect, useRef, useState } from "react";
import { useEditor } from "../state/store";
import { loadDraft, saveDraft } from "./projectIO";
import type { Project } from "../engine/types";

function hasContent(p: Project): boolean {
  return (
    p.assets.length > 0 ||
    p.scenes.some((s) => s.elements.length > 0) ||
    p.meta.name !== "Untitled"
  );
}

export interface DraftControls {
  pending: Project | null;
  restore: () => void;
  dismiss: () => void;
}

export function useDraft(): DraftControls {
  const project = useEditor((s) => s.project);
  const setProject = useEditor((s) => s.setProject);
  const [pending, setPending] = useState<Project | null>(null);
  const [armed, setArmed] = useState(false);
  const once = useRef(false);

  // Check for a saved draft once, but don't apply it automatically.
  useEffect(() => {
    if (once.current) return;
    once.current = true;
    void loadDraft().then((p) => {
      if (p && hasContent(p)) setPending(p);
      else setArmed(true); // nothing worth restoring → start saving
    });
  }, []);

  // Debounced auto-save, only once armed.
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => void saveDraft(project), 1500);
    return () => clearTimeout(id);
  }, [project, armed]);

  return {
    pending,
    restore: () => {
      if (pending) setProject(pending);
      setPending(null);
      setArmed(true);
    },
    dismiss: () => {
      setPending(null);
      setArmed(true);
    },
  };
}
