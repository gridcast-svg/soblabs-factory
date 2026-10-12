import { useState } from "react";
import { Upload, FileText, Plus, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useWorkspace } from "./store";
import { readPdf } from "./files";
import { uid } from "./model";
import type { Task } from "./model";
import { extractActions } from "./actions";
export function Meetings() {
  const { project: p, updateProject } = useWorkspace();
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<{ title: string; sourceName: string; text: string } | null>(
    null,
  );
  const [actions, setActions] = useState<Pick<Task, "title" | "owner" | "due">[]>([]);
  const meeting = p.meetings.find((m) => m.id === selected) ?? p.meetings[0];
  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    try {
      const text = await readPdf(f);
      setDraft({ title: f.name.replace(/\.pdf$/i, ""), sourceName: f.name, text });
      setActions(extractActions(text));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF could not be read");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <h2>Meeting intelligence</h2>
          <p>Keep PLAUD summaries and their follow-ups with the project.</p>
        </div>
        <label className="ws-button primary">
          <Upload size={16} />
          {busy ? "Reading PDF…" : "Import PLAUD PDF"}
          <input
            hidden
            type="file"
            accept=".pdf"
            disabled={busy}
            onChange={(e) => {
              void upload(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
      <div className="ws-callout">
        SharePoint ingestion is not connected. PDF imports are manual and use readable text. Action
        items are proposals for your review; customers, dates, and decisions are not inferred
        automatically.
      </div>
      <div className="ws-meeting-layout">
        <div className="ws-card">
          <h3>Project meetings</h3>
          {p.meetings.map((m) => (
            <button
              className={`ws-meeting-row ${meeting?.id === m.id ? "active" : ""}`}
              key={m.id}
              onClick={() => setSelected(m.id)}
            >
              <FileText size={20} />
              <span>
                {m.title}
                <small>
                  {m.status} · imported {new Date(m.importedAt).toLocaleDateString()}
                </small>
              </span>
            </button>
          ))}
          {!p.meetings.length && (
            <div className="ws-empty">
              <FileText size={30} />
              <p>Import a PLAUD PDF to capture your first meeting.</p>
            </div>
          )}
        </div>
        <div className="ws-card">
          {meeting ? (
            <>
              <div className="ws-section-heading">
                <div>
                  <h3>{meeting.title}</h3>
                  <p>Source: {meeting.sourceName}</p>
                </div>
                <button
                  className="ws-button"
                  onClick={() =>
                    updateProject({
                      ...p,
                      meetings: p.meetings.map((m) =>
                        m.id === meeting.id ? { ...m, status: "Reviewed" } : m,
                      ),
                    })
                  }
                >
                  <Check size={15} />
                  Mark reviewed
                </button>
              </div>
              <p className="ws-footnote">
                Extracted text is retained. The original PDF remains in your source folder.
              </p>
              <pre className="ws-transcript">{meeting.text}</pre>
            </>
          ) : (
            <div className="ws-empty">Select a meeting to read its notes and source details.</div>
          )}
        </div>
      </div>
      {draft && (
        <div className="ws-modal-backdrop">
          <div className="ws-modal">
            <div className="ws-section-heading">
              <h2>Review meeting import</h2>
              <button
                className="ws-icon-button"
                aria-label="Close meeting import"
                onClick={() => setDraft(null)}
              >
                <X />
              </button>
            </div>
            <label>
              Meeting title
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              />
            </label>
            <p>
              Assigned to <strong>{p.name}</strong>. Verify this is the correct project.
            </p>
            <h3>Proposed action items</h3>
            {!actions.length && (
              <p>No structured checkbox action items found. You can add follow-ups manually.</p>
            )}
            {actions.map((a, n) => (
              <div className="ws-action-review" key={n}>
                <input
                  aria-label="Action title"
                  value={a.title}
                  onChange={(e) =>
                    setActions(
                      actions.map((x, i) => (i === n ? { ...x, title: e.target.value } : x)),
                    )
                  }
                />
                <input
                  aria-label="Action owner"
                  value={a.owner}
                  placeholder="Owner"
                  onChange={(e) =>
                    setActions(
                      actions.map((x, i) => (i === n ? { ...x, owner: e.target.value } : x)),
                    )
                  }
                />
                <input
                  aria-label="Action due date"
                  type="date"
                  value={a.due}
                  onChange={(e) =>
                    setActions(actions.map((x, i) => (i === n ? { ...x, due: e.target.value } : x)))
                  }
                />
                <button
                  className="ws-icon-button"
                  aria-label="Remove proposed action"
                  onClick={() => setActions(actions.filter((_, i) => i !== n))}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
            <button
              className="ws-button"
              onClick={() => setActions([...actions, { title: "", owner: "", due: "" }])}
            >
              <Plus size={15} />
              Add follow-up
            </button>
            <details>
              <summary>Extracted source text</summary>
              <pre className="ws-transcript">{draft.text}</pre>
            </details>
            <button
              className="ws-button primary"
              disabled={!draft.title.trim()}
              onClick={() => {
                const id = uid();
                updateProject({
                  ...p,
                  meetings: [
                    ...p.meetings,
                    { ...draft, id, status: "Needs review", importedAt: new Date().toISOString() },
                  ],
                  tasks: [
                    ...p.tasks,
                    ...actions
                      .filter((a) => a.title.trim())
                      .map((a) => ({ ...a, id: uid(), sourceMeetingId: id, done: false })),
                  ],
                });
                setSelected(id);
                setDraft(null);
                toast.success("Meeting and reviewed follow-ups saved");
              }}
            >
              Save meeting and follow-ups
            </button>
          </div>
        </div>
      )}
    </>
  );
}
