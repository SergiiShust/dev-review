import type { ConventionCandidate } from "@devdigest/shared";
import { CONFIDENCE_HIGH, CONFIDENCE_MEDIUM } from "./constants";

/** Bar color for a 0..1 confidence: green ≥ high, amber ≥ medium, else red. */
export function confidenceColor(confidence: number): string {
  if (confidence >= CONFIDENCE_HIGH) return "var(--ok)";
  if (confidence >= CONFIDENCE_MEDIUM) return "var(--warn)";
  return "var(--crit)";
}

/** `path:start-end` (or `path:line`, or just `path` when lines are unknown). */
export function evidenceRef(
  c: Pick<ConventionCandidate, "evidence_path" | "evidence_line_start" | "evidence_line_end">,
): string {
  const { evidence_path: p, evidence_line_start: a, evidence_line_end: b } = c;
  if (a == null) return p;
  return b != null && b !== a ? `${p}:${a}-${b}` : `${p}:${a}`;
}
