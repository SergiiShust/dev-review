/** Adaptive-precision USD cost (e.g. "$1.23", "$0.014", "$0.0013"). */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return "—";
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(3)}`;
  return `$${usd.toFixed(4)}`;
}
