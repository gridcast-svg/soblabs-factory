import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, RefreshCw } from "lucide-react";
import { applyAvDocument, projectToAv } from "./av-bridge";
import { useWorkspace } from "./store";
import "./av-editor.css";

export function AvEditor({
  onSelection,
}: {
  onSelection: (nodeId: string, edgeId: string) => void;
}) {
  const { project, updateProject } = useWorkspace();
  const frame = useRef<HTMLIFrameElement>(null);
  const shell = useRef<HTMLDivElement>(null);
  const latest = useRef({ project, updateProject, onSelection });
  latest.current = { project, updateProject, onSelection };
  const ready = useRef(false);
  const generation = useRef(0);
  const lastProject = useRef("");
  const [status, setStatus] = useState("Opening AV designer…");
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    const current = latest.current.project;
    const document = projectToAv(current);
    lastProject.current = JSON.stringify(document);
    generation.current++;
    frame.current?.contentWindow?.postMessage(
      {
        channel: "soblabs-av-v1",
        type: "load",
        projectId: current.id,
        generation: generation.current,
        document,
      },
      window.location.origin,
    );
  }, []);

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow)
        return;
      const message = event.data;
      if (message?.channel !== "soblabs-av-v1") return;
      if (message.type === "ready") {
        ready.current = true;
        load();
        return;
      }
      if (
        message.projectId !== latest.current.project.id ||
        message.generation !== generation.current
      )
        return;
      if (message.type === "selection") {
        latest.current.onSelection(
          typeof message.nodeId === "string" ? message.nodeId : "",
          typeof message.edgeId === "string" ? message.edgeId : "",
        );
      } else if (message.type === "change") {
        try {
          const current = latest.current.project;
          const next = applyAvDocument(current, message.document);
          lastProject.current = JSON.stringify(projectToAv(next));
          if (JSON.stringify(next) !== JSON.stringify(current)) {
            latest.current = { ...latest.current, project: next };
            latest.current.updateProject(next);
          }
          setFailed(false);
          setStatus("AV edits linked to this project's BOM");
        } catch (error) {
          setFailed(true);
          setStatus(
            `Changes not saved: ${error instanceof Error ? error.message : "Invalid drawing"}`,
          );
        }
      } else if (message.type === "error") {
        setFailed(true);
        setStatus("The AV editor could not load this drawing. Reload the editor to retry.");
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [load]);

  useEffect(() => {
    if (ready.current && JSON.stringify(projectToAv(project)) !== lastProject.current) load();
  }, [project, load]);

  return (
    <section className="ws-av-editor" aria-label="Interactive AV schematic editor">
      <div className="ws-av-toolbar">
        <div>
          <strong>AV schematic</strong>
          <span>Drag equipment from the library. Select a wire to reshape its route.</span>
        </div>
        <button
          className="ws-button"
          onClick={() =>
            void shell.current
              ?.requestFullscreen()
              .catch(() => setStatus("Use your browser's full-screen mode to expand the designer."))
          }
        >
          <Maximize2 size={14} /> Full screen
        </button>
      </div>
      <div className="ws-av-frame" ref={shell}>
        <iframe
          key={project.id}
          ref={frame}
          src="/av-editor/index.html"
          title="Soblabs AV schematic canvas"
          sandbox="allow-scripts allow-same-origin allow-downloads"
        />
      </div>
      <div className={`ws-av-status ${failed ? "error" : ""}`} role="status">
        <span>{status}</span>
        <button
          className="ws-text-button"
          onClick={() => {
            ready.current = false;
            setStatus("Opening AV designer…");
            if (frame.current) frame.current.src = "/av-editor/index.html";
          }}
        >
          <RefreshCw size={12} /> Reload editor
        </button>
      </div>
      <p className="ws-footnote">
        Dropping library equipment creates a BOM line with unknown cost. Removing a drawing instance
        keeps its BOM line. Finish both cable ends to include a cable in the schedule. Set cable
        lengths, BOM links and rack positions below.
      </p>
    </section>
  );
}
