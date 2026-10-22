/** One line of a line-level diff. */
export interface DiffLine {
  kind: "same" | "add" | "del";
  text: string;
}

/**
 * Line diff from `before` to `after` via longest-common-subsequence. O(n·m) in
 * lines — fine for prompt-sized skill bodies, and avoids a diff dependency.
 * Deletions are emitted before additions at each change point.
 */
export function computeLineDiff(before: string, after: string): DiffLine[] {
  const a = before.split("\n");
  const b = after.split("\n");
  const n = a.length;
  const m = b.length;

  // lcs[i][j] = LCS length of a[i..] and b[j..].
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i]![j] = a[i] === b[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: "same", text: a[i]! });
      i++;
      j++;
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: "del", text: a[i]! });
      i++;
    } else {
      out.push({ kind: "add", text: b[j]! });
      j++;
    }
  }
  while (i < n) out.push({ kind: "del", text: a[i++]! });
  while (j < m) out.push({ kind: "add", text: b[j++]! });
  return out;
}

/** True when the diff has at least one added or removed line. */
export function hasChanges(diff: DiffLine[]): boolean {
  return diff.some((l) => l.kind !== "same");
}

/** Gutter marker for a diff line. */
export function diffMarker(kind: DiffLine["kind"]): string {
  return kind === "add" ? "+" : kind === "del" ? "-" : " ";
}

/** First non-empty body line, stripped of markdown heading marks — a version's one-line label. */
export function versionLabel(body: string): string {
  const line = body.split("\n").find((l) => l.trim().length > 0) ?? "";
  return line.replace(/^#+\s*/, "").trim() || "—";
}

/** ISO timestamp → `YYYY-MM-DD HH:mm` (local time), as in the design's version list. */
export function formatVersionDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
