export type Rec = Record<string, unknown>;

/** Splits an editor record into its id and a write payload, dropping server-managed fields. */
export function splitRecord(rec: Rec, drop: string[] = []) {
  const payload: Rec = { ...rec };
  for (const key of ["created_at", "updated_at", ...drop]) delete payload[key];
  const id = payload["id"] as string | undefined;
  delete payload["id"];
  return { id, payload };
}

/** Copy of a record prepared for duplication (no id, no server-managed fields). */
export function duplicateRecord(rec: Rec, drop: string[] = []): Rec {
  const { payload } = splitRecord(rec, drop);
  payload["model"] = `${String(rec["model"] ?? "")} (copy)`;
  return payload;
}
