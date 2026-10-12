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

/** Single-line full address, e.g. "123 Main St, Springfield, VA 22150". */
export function formatFullAddress(parts: {
  address: string;
  city: string;
  state: string;
  zip: string;
}): string {
  return `${parts.address}, ${parts.city}, ${parts.state} ${parts.zip}`;
}
