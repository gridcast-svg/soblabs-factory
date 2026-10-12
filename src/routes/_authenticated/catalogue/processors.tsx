import { createFileRoute } from "@tanstack/react-router";
import { HardwareCatalogue } from "@/components/HardwareCatalogue";

export const Route = createFileRoute("/_authenticated/catalogue/processors")({
  head: () => ({
    meta: [
      { title: "Processor Catalogue — Soblabs LED Configurator" },
      { name: "description", content: "Editable video processor catalogue with capacity and cost data." },
      { property: "og:title", content: "Processor Catalogue — Soblabs" },
      { property: "og:description", content: "NovaStar, Colorlight and proprietary processing hardware." },
    ],
  }),
  component: () => <HardwareCatalogue table="processors" title="Processor Catalogue" />,
});
