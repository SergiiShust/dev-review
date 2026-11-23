/* SkillsRail — the Skill Editor's left column: skill list + "Add Skill". */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, Icon } from "@devdigest/ui";
import { useSkills, useUpdateSkill } from "@/lib/hooks/skills";
import { SkillCard } from "@/app/skills/_components/SkillCard";
import { CreateSkillModal } from "@/app/skills/_components/CreateSkillModal";
import { filterSkills } from "@/lib/skills";
import { s } from "./styles";

export function SkillsRail({ activeId, tab }: { activeId: string; tab: string }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const { data: skills } = useSkills();
  const update = useUpdateSkill();
  const [creating, setCreating] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const list = filterSkills(skills ?? [], search);

  return (
    <div style={s.rail}>
      {creating && <CreateSkillModal onClose={() => setCreating(false)} />}
      <div style={s.top}>
        <div style={s.titleRow}>
          <h1 style={s.h1}>{t("page.heading")}</h1>
          <Button kind="primary" size="sm" icon="Plus" onClick={() => setCreating(true)}>
            {t("page.addSkill")}
          </Button>
        </div>
        <div style={s.search}>
          <Icon.Search size={13} style={s.searchIcon} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("page.searchPlaceholder")}
            style={s.searchInput}
          />
        </div>
      </div>
      <div style={s.list}>
        {list.map((sk) => (
          <SkillCard
            key={sk.id}
            skill={sk}
            active={sk.id === activeId}
            onClick={() => router.push(`/skills/${sk.id}?tab=${tab}`)}
            onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
            onDeleted={sk.id === activeId ? () => router.push("/skills") : undefined}
          />
        ))}
      </div>
    </div>
  );
}
