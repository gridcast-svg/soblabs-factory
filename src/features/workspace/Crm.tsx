import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useWorkspace } from "./store";
import { uid } from "./model";
import type { Contact } from "./model";
export function Crm() {
  const { state, setState } = useWorkspace();
  const [edit, setEdit] = useState<Contact | null>(null);
  return (
    <>
      <div className="ws-section-heading">
        <div>
          <h2>Customer relationships</h2>
          <p>People, companies, and the opportunities you’re working on.</p>
        </div>
        <button
          className="ws-button primary"
          onClick={() =>
            setEdit({ id: uid(), company: "", name: "", email: "", stage: "Lead", notes: "" })
          }
        >
          <Plus size={15} />
          Add contact
        </button>
      </div>
      <div className="ws-callout">
        Microsoft 365 is not connected to this app yet. No mailbox has been read and no daily CRM
        sync is running.
      </div>
      <div className="ws-pipeline">
        {(["Lead", "Qualified", "Proposal", "Won", "Lost"] as const).map((stage) => (
          <section className="ws-pipeline-column" key={stage}>
            <h3>
              {stage}
              <span>{state.contacts.filter((c) => c.stage === stage).length}</span>
            </h3>
            {state.contacts
              .filter((c) => c.stage === stage)
              .map((c) => (
                <button className="ws-contact-card" key={c.id} onClick={() => setEdit(c)}>
                  <strong>{c.company || c.name}</strong>
                  <span>{c.name}</span>
                  <small>{c.email || "No email recorded"}</small>
                </button>
              ))}
          </section>
        ))}
      </div>
      {edit && (
        <div className="ws-modal-backdrop">
          <form
            className="ws-modal"
            onSubmit={(e) => {
              e.preventDefault();
              setState({
                ...state,
                contacts: state.contacts.some((c) => c.id === edit.id)
                  ? state.contacts.map((c) => (c.id === edit.id ? edit : c))
                  : [...state.contacts, edit],
              });
              setEdit(null);
            }}
          >
            <div className="ws-section-heading">
              <h2>Contact details</h2>
              <button
                type="button"
                aria-label="Close contact editor"
                className="ws-icon-button"
                onClick={() => setEdit(null)}
              >
                <X />
              </button>
            </div>
            <div className="ws-form-grid">
              {(["company", "name", "email"] as const).map((k) => (
                <label key={k}>
                  {k}
                  <input
                    required={k === "name"}
                    type={k === "email" ? "email" : "text"}
                    value={edit[k]}
                    onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                  />
                </label>
              ))}
              <label>
                Stage
                <select
                  value={edit.stage}
                  onChange={(e) => setEdit({ ...edit, stage: e.target.value as Contact["stage"] })}
                >
                  {["Lead", "Qualified", "Proposal", "Won", "Lost"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label className="wide">
                Notes
                <textarea
                  value={edit.notes}
                  onChange={(e) => setEdit({ ...edit, notes: e.target.value })}
                />
              </label>
            </div>
            <button className="ws-button primary">Save contact</button>
          </form>
        </div>
      )}
    </>
  );
}
