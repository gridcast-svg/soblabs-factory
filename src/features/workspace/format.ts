export const formatMoney = (n: number, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency, maximumFractionDigits: 2 }).format(
    n,
  );
