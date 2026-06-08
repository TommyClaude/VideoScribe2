// Right-hand inspector: edit the selected element's transform numerically,
// change z-order, and delete. Animation controls are added in Phase 3.

import { useEditor } from "../state/store";

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

  const asset = assetById(selected.assetId);
  const t = selected.transform;

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
