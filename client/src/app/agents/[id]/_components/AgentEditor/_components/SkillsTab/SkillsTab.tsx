"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Checkbox, EmptyState, ErrorState, Icon, IconBtn, Skeleton } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentSkills, useSetAgentSkills } from "@/lib/hooks/agents";
import { useSkills } from "@/lib/hooks/skills";
import { filterSkills, skillTypeColors } from "@/lib/skills";
import { buildRows, moveSkill, toggleSkill, type SkillRowView } from "./helpers";
import { s } from "./styles";

/**
 * Skills tab — attach workspace skills to this agent and order them. Order is
 * prompt order: earlier skills appear earlier in the assembled review prompt.
 * Every change POSTs the full ordered id list.
 */
export function SkillsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const skillsQ = useSkills();
  const linksQ = useAgentSkills(agent.id);
  const setSkills = useSetAgentSkills();
  const [filter, setFilter] = React.useState("");

  if (skillsQ.isLoading || linksQ.isLoading) {
    return (
      <div style={s.list}>
        <Skeleton height={48} />
        <Skeleton height={48} />
        <Skeleton height={48} />
      </div>
    );
  }
  if (skillsQ.isError || linksQ.isError) {
    return (
      <ErrorState
        body={t("skills.loadError")}
        onRetry={() => {
          skillsQ.refetch();
          linksQ.refetch();
        }}
      />
    );
  }

  const all = skillsQ.data ?? [];
  const linkedIds = (linksQ.data ?? []).map((l) => l.id);
  const rows = buildRows(all, linkedIds).filter((r) => filterSkills([r.skill], filter).length > 0);
  const busy = setSkills.isPending;
  const apply = (next: string[]) => {
    if (!busy) setSkills.mutate({ agentId: agent.id, skillIds: next });
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <Badge color="var(--accent-text)" bg="var(--accent-bg)">
          {t("skills.enabledCount", { linked: linkedIds.length, total: all.length })}
        </Badge>
        <div style={s.filter}>
          <Icon.Search size={13} style={s.filterIcon} />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("skills.filterPlaceholder")}
            style={s.filterInput}
          />
        </div>
      </div>
      <p style={s.hint}>{t("skills.orderHint")}</p>

      {all.length === 0 ? (
        <EmptyState icon="Sparkles" title={t("skills.title")} body={t("skills.empty")} />
      ) : rows.length === 0 ? (
        <p style={s.hint}>{t("skills.noMatch")}</p>
      ) : (
        <div style={s.list}>
          {rows.map((row) => (
            <SkillLinkRow
              key={row.skill.id}
              row={row}
              linkedCount={linkedIds.length}
              busy={busy}
              onToggle={() => apply(toggleSkill(linkedIds, row.skill.id))}
              onMove={(dir) => apply(moveSkill(linkedIds, row.skill.id, dir))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SkillLinkRow({
  row,
  linkedCount,
  busy,
  onToggle,
  onMove,
}: {
  row: SkillRowView;
  linkedCount: number;
  busy: boolean;
  onToggle: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const t = useTranslations("agents");
  const { skill, linked, position } = row;
  const colors = skillTypeColors(skill.type);
  const canUp = linked && position > 0;
  const canDown = linked && position < linkedCount - 1;

  return (
    <div style={s.row(linked, busy)} data-testid={`skill-row-${skill.name}`}>
      <div style={s.arrows}>
        {canUp ? (
          <IconBtn icon="ArrowUp" label={t("skills.moveUp")} size={22} onClick={() => onMove("up")} />
        ) : (
          <span style={s.arrowSpacer} />
        )}
        {canDown ? (
          <IconBtn icon="ArrowDown" label={t("skills.moveDown")} size={22} onClick={() => onMove("down")} />
        ) : (
          <span style={s.arrowSpacer} />
        )}
      </div>
      <Checkbox checked={linked} onChange={onToggle} />
      <span className="mono" style={s.name}>
        {skill.name}
      </span>
      {!skill.enabled && (
        <span title={t("skills.disabledHint")}>
          <Badge color="var(--text-muted)">{t("skills.disabledBadge")}</Badge>
        </span>
      )}
      <Badge color={colors.color} bg={colors.bg} style={s.typeBadge}>
        {skill.type}
      </Badge>
    </div>
  );
}
