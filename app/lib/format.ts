const cents = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" });
const whole = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

/** A price: always to the cent. */
export function euro(amount: number): string {
  return cents.format(Object.is(amount, -0) ? 0 : amount);
}

/** A total: whole euros once it is large enough for cents not to matter. */
export function euroTotal(amount: number): string {
  return Math.abs(amount) >= 100 ? whole.format(Math.round(amount)) : euro(amount);
}

export function percent(share: number): string {
  return `${Math.round(share * 100)}%`;
}

/** "+30%", "-15%" or "no change" for a multiplier such as 1.3. */
export function shift(multiplier: number): string {
  const change = Math.round((multiplier - 1) * 100);
  if (change === 0) return "no change";
  return `${change > 0 ? "+" : "−"}${Math.abs(change)}%`;
}

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}
