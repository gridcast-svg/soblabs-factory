import { useState } from "react";
import { toast } from "sonner";
import { PlannerNumberField as NumberField } from "./PlannerNumberField";
import {
  projectionLensSchema,
  projectionProjectorSchema,
  type ProjectionLens,
  type ProjectionProjector,
} from "./projection-schema";
import { uid } from "./model";

export function ProjectionEquipment({
  kind,
  initial,
  mount,
  save,
  close,
}: {
  kind: "projector" | "lens";
  initial: ProjectionProjector | ProjectionLens | null;
  mount: string;
  save: (value: ProjectionProjector | ProjectionLens) => void;
  close: () => void;
}) {
  const projector = initial && "nativeWidth" in initial ? initial : null;
  const lens = initial && "throwRatioMin" in initial ? initial : null;
  const [draft, setDraft] = useState({
    id: initial?.id ?? uid(),
    brand: projector?.brand ?? "",
    model: projector?.model ?? lens?.name ?? "",
    mount: initial?.mount ?? mount,
    nativeWidth: projector?.nativeWidth ?? null,
    nativeHeight: projector?.nativeHeight ?? null,
    lumens: projector?.lumens ?? null,
    lensIncluded: projector?.lensIncluded ?? false,
    throwRatioMin: lens?.throwRatioMin ?? null,
    throwRatioMax: lens?.throwRatioMax ?? null,
    hShiftPct: lens?.hShiftPct ?? null,
    vShiftPct: lens?.vShiftPct ?? null,
    source: initial?.source ?? "",
    verified: initial?.verified ?? false,
  });
  const patch = (change: Partial<typeof draft>) =>
    setDraft({ ...draft, ...change, verified: false });
  return (
    <div className="ws-modal-backdrop">
      <form
        className="ws-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`${initial ? "Edit" : "Add"} ${kind} profile`}
        onSubmit={(e) => {
          e.preventDefault();
          const parsed =
            kind === "projector"
              ? projectionProjectorSchema.safeParse(draft)
              : projectionLensSchema.safeParse({ ...draft, name: draft.model });
          if (!parsed.success) {
            toast.error(
              parsed.error.issues
                .map((x) => `${x.path.join(".")}: ${x.message}`)
                .slice(0, 3)
                .join("; "),
            );
            return;
          }
          save(parsed.data);
        }}
      >
        <h2>
          {initial ? "Edit" : "Add"} {kind} profile
        </h2>
        <p>
          Record the exact product and operating mode. Verification resets when specifications
          change.
        </p>
        <div className="ws-form-grid">
          {kind === "projector" && (
            <label>
              Manufacturer
              <input
                value={draft.brand}
                maxLength={120}
                onChange={(e) => patch({ brand: e.target.value })}
              />
            </label>
          )}
          <label>
            {kind === "projector" ? "Projector model" : "Lens name / part number"}
            <input
              autoFocus
              required
              value={draft.model}
              maxLength={120}
              onChange={(e) => patch({ model: e.target.value })}
            />
          </label>
          <label>
            Lens mount family
            <input
              required
              value={draft.mount}
              maxLength={120}
              placeholder="Exact compatible mount / series"
              onChange={(e) => patch({ mount: e.target.value })}
            />
          </label>
          {kind === "projector" ? (
            <>
              <NumberField
                label="Native pixel width"
                value={draft.nativeWidth}
                optional
                whole
                min={1}
                max={32768}
                onChange={(n) => patch({ nativeWidth: n })}
              />
              <NumberField
                label="Native pixel height"
                value={draft.nativeHeight}
                optional
                whole
                min={1}
                max={32768}
                onChange={(n) => patch({ nativeHeight: n })}
              />
              <NumberField
                label="Rated light output (lumens)"
                value={draft.lumens}
                optional
                max={1000000}
                onChange={(n) => patch({ lumens: n })}
              />
              <label className="ws-checkbox wide">
                <input
                  type="checkbox"
                  checked={draft.lensIncluded}
                  onChange={(e) => patch({ lensIncluded: e.target.checked })}
                />
                Lens included in projector price
              </label>
            </>
          ) : (
            <>
              <NumberField
                label="Wide throw ratio"
                value={draft.throwRatioMin}
                optional
                max={100}
                onChange={(n) => patch({ throwRatioMin: n })}
              />
              <NumberField
                label="Tele throw ratio"
                value={draft.throwRatioMax}
                optional
                max={100}
                onChange={(n) => patch({ throwRatioMax: n })}
              />
              <NumberField
                label="Horizontal shift limit (% image width)"
                value={draft.hShiftPct}
                optional
                min={0}
                max={500}
                onChange={(n) => patch({ hShiftPct: n })}
              />
              <NumberField
                label="Vertical shift limit (% image height)"
                value={draft.vShiftPct}
                optional
                min={0}
                max={500}
                onChange={(n) => patch({ vShiftPct: n })}
              />
              <p className="ws-led-help wide">
                Enter maximum absolute shift in this convention. These independent limits do not
                model coupled shift envelopes or brand-specific percentage conventions.
              </p>
            </>
          )}
          <label className="wide">
            Specification source / operating mode
            <textarea
              value={draft.source}
              maxLength={1000}
              onChange={(e) => patch({ source: e.target.value })}
            />
          </label>
          <label className="ws-checkbox wide">
            <input
              type="checkbox"
              disabled={!draft.source.trim()}
              checked={draft.verified}
              onChange={(e) => setDraft({ ...draft, verified: e.target.checked })}
            />
            I checked these specifications against the source.
          </label>
        </div>
        <div className="ws-actions">
          <button className="ws-button" type="button" onClick={close}>
            Cancel
          </button>
          <button className="ws-button primary" type="submit">
            Save {kind} profile
          </button>
        </div>
      </form>
    </div>
  );
}
