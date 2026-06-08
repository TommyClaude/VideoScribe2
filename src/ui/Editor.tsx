// Top-level editor layout: toolbar, stage, inspector. The bottom timeline area
// is reserved here and filled in from Phase 3.

import { Toolbar } from "./Toolbar";
import { Stage } from "./Stage";
import { PropertiesPanel } from "./PropertiesPanel";

export function Editor() {
  return (
    <div className="editor">
      <Toolbar />
      <div className="workarea">
        <Stage />
        <PropertiesPanel />
      </div>
      <footer className="timeline-placeholder">
        <span className="muted">Timeline — Phase 3</span>
      </footer>
    </div>
  );
}
