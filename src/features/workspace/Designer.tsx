import { drawingSvg } from "./drawing";
import { useEffect, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  MarkerType,
} from "@xyflow/react";
import type { NodeProps, Node, Connection as FlowConnection } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Cable, Plus, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./store";
import { blankItem, uid, reconcile } from "./model";
import type { BomItem, Project } from "./model";
import { download } from "./files";
type EquipmentNode = Node<
  { label: string; description: string; ports: BomItem["ports"] },
  "equipment"
>;
function Equipment({ data, selected }: NodeProps<EquipmentNode>) {
  return (
    <div className={`ws-equipment ${selected ? "selected" : ""}`}>
      <div className="ws-equipment-title">
        <Cable size={15} />
        {data.label}
      </div>
      <small>{data.description}</small>
      <div className="ws-port-list">
        {data.ports.map((p) => (
          <div className={`ws-port ${p.direction}`} key={p.id}>
            {p.direction !== "output" && (
              <Handle id={p.id} type="target" position={Position.Left} />
            )}
            <span>{p.label}</span>
            <small>{p.connector || "Unknown"}</small>
            {p.direction !== "input" && (
              <Handle id={p.id} type="source" position={Position.Right} />
            )}
          </div>
        ))}
      </div>
      {!data.ports.length && <p className="ws-footnote">Select device to add ports</p>}
    </div>
  );
}
const nodeTypes = { equipment: Equipment };
export function Designer() {
  const { project: p, updateProject } = useWorkspace();
  const [view, setView] = useState<"schematic" | "rack">("schematic");
  const [selected, setSelected] = useState("");
  const [edgeId, setEdgeId] = useState("");
  const [nodes, setNodes, onNodesChange] = useNodesState<EquipmentNode>([]);
  useEffect(() => {
    setNodes(
      p.devices.map((d) => ({
        id: d.id,
        type: "equipment",
        position: { x: d.x, y: d.y },
        data: {
          label: d.label,
          description: p.items.find((i) => i.id === d.itemId)?.description ?? "",
          ports: p.items.find((i) => i.id === d.itemId)?.ports ?? [],
        },
      })),
    );
  }, [p.devices, p.items, setNodes]);
  const device = p.devices.find((d) => d.id === selected);
  const item = p.items.find((i) => i.id === device?.itemId);
  const edge = p.connections.find((c) => c.id === edgeId);
  const issues = reconcile(p);
  function connect(c: FlowConnection) {
    const src = p.devices.find((d) => d.id === c.source);
    const dst = p.devices.find((d) => d.id === c.target);
    const sp = p.items
      .find((i) => i.id === src?.itemId)
      ?.ports.find((x) => x.id === c.sourceHandle);
    const tp = p.items
      .find((i) => i.id === dst?.itemId)
      ?.ports.find((x) => x.id === c.targetHandle);
    if (!sp || !tp || c.source === c.target) return;
    if (sp.connector !== tp.connector)
      toast.warning("Different connector types: verify an adapter or converter.");
    if (
      p.connections.some(
        (x) =>
          x.source === c.source &&
          x.sourcePort === c.sourceHandle &&
          x.target === c.target &&
          x.targetPort === c.targetHandle,
      )
    ) {
      toast.error("That connection already exists");
      return;
    }
    const id = uid();
    updateProject({
      ...p,
      connections: [
        ...p.connections,
        {
          id,
          source: c.source,
          target: c.target,
          sourcePort: c.sourceHandle!,
          targetPort: c.targetHandle!,
          label: `C-${String(p.connections.length + 1).padStart(3, "0")}`,
          cableType: sp.connector === tp.connector ? sp.connector : "Verify / adapter required",
          lengthM: null,
          bomItemId: null,
        },
      ],
    });
    setEdgeId(id);
    setSelected("");
  }
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
  const edges = p.connections.map((c) => ({
    id: c.id,
    source: c.source,
    target: c.target,
    sourceHandle: c.sourcePort,
    targetHandle: c.targetPort,
    label: `${c.label} · ${c.cableType}${c.lengthM ? ` · ${c.lengthM}m` : ""}`,
    type: "smoothstep",
    animated: false,
    markerEnd: { type: MarkerType.ArrowClosed, color: "#73e3e9" },
    style: { stroke: c.bomItemId ? "#73e3e9" : "#b5a0f3", strokeWidth: 2 },
    labelStyle: { fill: "#d9e6ee", fontSize: 11 },
    labelBgStyle: { fill: "#1b2332" },
  }));
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
      <div className="ws-designer">
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
        <div className="ws-canvas">
          {view === "schematic" ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onNodeDragStop={(_, n) =>
                updateProject({
                  ...p,
                  devices: p.devices.map((d) =>
                    d.id === n.id
                      ? {
                          ...d,
                          x: Math.round(n.position.x / 20) * 20,
                          y: Math.round(n.position.y / 20) * 20,
                        }
                      : d,
                  ),
                })
              }
              onConnect={connect}
              onNodeClick={(_, n) => {
                setSelected(n.id);
                setEdgeId("");
              }}
              onEdgeClick={(_, e) => {
                setEdgeId(e.id);
                setSelected("");
              }}
              onPaneClick={() => {
                setSelected("");
                setEdgeId("");
              }}
              fitView
              snapToGrid
              snapGrid={[20, 20]}
              deleteKeyCode={null}
              colorMode="dark"
              minZoom={0.2}
              maxZoom={2}
            >
              <Background gap={20} color="#253041" />
              <Controls />
              <MiniMap nodeColor="#41747f" />
            </ReactFlow>
          ) : (
            <Rack
              project={p}
              selected={selected}
              onSelect={(id) => {
                setSelected(id);
                setEdgeId("");
              }}
            />
          )}
        </div>
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
