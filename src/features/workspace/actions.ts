import type { Task } from "./model";
export function extractActions(text: string): Pick<Task, "title" | "owner" | "due">[] {
  const section = text.split(/Action Items/i)[1];
  if (!section) return [];
  const actions: Pick<Task, "title" | "owner" | "due">[] = [];
  let owner = "";
  let current: Pick<Task, "title" | "owner" | "due"> | null = null;
  for (const raw of section.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("@")) {
      owner = line.slice(1).trim();
      current = null;
    } else if (/^\[\s*\]/.test(line)) {
      current = {
        title: line
          .replace(/^\[\s*\]\s*/, "")
          .replace(/\s*-?\s*\[TBD\]/gi, "")
          .trim(),
        owner,
        due: "",
      };
      actions.push(current);
    } else if (current) {
      current.title += " " + line.replace(/\s*-?\s*\[TBD\]/gi, "").trim();
    }
  }
  return actions.filter((a) => a.title.length > 0);
}
