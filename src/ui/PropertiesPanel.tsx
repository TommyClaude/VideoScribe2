// Right-hand inspector: edit the selected element's transform numerically,
// change z-order, and delete. Animation controls are added in Phase 3.

import { useEditor } from "../state/store";
import { HANDS } from "../engine/hands";
import { defaultReveal } from "../engine/reveal";
import type { DrawStyle, EasingName, RevealParams } from "../engine/types";

function round(n: number, p = 2): number {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

function NumberField(props: {
  label: string;
  value: number;
  step?: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="field">
      <span>{props.label}</span>
      <input
        type="number"
        value={round(props.value)}
        step={props.step ?? 1}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) props.onChange(v);
        }}
      />
    </label>
  );
}

export function PropertiesPanel() {
  const selected = useEditor((s) => s.selectedElement());
  const assetById = useEditor((s) => s.assetById);
  const updateTransform = useEditor((s) => s.updateTransform);
  const removeElement = useEditor((s) => s.removeElement);
  const moveZ = useEditor((s) => s.moveZ);

  if (!selected) {
    return (
      <aside className="panel">
        <h2>Properties</h2>
        <p className="muted">Chọn một phần tử trên stage để chỉnh sửa.</p>
      </aside>
    );
  }

  const updateAnim = useEditor((s) => s.updateAnim);
  const updateReveal = useEditor((s) => s.updateReveal);
  const viewCam = useEditor((s) => s.viewCam);
  const setElementCamera = useEditor((s) => s.setElementCamera);
  const asset = assetById(selected.assetId);
  const t = selected.transform;
  const anim = selected.anim;
  const isRaster = asset?.type === "image";
  const reveal: RevealParams = selected.reveal ?? defaultReveal();

  return (
    <aside className="panel">
      <h2>Properties</h2>
      <p className="asset-name" title={asset?.name}>
        {asset?.name ?? selected.assetId}
        <span className="badge">{asset?.type ?? "?"}</span>
      </p>

      <div className="group">
        <h3>Transform</h3>
        <div className="grid2">
          <NumberField label="X" value={t.x} onChange={(v) => updateTransform(selected.id, { x: v })} />
          <NumberField label="Y" value={t.y} onChange={(v) => updateTransform(selected.id, { y: v })} />
          <NumberField
            label="Scale"
            value={t.scale}
            step={0.05}
            onChange={(v) => updateTransform(selected.id, { scale: Math.max(0.02, v) })}
          />
          <NumberField
            label="Rotation°"
            value={t.rotation}
            onChange={(v) => updateTransform(selected.id, { rotation: v })}
          />
        </div>
      </div>

      <div className="group">
        <h3>Animation</h3>
        <div className="grid2">
          <NumberField
            label="Draw (s)"
            value={anim.drawDuration}
            step={0.25}
            onChange={(v) => updateAnim(selected.id, { drawDuration: Math.max(0, v) })}
          />
          <NumberField
            label="Hold (s)"
            value={anim.holdDuration}
            step={0.25}
            onChange={(v) => updateAnim(selected.id, { holdDuration: Math.max(0, v) })}
          />
        </div>
        <label className="field">
          <span>Style</span>
          <select
            value={anim.style}
            onChange={(e) => updateAnim(selected.id, { style: e.target.value as DrawStyle })}
          >
            <option value="draw">draw</option>
            <option value="fade">fade</option>
            <option value="pop">pop</option>
          </select>
        </label>
        <label className="field">
          <span>Easing</span>
          <select
            value={anim.easing}
            onChange={(e) => updateAnim(selected.id, { easing: e.target.value as EasingName })}
          >
            <option value="linear">linear</option>
            <option value="easeIn">easeIn</option>
            <option value="easeOut">easeOut</option>
            <option value="easeInOut">easeInOut</option>
          </select>
        </label>
        <label className="field">
          <span>Hand</span>
          <select
            value={anim.handId ?? ""}
            onChange={(e) =>
              updateAnim(selected.id, { handId: e.target.value === "" ? null : e.target.value })
            }
          >
            <option value="">none</option>
            {HANDS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>

        {isRaster && anim.style === "draw" && (
          <>
            <label className="field">
              <span>Reveal direction</span>
              <select
                value={reveal.direction}
                onChange={(e) =>
                  updateReveal(selected.id, {
                    direction: e.target.value as RevealParams["direction"],
                  })
                }
              >
                <option value="right">right</option>
                <option value="left">left</option>
                <option value="down">down</option>
                <option value="up">up</option>
                <option value="diagonal">diagonal</option>
              </select>
            </label>
            <NumberField
              label="Reveal bands"
              value={reveal.rows}
              step={1}
              onChange={(v) => updateReveal(selected.id, { rows: Math.max(1, Math.round(v)) })}
            />
          </>
        )}
      </div>

      <div className="group">
        <h3>Camera</h3>
        <p className="muted cam-note">
          {selected.camera
            ? `Target ${Math.round(selected.camera.x)}, ${Math.round(selected.camera.y)} · zoom ${selected.camera.zoom.toFixed(2)}`
            : "Bám camera của scene (chưa đặt riêng)."}
        </p>
        <div className="btn-row">
          <button onClick={() => setElementCamera(selected.id, { ...viewCam })}>
            Set to view
          </button>
          <button
            disabled={!selected.camera}
            onClick={() => setElementCamera(selected.id, null)}
          >
            Clear
          </button>
        </div>
        <p className="muted cam-hint">
          Cuộn để zoom, kéo nền để pan, rồi "Set to view". Play để xem camera lia.
        </p>
      </div>

      <div className="group">
        <h3>Order</h3>
        <div className="btn-row">
          <button onClick={() => moveZ(selected.id, "back")}>⤓ Back</button>
          <button onClick={() => moveZ(selected.id, "backward")}>↓</button>
          <button onClick={() => moveZ(selected.id, "forward")}>↑</button>
          <button onClick={() => moveZ(selected.id, "front")}>⤒ Front</button>
        </div>
      </div>

      <div className="group">
        <button className="danger" onClick={() => removeElement(selected.id)}>
          Delete element
        </button>
      </div>
    </aside>
  );
}
