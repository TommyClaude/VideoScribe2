// Playback transport: play / pause / stop + a scrubber. The full timeline with
// per-element blocks is added in Phase 3; this is the minimal Phase 2 preview.

import { useMemo } from "react";
import { useEditor } from "../state/store";
import { computeTimeline } from "../engine/timeline";

export function Transport() {
  const isPlaying = useEditor((s) => s.isPlaying);
  const playhead = useEditor((s) => s.playhead);
  const project = useEditor((s) => s.project);
  const setPlayhead = useEditor((s) => s.setPlayhead);
  const setPlaying = useEditor((s) => s.setPlaying);

  const duration = useMemo(() => computeTimeline(project).duration, [project]);
  const max = Math.max(duration, 0.001);

  function play() {
    if (playhead >= duration) setPlayhead(0);
    setPlaying(true);
  }
  function pause() {
    setPlaying(false);
  }
  function stop() {
    setPlaying(false);
    setPlayhead(0);
  }

  return (
    <div className="transport">
      {isPlaying ? (
        <button className="ghost" onClick={pause} aria-label="pause">
          ⏸
        </button>
      ) : (
        <button className="ghost" onClick={play} aria-label="play">
          ▶
        </button>
      )}
      <button className="ghost" onClick={stop} aria-label="stop">
        ⏹
      </button>
      <input
        className="scrubber"
        type="range"
        min={0}
        max={max}
        step={0.01}
        value={Math.min(playhead, max)}
        onChange={(e) => {
          setPlaying(false);
          setPlayhead(parseFloat(e.target.value));
        }}
      />
      <span className="time">
        {playhead.toFixed(2)}s / {duration.toFixed(2)}s
      </span>
    </div>
  );
}
