/* SeverityCounters — per-severity finding counts for one review run.
   Each counter is a toggle: click filters the run's list to that level,
   clicking the active level again clears the filter. Pure client state —
   counts come from the findings already loaded for the run. */
"use client";

import { useTranslations } from "next-intl";
import { SEV } from "@devdigest/ui";
import { COUNTED_SEVERITIES, type CountedSeverity } from "../../constants";
import { s } from "./styles";

export function SeverityCounters({
  counts,
  active,
  onToggle,
}: {
  counts: Record<CountedSeverity, number>;
  active: CountedSeverity | null;
  onToggle: (sev: CountedSeverity) => void;
}) {
  const t = useTranslations("prReview");
  return (
    <div style={s.row}>
      {COUNTED_SEVERITIES.map((sev) => (
        <button
          key={sev}
          type="button"
          aria-pressed={active === sev}
          onClick={() => onToggle(sev)}
          style={{
            ...s.pill,
            color: SEV[sev].c,
            borderColor: SEV[sev].c,
            background: active === sev ? SEV[sev].bg : "transparent",
            opacity: active && active !== sev ? 0.35 : 1,
          }}
        >
          {t("panel.severityCount", {
            count: counts[sev],
            label: t(`panel.severity.${sev}`),
          })}
        </button>
      ))}
    </div>
  );
}
