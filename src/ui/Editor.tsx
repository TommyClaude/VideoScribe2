// Top-level editor layout: toolbar, stage, inspector, and the transport.
// The full per-element timeline track is added in Phase 3.

import { Toolbar } from "./Toolbar";
import { Stage } from "./Stage";
import { PropertiesPanel } from "./PropertiesPanel";
import { Transport } from "./Transport";
import { usePreviewClock } from "./usePreviewClock";

export function Editor() {
  usePreviewClock();
  return (
    <div className="editor">
      <Toolbar />
      <div className="workarea">
        <Stage />
        <PropertiesPanel />
      </div>
      <footer className="footer">
        <Transport />
      </footer>
    </div>
  );
}
