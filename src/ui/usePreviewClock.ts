// Drives the preview playhead while playing. Uses requestAnimationFrame with a
// real-time delta — this is ONLY for preview pacing. Determinism lives in the
// engine (render(project, t)); export advances t by a fixed dt instead.

import { useEffect, useRef } from "react";
import { useEditor } from "../state/store";
import { projectDuration } from "../engine/timeline";

export function usePreviewClock() {
  const isPlaying = useEditor((s) => s.isPlaying);
  const project = useEditor((s) => s.project);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const setPlaying = useEditor((s) => s.setPlaying);
  const last = useRef(0);

  useEffect(() => {
    if (!isPlaying) return;
    const duration = projectDuration(project);
    let raf = 0;
    last.current = performance.now();
    const tick = (now: number) => {
      const dt = (now - last.current) / 1000;
      last.current = now;
      const next = useEditor.getState().playhead + dt;
      if (next >= duration) {
        setPlayhead(duration);
        setPlaying(false);
        return;
      }
      setPlayhead(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying, project, setPlayhead, setPlaying]);
}
