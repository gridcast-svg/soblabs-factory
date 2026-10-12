import { useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import { useWorkspace } from "./store";
import {
  accountFields,
  previewAccountImport,
  applyAccountImport,
  guessMapping,
} from "./crm-import";
import type { AccountFile } from "./crm-import";
import { toast } from "sonner";
export function CrmImport({ file, onClose }: { file: AccountFile; onClose: () => void }) {
  const { state, setState } = useWorkspace();
  const [mapping, setMapping] = useState(() => guessMapping(file.headers));
  const [mode, setMode] = useState<"fill" | "update">("fill");
  const [confirmed, setConfirmed] = useState(false);
  const preview = useMemo(
    () => previewAccountImport(file, mapping, state.accounts, mode),
    [file, mapping, state.accounts, mode],
  );
  const errors = preview.filter((r) => r.action === "Error");
  const review = preview.some((r) => r.action === "Review");
  return (
    <div className="ws-modal-backdrop">
      <div className="ws-modal crm-import-modal">
        <div className="ws-section-heading">
          <div>
            <h2>Review Zoho account import</h2>
            <p>
              {file.name} · {file.rows.length} source records
            </p>
          </div>
          <button className="ws-icon-button" aria-label="Close account import" onClick={onClose}>
            <X />
          </button>
        </div>
        <p>
          Map the source columns, review matches, and apply the import to this workspace. No
          customer data is added to the application’s public code.
        </p>
        <div className="ws-form-grid">
          {accountFields.map(([key, label]) => (
            <label key={key}>
              {label}
              {key === "name" ? " *" : ""}
              <select
                value={mapping[key] ?? ""}
                onChange={(e) => {
                  setMapping({ ...mapping, [key]: e.target.value });
                  setConfirmed(false);
                }}
              >
                <option value="">Not mapped</option>
                {file.headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <label className="wide">
            Existing account policy
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as "fill" | "update");
                setConfirmed(false);
              }}
            >
              <option value="fill">Fill empty fields; preserve existing values</option>
              <option value="update">Update mapped fields using nonblank values in the file</option>
            </select>
          </label>
        </div>
        <div className="ws-callout">
          Exact Zoho IDs match first. Without IDs, a unique company-name match requires your
          confirmation. Importing never deletes accounts or clears fields with blanks. Unmapped
          source fields are retained for reference.
        </div>
        <div className="crm-import-summary">
          {["Add", "Update", "Review", "Error"].map((a) => (
            <span className="ws-badge" key={a}>
              {a}: {preview.filter((p) => p.action === a).length}
            </span>
          ))}
        </div>
        <div className="ws-table-wrap crm-import-table">
          <table className="ws-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Action</th>
                <th>Account</th>
                <th>Zoho ID</th>
                <th>Match / issue</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.row}>
                  <td>{row.row || "—"}</td>
                  <td>
                    <span className={`ws-badge ${row.action === "Error" ? "crm-error" : ""}`}>
                      {row.action}
                    </span>
                  </td>
                  <td>{row.account?.name || "—"}</td>
                  <td>{row.account?.sourceId || "—"}</td>
                  <td>{row.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {review && (
          <label className="ws-checkbox">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            I reviewed the company-name matches and confirm they refer to the existing accounts.
          </label>
        )}
        <div className="ws-actions">
          <button
            className="ws-button primary"
            disabled={!!errors.length || (review && !confirmed)}
            onClick={() => {
              try {
                const accounts = applyAccountImport(state.accounts, preview);
                const byId = new Map(accounts.map((a) => [a.id, a]));
                setState({
                  ...state,
                  accounts,
                  contacts: state.contacts.map((c) =>
                    c.accountId ? { ...c, company: byId.get(c.accountId)?.name ?? c.company } : c,
                  ),
                  projects: state.projects.map((p) =>
                    p.accountId ? { ...p, customer: byId.get(p.accountId)?.name ?? p.customer } : p,
                  ),
                });
                toast.success(`${preview.length} account records imported`);
                onClose();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Import failed");
              }
            }}
          >
            <Check size={16} />
            Apply account import
          </button>
          <button className="ws-button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
