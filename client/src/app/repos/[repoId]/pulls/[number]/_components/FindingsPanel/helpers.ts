import type { FindingRecord } from "@devdigest/shared";
import type { Severity } from "@devdigest/ui";
import { LOW_CONFIDENCE_THRESHOLD, SEVERITY_ORDER } from "./constants";

export type SeverityCounts = Partial<Record<Severity, number>>;

/** Optionally drop low-confidence findings and sort by severity. */
export function visibleFindings(findings: FindingRecord[], hideLow: boolean): FindingRecord[] {
  let shown = findings;
  if (hideLow) shown = shown.filter((f) => f.confidence >= LOW_CONFIDENCE_THRESHOLD);
  return [...shown].sort(
    (a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9),
  );
}

/** Count findings per severity level. */
export function countBySeverity(findings: FindingRecord[]): SeverityCounts {
  const counts: SeverityCounts = {};
  for (const f of findings) {
    const sev = f.severity as Severity;
    counts[sev] = (counts[sev] ?? 0) + 1;
  }
  return counts;
}

/** Filter findings to only those matching active severities. Empty set = no filter (show all). */
export function filterBySeverity(findings: FindingRecord[], active: Set<Severity>): FindingRecord[] {
  if (active.size === 0) return findings;
  return findings.filter((f) => active.has(f.severity as Severity));
}
