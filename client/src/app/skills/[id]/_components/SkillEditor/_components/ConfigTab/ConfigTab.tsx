"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, Icon, SelectInput, Textarea, TextInput, Toggle } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { SKILL_TYPES } from "@/lib/skills";
import { estimateTokens, type SkillDraft } from "../../helpers";
import { BODY_ROWS } from "./constants";
import { s } from "./styles";

/** Config tab — name / description / type / markdown body + enabled toggle. */
export function ConfigTab({
  draft,
  onChange,
  onSave,
  saving,
  dirty,
  version,
}: {
  draft: SkillDraft;
  onChange: (patch: Partial<SkillDraft>) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  version: number;
}) {
  const t = useTranslations("skills");
  const nameMissing = draft.name.trim().length === 0;
  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: t(`type.${v}`) }));

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("config.title")}</h2>
        <Badge color="var(--text-secondary)" icon="GitCommit" mono>
          v{version}
        </Badge>
        <label style={s.enabledLabel}>
          {t("config.enabled")}
          <Toggle on={draft.enabled} onChange={(enabled) => onChange({ enabled })} size={16} />
        </label>
      </div>
      <FormField label={t("config.name")} required hint={nameMissing ? t("config.nameRequired") : undefined}>
        <TextInput value={draft.name} onChange={(name) => onChange({ name })} mono />
      </FormField>
      <FormField label={t("config.description")}>
        <TextInput value={draft.description} onChange={(description) => onChange({ description })} />
      </FormField>
      <FormField label={t("config.type")}>
        <SelectInput
          value={draft.type}
          onChange={(v) => onChange({ type: v as SkillType })}
          options={typeOptions}
        />
      </FormField>
      <FormField
        label={t("config.body")}
        required
        hint={t("config.bodyHint")}
        right={
          <span style={s.bodyMeta}>
            <Icon.FileText size={12} />
            <span className="mono">{draft.name.trim() || "skill"}.md</span>
            {dirty && <Badge color="var(--warn)">{t("editor.unsaved")}</Badge>}
            <span style={s.tokens}>{t("editor.tokens", { count: estimateTokens(draft.body) })}</span>
          </span>
        }
      >
        <Textarea
          value={draft.body}
          onChange={(body) => onChange({ body })}
          placeholder={t("config.bodyPlaceholder")}
          rows={BODY_ROWS}
          mono
        />
      </FormField>
      <div style={s.actions}>
        <Button kind="primary" icon="Check" onClick={onSave} disabled={saving || !dirty || nameMissing}>
          {saving ? t("config.saving") : t("config.save")}
        </Button>
      </div>
    </div>
  );
}
