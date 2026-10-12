const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatPrice(value: number): string {
  return usd.format(value);
}

/** Relevance score, shown to 3 dp so near-ties remain distinguishable. */
export function formatScore(value: number): string {
  return value.toFixed(3);
}
