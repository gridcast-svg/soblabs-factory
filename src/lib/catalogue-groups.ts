import type { Hardware, LedProduct } from "./types";

const compareLabels = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });

export type ProductLineGroup = {
  name: string;
  products: LedProduct[];
};

export type ManufacturerProductGroup = {
  name: string;
  productLines: ProductLineGroup[];
};

export function groupLedProducts(products: LedProduct[]): ManufacturerProductGroup[] {
  const manufacturers = new Map<string, Map<string, LedProduct[]>>();

  for (const product of products) {
    const manufacturer = product.manufacturers?.name?.trim() || "Unassigned manufacturer";
    const productLine = product.series?.trim() || "Other products";
    const productLines = manufacturers.get(manufacturer) ?? new Map<string, LedProduct[]>();
    const lineProducts = productLines.get(productLine) ?? [];
    lineProducts.push(product);
    productLines.set(productLine, lineProducts);
    manufacturers.set(manufacturer, productLines);
  }

  return [...manufacturers.entries()]
    .sort(([a], [b]) => compareLabels(a, b))
    .map(([name, productLines]) => ({
      name,
      productLines: [...productLines.entries()]
        .sort(([a], [b]) => compareLabels(a, b))
        .map(([lineName, lineProducts]) => ({
          name: lineName,
          products: [...lineProducts].sort((a, b) => compareLabels(a.model, b.model)),
        })),
    }));
}

export type ManufacturerHardwareGroup = {
  name: string;
  items: Hardware[];
};

export function groupHardware(items: Hardware[]): ManufacturerHardwareGroup[] {
  const manufacturers = new Map<string, Hardware[]>();

  for (const item of items) {
    const manufacturer = item.manufacturer_name?.trim() || "Unassigned manufacturer";
    const manufacturerItems = manufacturers.get(manufacturer) ?? [];
    manufacturerItems.push(item);
    manufacturers.set(manufacturer, manufacturerItems);
  }

  return [...manufacturers.entries()]
    .sort(([a], [b]) => compareLabels(a, b))
    .map(([name, manufacturerItems]) => ({
      name,
      items: [...manufacturerItems].sort((a, b) => compareLabels(a.model, b.model)),
    }));
}
