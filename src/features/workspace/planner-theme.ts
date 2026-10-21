import { useEffect, useState } from "react";
export function usePlannerTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    try {
      if (localStorage.getItem("soblabs-planner-theme") === "dark") setTheme("dark");
    } catch {
      /* Paper fallback. */
    }
  }, []);
  function toggleTheme() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    try {
      localStorage.setItem("soblabs-planner-theme", next);
    } catch {
      /* In-memory preference. */
    }
  }
  return { theme, toggleTheme };
}
