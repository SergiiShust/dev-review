/* SkillCard — name, type badge, source, enabled toggle and linked-agent count.
   Used by the /skills grid and the Skill Editor's left rail. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill } from "@/lib/hooks/skills";
import { skillTypeColors } from "@/lib/skills";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
  onDeleted,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
  onDeleted?: () => void;
}) {
  const t = useTranslations("skills");
  const del = useDeleteSkill();
  const typeColors = skillTypeColors(skill.type);

  const remove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(t("detail.deleteConfirm", { name: skill.name }))) {
      del.mutate(skill.id, { onSuccess: () => onDeleted?.() });
    }
  };

  return (
    <div onClick={onClick} style={s.card(!!active, skill.enabled)}>
      <div style={s.headerRow}>
        <div style={s.iconBox(typeColors.color, typeColors.bg)}>
          <Icon.Sparkles size={14} />
        </div>
        <span className="mono" style={s.name}>
          {skill.name}
        </span>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
        <button
          onClick={remove}
          disabled={del.isPending}
          title={t("detail.delete")}
          aria-label={t("detail.delete")}
          style={s.deleteBtn(del.isPending)}
        >
          <Icon.Trash size={14} />
        </button>
      </div>
      <div style={s.description}>{skill.description || t("card.noDescription")}</div>
      <div style={s.metaRow}>
        <Badge color={typeColors.color} bg={typeColors.bg}>
          {t(`type.${skill.type}`)}
        </Badge>
        <span style={s.source}>{t(`source.${skill.source}`)}</span>
        <span className="mono" style={s.version}>
          v{skill.version}
        </span>
      </div>
      {skill.agent_count != null && (
        <div style={s.footer}>{t("card.agentCount", { count: skill.agent_count })}</div>
      )}
    </div>
  );
}
