import { createFileRoute } from "@tanstack/react-router";
import { HardwareCatalogue } from "@/components/HardwareCatalogue";

export const Route = createFileRoute("/_authenticated/catalogue/receivers")({
  head: () => ({
    meta: [
      { title: "Receiver Card Catalogue — Soblabs LED Configurator" },
      { name: "description", content: "Editable receiver card catalogue with capacity, cost and approved processors." },
      { property: "og:title", content: "Receiver Card Catalogue — Soblabs" },
      { property: "og:description", content: "Receiver cards and the processors they are approved with." },
    ],
  }),
  component: () => (
    <HardwareCatalogue table="receiver_cards" title="Receiver Card Catalogue" withProcessorLinks />
  ),
});
