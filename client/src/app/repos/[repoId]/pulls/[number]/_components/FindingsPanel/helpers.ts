import type { FindingRecord } from "@devdigest/shared";
import {
  COUNTED_SEVERITIES,
  LOW_CONFIDENCE_THRESHOLD,
  SEVERITY_ORDER,
  type CountedSeverity,
} from "./constants";

/** Optionally drop low-confidence findings, filter by severity, and sort by severity. */
export function visibleFindings(
  findings: FindingRecord[],
  hideLow: boolean,
  severityFilter?: string | null,
): FindingRecord[] {
  let shown = findings;
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  if (severityFilter) shown = shown.filter((f) => f.severity === severityFilter);
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

/** Count findings per counted severity level; levels with no findings are 0. */
export function countBySeverity(findings: FindingRecord[]): Record<CountedSeverity, number> {
  const counts = Object.fromEntries(COUNTED_SEVERITIES.map((sev) => [sev, 0])) as Record<
    CountedSeverity,
    number
  >;
  for (const f of findings) {
    if (f.severity in counts) counts[f.severity as CountedSeverity] += 1;
  }
  return counts;
}
