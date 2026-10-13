/* FindingsPanel — severity pills + hide-low-confidence + j/k navigation + FindingCard list,
   wiring the accept/dismiss action hook (A2). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Toggle, EmptyState, SeverityBadge } from "@devdigest/ui";
import type { Severity } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { useFindingAction } from "../../../../../../../lib/hooks/reviews";
import { KEY_TO_ACTION, SEVERITY_ORDER } from "./constants";
import { visibleFindings, countBySeverity, filterBySeverity } from "./helpers";
import { s } from "./styles";

const SEV_KEYS = Object.keys(SEVERITY_ORDER) as Severity[];

export function FindingsPanel({
  findings,
  prId,
  repoFullName,
  headSha,
}: {
  findings: FindingRecord[];
  prId: string;
  repoFullName?: string | null;
  headSha?: string | null;
}) {
  const t = useTranslations("prReview");
  const action = useFindingAction();
  const [hideLow, setHideLow] = React.useState(false);
  const [focusIdx, setFocusIdx] = React.useState(0);
  const [activeSev, setActiveSev] = React.useState<Set<Severity>>(new Set());

  // Reset severity filter when hideLow changes to avoid 0-result stale state.
  React.useEffect(() => {
    setActiveSev(new Set());
  }, [hideLow]);

  const postHideLow = React.useMemo(() => visibleFindings(findings, hideLow), [findings, hideLow]);
  const counts = React.useMemo(() => countBySeverity(postHideLow), [postHideLow]);
  const shown = React.useMemo(() => filterBySeverity(postHideLow, activeSev), [postHideLow, activeSev]);

  const toggleSev = React.useCallback((sev: Severity) => {
    setActiveSev((prev) => {
      const next = new Set(prev);
      if (next.has(sev)) next.delete(sev);
      else next.add(sev);
      return next;
    });
  }, []);

  // j/k navigation + a/d shortcuts on the focused finding (keyboard).
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "j") setFocusIdx((i) => Math.min(i + 1, shown.length - 1));
      else if (e.key === "k") setFocusIdx((i) => Math.max(i - 1, 0));
      else if (KEY_TO_ACTION[e.key] && shown[focusIdx]) {
        action.mutate({ findingId: shown[focusIdx]!.id, action: KEY_TO_ACTION[e.key]!, prId });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shown, focusIdx, action, prId]);

  return (
    <div>
      <div style={s.toolbar}>
        <div style={s.pillGroup}>
          {SEV_KEYS.map((sev) => {
            const n = counts[sev];
            if (!n) return null;
            return (
              <div
                key={sev}
                role="button"
                tabIndex={0}
                style={s.pill(activeSev.has(sev))}
                onClick={() => toggleSev(sev)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSev(sev); }}
                data-testid={`severity-pill-${sev}`}
              >
                <SeverityBadge severity={sev} count={n} />
              </div>
            );
          })}
        </div>
        <div style={s.toggleGroup}>
          {t("panel.hideLowConfidence")}
          <Toggle on={hideLow} onChange={setHideLow} size={16} />
        </div>
      </div>

      <div style={s.list}>
        {shown.length === 0 ? (
          <EmptyState icon="Filter" title={t("panel.noMatchTitle")} body={t("panel.noMatchBody")} />
        ) : (
          shown.map((f, i) => (
            <FindingCard
              key={f.id}
              f={f}
              focused={i === focusIdx}
              defaultExpanded={i === 0}
              pending={action.isPending}
              repoFullName={repoFullName}
              headSha={headSha}
              onAction={(act) => action.mutate({ findingId: f.id, action: act, prId })}
            />
          ))
        )}
      </div>
    </div>
  );
}
