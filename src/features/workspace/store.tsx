import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { blankProject, exampleState, stateSchema } from "./model";
import type { Project, WorkspaceState } from "./model";
const KEY = "soblabs-design-sandbox-v1";
type Store = {
  state: WorkspaceState;
  setState: (s: WorkspaceState) => void;
  project: Project;
  selectProject: (id: string) => void;
  updateProject: (p: Project) => void;
  mode: "sandbox" | "account";
  status: string;
  undo: () => void;
  canUndo: boolean;
};
const Context = createContext<Store | null>(null);
export function WorkspaceProvider({
  children,
  mode = "sandbox",
}: {
  children: ReactNode;
  mode?: "sandbox" | "account";
}) {
  const [state, setRaw] = useState<WorkspaceState | null>(null);
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("Loading…");
  const [error, setError] = useState("");
  const [history, setHistory] = useState<WorkspaceState[]>([]);
  const version = useRef(0);
  const owner = useRef("");
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        let initial: WorkspaceState;
        if (mode === "sandbox") {
          const saved = localStorage.getItem(KEY);
          initial = saved ? stateSchema.parse(JSON.parse(saved)) : exampleState();
        } else {
          const client = supabase as unknown as SupabaseClient;
          const { data: user, error: authError } = await client.auth.getUser();
          if (authError || !user.user) throw new Error("Sign in before loading your workspace.");
          owner.current = user.user.id;
          const { data, error } = await client
            .from("business_workspaces")
            .select("state,revision")
            .eq("owner_id", owner.current)
            .maybeSingle();
          if (error) throw error;
          initial = data
            ? stateSchema.parse(data.state)
            : { version: 1, projects: [blankProject()], contacts: [] };
          version.current = data?.revision ?? 0;
        }
        if (alive) {
          setRaw(initial);
          setSelected(initial.projects[0]!.id);
          setStatus(mode === "sandbox" ? "Saved in this browser" : "Account workspace loaded");
        }
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Unable to load workspace.");
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [mode]);
  function persist(next: WorkspaceState) {
    stateSchema.parse(next);
    if (error) throw new Error(error);
    if (state) setHistory((h) => [...h.slice(-29), state]);
    setRaw(next);
    setStatus("Saving…");
    queue.current = queue.current.then(async () => {
      try {
        if (mode === "sandbox") {
          localStorage.setItem(KEY, JSON.stringify(next));
          setStatus("Saved in this browser");
        } else {
          const client = supabase as unknown as SupabaseClient;
          const { data, error } = await client.rpc("save_business_workspace", {
            new_state: next,
            expected_revision: version.current,
          });
          if (error) throw error;
          version.current = Number(data);
          setStatus("Saved to account");
        }
      } catch (e) {
        setStatus("Save failed — export a backup");
        setError(e instanceof Error ? e.message : "Save failed");
      }
    });
  }
  if (!state)
    return (
      <div className="ws-loading">
        <h1>{error ? "Workspace unavailable" : "Opening your workspace…"}</h1>
        {error && (
          <>
            <p>{error}</p>
            <a href="/auth">Return to sign in</a>
            <p>The original data has been preserved. No workspace was overwritten.</p>
          </>
        )}
      </div>
    );
  const project = state.projects.find((p) => p.id === selected) ?? state.projects[0]!;
  return (
    <Context.Provider
      value={{
        state,
        setState: persist,
        project,
        selectProject: setSelected,
        updateProject: (p) =>
          persist({ ...state, projects: state.projects.map((x) => (x.id === p.id ? p : x)) }),
        mode,
        status,
        undo: () => {
          const previous = history.at(-1);
          if (previous) {
            persist(previous);
            setHistory((h) => h.slice(0, -2));
          }
        },
        canUndo: history.length > 0,
      }}
    >
      {error && (
        <div className="ws-save-error" role="alert">
          {error}. Changes are in memory; export a backup before leaving. Reload to reconnect.
        </div>
      )}
      {children}
    </Context.Provider>
  );
}
// Provider and hook intentionally share the same context module.
// eslint-disable-next-line react-refresh/only-export-components
export function useWorkspace() {
  const c = useContext(Context);
  if (!c) throw new Error("WorkspaceProvider missing");
  return c;
}
