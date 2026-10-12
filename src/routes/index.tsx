import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/features/workspace/Workspace";
export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [{ title: "Soblabs Factory · Business workspace" }] }),
  component: () => <Workspace />,
});
