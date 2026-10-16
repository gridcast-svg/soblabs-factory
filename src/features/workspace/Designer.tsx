import { drawingSvg, signalColor } from "./drawing";
import { DrawingSets } from "./DrawingSets";
import { AvEditor } from "./AvEditor";
import { useState } from "react";
import { Cable, Plus, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./store";
import { blankItem, uid, reconcile } from "./model";
import type { BomItem, Project } from "./model";
import { download } from "./files";
export function Designer() {
  const { project: p, updateProject } = useWorkspace();
  const [view, setView] = useState<"schematic" | "rack">("schematic");
  const [selected, setSelected] = useState("");
  const [edgeId, setEdgeId] = useState("");
  const device = p.devices.find((d) => d.id === selected);
  const item = p.items.find((i) => i.id === device?.itemId);
  const edge = p.connections.find((c) => c.id === edgeId);
  const issues = reconcile(p);
  function place(i: BomItem) {
    const id = uid();
    updateProject({
      ...p,
      devices: [
        ...p.devices,
        {
          id,
          itemId: i.id,
          label: `${i.description} ${p.devices.filter((d) => d.itemId === i.id).length + 1}`,
          x: 100 + (p.devices.length % 3) * 300,
          y: 100 + Math.floor(p.devices.length / 3) * 200,
          rackStart: null,
        },
      ],
    });
    setSelected(id);
    setEdgeId("");
  }
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <h2>System designer</h2>
          <p>Equipment, ports, and cable schedules linked to your BOM.</p>
        </div>
        <div className="ws-actions">
          <div className="ws-segment">
            <button
              className={view === "schematic" ? "active" : ""}
              onClick={() => setView("schematic")}
            >
              Schematic
            </button>
            <button className={view === "rack" ? "active" : ""} onClick={() => setView("rack")}>
              Rack elevation
            </button>
          </div>
          <button
            className="ws-button"
            onClick={() => download(`${p.name}-${view}.svg`, drawingSvg(p, view), "image/svg+xml")}
          >
            <Download size={15} />
            Export SVG
          </button>
        </div>
      </div>
      <div className="ws-signal-legend" aria-label="Cable signal legend">
        {["Video / HDMI", "Network / RJ45", "Audio / XLR", "Fiber", "Power"].map((type) => (
          <span key={type}>
            <i style={{ background: signalColor(type) }} />
            {type}
          </span>
        ))}
        <span>Dashed cable: no linked BOM item</span>
      </div>
      {view === "schematic" && (
        <AvEditor
          key={`av-${p.id}`}
          onSelection={(nodeId, wireId) => {
            setSelected(nodeId);
            setEdgeId(wireId);
          }}
        />
      )}
      <h3 className="ws-spaced">BOM links & rack properties</h3>
      <p className="ws-footnote">
        Select equipment or a cable in the canvas to edit its Factory details.
      </p>
      <div className={`ws-designer ${view === "schematic" ? "ws-av-details" : ""}`}>
        <aside className="ws-library">
          <div className="ws-panel-label">PROJECT EQUIPMENT</div>
          <p>Place an instance from the selected BOM.</p>
          {p.items
            .filter((i) => i.scope === "Selected" && i.drawingRequired)
            .map((i) => (
              <button key={i.id} className="ws-library-item" onClick={() => place(i)}>
                <Cable size={17} />
                <span>
                  {i.description}
                  <small>
                    {p.devices.filter((d) => d.itemId === i.id).length} drawn / {i.quantity}{" "}
                    specified
                  </small>
                </span>
                <Plus size={14} />
              </button>
            ))}
          {!p.items.length && <p>Add equipment to the BOM first.</p>}
          <div className="ws-panel-label">DESIGN CHECKS · {issues.length}</div>
          <div className="ws-checks">
            {issues.map((s, i) => (
              <p key={i}>{s}</p>
            ))}
            {!issues.length && <p className="ws-success">Quantities and rack placement agree.</p>}
          </div>
          <p className="ws-footnote">
            These checks cover quantities, cable mapping, and rack space. Electrical and signal
            compatibility require technical verification.
          </p>
        </aside>
        {view === "rack" && (
          <div className="ws-canvas">
            <Rack
              project={p}
              selected={selected}
              onSelect={(id) => {
                setSelected(id);
                setEdgeId("");
              }}
            />
          </div>
        )}
        <aside className="ws-inspector">
          <div className="ws-panel-label">PROPERTIES</div>
          {device && item ? (
            <>
              <label>
                Device label
                <input
                  value={device.label}
                  onChange={(e) =>
                    updateProject({
                      ...p,
                      devices: p.devices.map((d) =>
                        d.id === device.id ? { ...d, label: e.target.value } : d,
                      ),
                    })
                  }
                />
              </label>
              <p>{item.description}</p>
              <label>
                Rack starting U
                <input
                  type="number"
                  min="1"
                  max="42"
                  value={device.rackStart ?? ""}
                  placeholder="Not racked"
                  onChange={(e) => {
                    const n = e.target.value ? Number(e.target.value) : null;
                    if (n === null || (Number.isInteger(n) && n >= 1 && n <= 42))
                      updateProject({
                        ...p,
                        devices: p.devices.map((d) =>
                          d.id === device.id ? { ...d, rackStart: n } : d,
                        ),
                      });
                  }}
                />
              </label>
              <label>
                Equipment height (U)
                <input
                  type="number"
                  min="0"
                  max="42"
                  value={item.rackU}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 0 && n <= 42)
                      updateProject({
                        ...p,
                        items: p.items.map((i) => (i.id === item.id ? { ...i, rackU: n } : i)),
                      });
                  }}
                />
              </label>
              <div className="ws-panel-label">PORTS · SHARED EQUIPMENT SPEC</div>
              {item.ports.map((port) => (
                <div className="ws-port-editor" key={port.id}>
                  <input
                    aria-label="Port label"
                    value={port.label}
                    onChange={(e) =>
                      updateProject({
                        ...p,
                        items: p.items.map((i) =>
                          i.id === item.id
                            ? {
                                ...i,
                                ports: i.ports.map((x) =>
                                  x.id === port.id ? { ...x, label: e.target.value } : x,
                                ),
                              }
                            : i,
                        ),
                      })
                    }
                  />
                  <select
                    aria-label="Port direction"
                    value={port.direction}
                    onChange={(e) =>
                      updateProject({
                        ...p,
                        items: p.items.map((i) =>
                          i.id === item.id
                            ? {
                                ...i,
                                ports: i.ports.map((x) =>
                                  x.id === port.id
                                    ? {
                                        ...x,
                                        direction: e.target.value as
                                          "input" | "output" | "bidirectional",
                                      }
                                    : x,
                                ),
                              }
                            : i,
                        ),
                      })
                    }
                  >
                    <option value="input">Input</option>
                    <option value="output">Output</option>
                    <option value="bidirectional">Bidirectional</option>
                  </select>
                  <input
                    aria-label="Connector type"
                    value={port.connector}
                    placeholder="HDMI / RJ45 / XLR…"
                    onChange={(e) =>
                      updateProject({
                        ...p,
                        items: p.items.map((i) =>
                          i.id === item.id
                            ? {
                                ...i,
                                ports: i.ports.map((x) =>
                                  x.id === port.id ? { ...x, connector: e.target.value } : x,
                                ),
                              }
                            : i,
                        ),
                      })
                    }
                  />
                  <button
                    className="ws-icon-button"
                    aria-label="Remove port"
                    onClick={() => {
                      const ids = new Set(
                        p.devices.filter((d) => d.itemId === item.id).map((d) => d.id),
                      );
                      if (
                        p.connections.some(
                          (c) =>
                            (ids.has(c.source) && c.sourcePort === port.id) ||
                            (ids.has(c.target) && c.targetPort === port.id),
                        )
                      ) {
                        toast.error("Remove connected cables before deleting this port");
                        return;
                      }
                      updateProject({
                        ...p,
                        items: p.items.map((i) =>
                          i.id === item.id
                            ? { ...i, ports: i.ports.filter((x) => x.id !== port.id) }
                            : i,
                        ),
                      });
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                className="ws-button"
                onClick={() =>
                  updateProject({
                    ...p,
                    items: p.items.map((i) =>
                      i.id === item.id
                        ? {
                            ...i,
                            ports: [
                              ...i.ports,
                              { id: uid(), label: "New port", direction: "input", connector: "" },
                            ],
                          }
                        : i,
                    ),
                  })
                }
              >
                <Plus size={14} />
                Add port
              </button>
              <button
                className="ws-button danger"
                onClick={() => {
                  updateProject({
                    ...p,
                    devices: p.devices.filter((d) => d.id !== device.id),
                    avDrafts: p.avDrafts.filter(
                      (c) => c.source !== device.id && c.target !== device.id,
                    ),
                    connections: p.connections.filter(
                      (c) => c.source !== device.id && c.target !== device.id,
                    ),
                  });
                  setSelected("");
                }}
              >
                Remove drawing instance
              </button>
            </>
          ) : edge ? (
            <>
              <label>
                Cable ID
                <input
                  value={edge.label}
                  onChange={(e) =>
                    updateProject({
                      ...p,
                      connections: p.connections.map((c) =>
                        c.id === edge.id ? { ...c, label: e.target.value } : c,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Cable / signal type
                <input
                  value={edge.cableType}
                  onChange={(e) =>
                    updateProject({
                      ...p,
                      connections: p.connections.map((c) =>
                        c.id === edge.id ? { ...c, cableType: e.target.value } : c,
                      ),
                    })
                  }
                />
              </label>
              <label>
                Specified length (m)
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={edge.lengthM ?? ""}
                  placeholder="Site verification required"
                  onChange={(e) => {
                    const n = e.target.value ? Number(e.target.value) : null;
                    if (n === null || n > 0)
                      updateProject({
                        ...p,
                        connections: p.connections.map((c) =>
                          c.id === edge.id ? { ...c, lengthM: n } : c,
                        ),
                      });
                  }}
                />
              </label>
              <label>
                BOM cable item
                <select
                  value={edge.bomItemId ?? ""}
                  onChange={(e) =>
                    updateProject({
                      ...p,
                      connections: p.connections.map((c) =>
                        c.id === edge.id ? { ...c, bomItemId: e.target.value || null } : c,
                      ),
                    })
                  }
                >
                  <option value="">Not linked</option>
                  {p.items
                    .filter((i) => i.category === "Cabling")
                    .map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.description}
                      </option>
                    ))}
                </select>
              </label>
              <button
                className="ws-button"
                onClick={() => {
                  const i = {
                    ...blankItem(),
                    description: `${edge.cableType} cable${edge.lengthM ? ` · ${edge.lengthM}m` : ""}`,
                    category: "Cabling",
                    drawingRequired: false,
                    notes: `${edge.label}: verify connectors, cable specification, and adapters.`,
                  };
                  updateProject({
                    ...p,
                    items: [...p.items, i],
                    connections: p.connections.map((c) =>
                      c.id === edge.id ? { ...c, bomItemId: i.id } : c,
                    ),
                  });
                }}
              >
                <Plus size={14} />
                Create BOM cable
              </button>
              <button
                className="ws-button danger"
                onClick={() => {
                  updateProject({
                    ...p,
                    connections: p.connections.filter((c) => c.id !== edge.id),
                  });
                  setEdgeId("");
                }}
              >
                Remove connection
              </button>
            </>
          ) : (
            <div className="ws-empty">
              <Cable size={28} />
              <p>Select a component or connection to edit its properties.</p>
              <p>
                Drag between ports to connect equipment. Use the mouse wheel to zoom and drag the
                canvas to pan.
              </p>
            </div>
          )}
        </aside>
      </div>
      <DrawingSets key={`drawings-${p.id}`} />
      <div className="ws-section-heading ws-spaced">
        <h3>Cable schedule</h3>
        <span className="ws-badge">{p.connections.length} connections</span>
      </div>
      <div className="ws-table-wrap">
        <table className="ws-table">
          <thead>
            <tr>
              <th>Cable ID</th>
              <th>From / Connector</th>
              <th>To / Connector</th>
              <th>Type</th>
              <th>Length</th>
              <th>BOM</th>
            </tr>
          </thead>
          <tbody>
            {p.connections.map((c) => {
              const a = p.devices.find((d) => d.id === c.source),
                b = p.devices.find((d) => d.id === c.target);
              const ap = p.items
                  .find((i) => i.id === a?.itemId)
                  ?.ports.find((x) => x.id === c.sourcePort),
                bp = p.items
                  .find((i) => i.id === b?.itemId)
                  ?.ports.find((x) => x.id === c.targetPort);
              return (
                <tr key={c.id}>
                  <td>
                    <button
                      className="ws-text-button"
                      onClick={() => {
                        setEdgeId(c.id);
                        setSelected("");
                      }}
                    >
                      {c.label}
                    </button>
                  </td>
                  <td>
                    {a?.label}
                    <small>
                      {ap?.label} · {ap?.connector || "Unknown"}
                    </small>
                  </td>
                  <td>
                    {b?.label}
                    <small>
                      {bp?.label} · {bp?.connector || "Unknown"}
                    </small>
                  </td>
                  <td>{c.cableType}</td>
                  <td>{c.lengthM === null ? "Verify" : `${c.lengthM}m`}</td>
                  <td>{p.items.find((i) => i.id === c.bomItemId)?.description || "Missing"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
function Rack({
  project: p,
  selected,
  onSelect,
}: {
  project: Project;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { updateProject } = useWorkspace();
  function placeInRack(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const id = event.dataTransfer.getData("application/soblabs-device");
    const device = p.devices.find((d) => d.id === id);
    const item = p.items.find((i) => i.id === device?.itemId);
    if (!device || !item) return;
    if (!item.rackU) {
      toast.error("Set the equipment rack height before placing it.");
      onSelect(id);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const start = Math.max(
      1,
      Math.min(42, Math.floor((rect.bottom - 10 - event.clientY) / 22) + 1),
    );
    updateProject({
      ...p,
      devices: p.devices.map((d) => (d.id === id ? { ...d, rackStart: start } : d)),
    });
    onSelect(id);
  }
  return (
    <div className="ws-rack-view">
      <div>
        <h3>Equipment rack · 42U</h3>
        <p>Front elevation · U1 at the bottom</p>
        <div className="ws-rack" onDragOver={(e) => e.preventDefault()} onDrop={placeInRack}>
          {Array.from({ length: 42 }, (_, n) => (
            <div className="ws-rack-slot" key={n}>
              <span>{42 - n}</span>
            </div>
          ))}
          {p.devices.map((d) => {
            const i = p.items.find((i) => i.id === d.itemId);
            return d.rackStart !== null && i?.rackU ? (
              <button
                className={`ws-rack-device ${selected === d.id ? "selected" : ""}`}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/soblabs-device", d.id);
                }}
                key={d.id}
                style={{ bottom: (d.rackStart - 1) * 22, height: i.rackU * 22 }}
                onClick={() => onSelect(d.id)}
              >
                <span className="ws-rack-led" />
                {d.label}
                <small>{i.rackU}U</small>
              </button>
            ) : null;
          })}
        </div>
      </div>
      <div className="ws-rack-unplaced">
        <h3>Unplaced equipment</h3>
        <p>Drag equipment into the rack, or set its position in the inspector.</p>
        {p.devices
          .filter((d) => d.rackStart === null)
          .map((d) => (
            <button
              className="ws-library-item"
              key={d.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/soblabs-device", d.id)}
              onClick={() => onSelect(d.id)}
            >
              {d.label}
            </button>
          ))}
      </div>
    </div>
  );
}
