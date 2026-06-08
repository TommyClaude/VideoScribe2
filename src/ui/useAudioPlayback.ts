// Starts/stops Web Audio playback in sync with the transport. Audio begins at
// the current playhead when play starts and stops on pause/stop/edit.

import { useEffect } from "react";
import { useEditor } from "../state/store";
import { playAudioAt, stopAudio } from "./audioEngine";

export function useAudioPlayback() {
  const isPlaying = useEditor((s) => s.isPlaying);
  const project = useEditor((s) => s.project);

  useEffect(() => {
    if (!isPlaying) {
      stopAudio();
      return;
    }
    playAudioAt(project, useEditor.getState().playhead);
    return () => stopAudio();
  }, [isPlaying, project]);
}
