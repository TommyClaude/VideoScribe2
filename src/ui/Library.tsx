// Built-in SVG library: click an icon to drop it on the stage. Users can also
// import their own SVG/PNG from the toolbar.

import { useEditor } from "../state/store";
import { LIBRARY, libraryAsset } from "../engine/library";
import { svgDataUrl } from "./assets";

export function Library() {
  const addElementForAsset = useEditor((s) => s.addElementForAsset);

  return (
    <aside className="library">
      <h2>Library</h2>
      {LIBRARY.map((cat) => (
        <div key={cat.category} className="lib-cat">
          <h3>{cat.category}</h3>
          <div className="lib-grid">
            {cat.items.map((item) => (
              <button
                key={item.id}
                className="lib-item"
                title={item.name}
                onClick={() => addElementForAsset(libraryAsset(item))}
              >
                <img src={svgDataUrl(item.svg)} alt={item.name} draggable={false} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}
