const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return usd.format(value);
}

const listedOn = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

/** Renders an ISO-8601 listing date as "Sep 8, 2026". */
export function formatDate(value: string): string {
  const date = new Date(value);
  // Guard against an unparseable date from a malformed feed row.
  return Number.isNaN(date.getTime()) ? value : listedOn.format(date);
}
