/* SkillEditor — header + Config / Preview / Versions tabs for one skill. Owns
   the draft so switching tabs keeps unsaved edits and Preview renders them. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Icon, Tabs } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useUpdateSkill } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { skillTypeColors } from "@/lib/skills";
import { ConfigTab } from "./_components/ConfigTab";
import { PreviewTab } from "./_components/PreviewTab";
import { VersionsTab } from "./_components/VersionsTab";
import { TABS } from "./constants";
import { draftFromSkill, isDraftDirty, rebaseDraft, type SkillDraft } from "./helpers";
import { s } from "./styles";

export function SkillEditor({ skill, tab, onTab }: { skill: Skill; tab: string; onTab: (t: string) => void }) {
  const t = useTranslations("skills");
  const toast = useToast();
  const update = useUpdateSkill();
  const [draft, setDraft] = React.useState<SkillDraft>(() => draftFromSkill(skill));
  const savedRef = React.useRef<{ id: string; version: number; saved: SkillDraft }>({
    id: skill.id,
    version: skill.version,
    saved: draftFromSkill(skill),
  });

  // Keep the draft in step with the saved skill. A different skill or a new
  // version (body save / restore) resets it; any other server-side change (e.g.
  // the rail's enabled toggle) is merged into the fields the user hasn't edited.
  React.useEffect(() => {
    const prev = savedRef.current;
    const next = draftFromSkill(skill);
    savedRef.current = { id: skill.id, version: skill.version, saved: next };
    if (prev.id !== skill.id || prev.version !== skill.version) setDraft(next);
    else setDraft((d) => rebaseDraft(d, prev.saved, next));
  }, [skill]);

  const dirty = isDraftDirty(draft, skill);
  const onChange = (patch: Partial<SkillDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = () =>
    update.mutate(
      { id: skill.id, patch: { ...draft, name: draft.name.trim() } },
      {
        // Failures surface via the global mutation error toast. The save sent the
        // whole draft, so adopt the server's normalised result (e.g. trimmed name).
        onSuccess: (data) => {
          setDraft(draftFromSkill(data));
          toast.success(t("config.savedToast", { version: data.version }));
        },
      },
    );

  const typeColors = skillTypeColors(skill.type);
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.iconBox(typeColors.color, typeColors.bg)}>
          <Icon.Sparkles size={16} />
        </div>
        <h1 className="mono" style={s.h1}>
          {skill.name}
        </h1>
        <Badge color={typeColors.color} bg={typeColors.bg}>
          {t(`type.${skill.type}`)}
        </Badge>
        <Badge color="var(--text-secondary)" icon="GitCommit" mono>
          v{skill.version}
        </Badge>
        {!skill.enabled && <Badge color="var(--text-muted)">{t("detail.disabled")}</Badge>}
      </div>
      <div style={s.tabsBar}>
        <Tabs tabs={tabs} value={tab} onChange={onTab} pad="0 24px" />
      </div>
      <div style={s.body}>
        {tab === "preview" ? (
          <PreviewTab body={draft.body} />
        ) : tab === "versions" ? (
          <VersionsTab skill={skill} />
        ) : (
          <ConfigTab
            draft={draft}
            onChange={onChange}
            onSave={save}
            saving={update.isPending}
            dirty={dirty}
            version={skill.version}
          />
        )}
      </div>
    </div>
  );
}
