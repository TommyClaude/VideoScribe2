// Top-level editor layout: toolbar, stage, inspector, and the transport.
// The full per-element timeline track is added in Phase 3.

import { useState } from "react";
import { Toolbar } from "./Toolbar";
import { Library } from "./Library";
import { Stage } from "./Stage";
import { PropertiesPanel } from "./PropertiesPanel";
import { Transport } from "./Transport";
import { Timeline } from "./Timeline";
import { ExportDialog } from "./ExportDialog";
import { usePreviewClock } from "./usePreviewClock";
import { useAudioPlayback } from "./useAudioPlayback";
import { useAutosave } from "./useAutosave";

export function Editor() {
  usePreviewClock();
  useAudioPlayback();
  useAutosave();
  const [exportOpen, setExportOpen] = useState(false);
  return (
    <div className="editor">
      <Toolbar onExport={() => setExportOpen(true)} />
      <div className="workarea">
        <Library />
        <Stage />
        <PropertiesPanel />
      </div>
      <footer className="footer">
        <Transport />
        <Timeline />
      </footer>
      {exportOpen && <ExportDialog onClose={() => setExportOpen(false)} />}
    </div>
  );
}
