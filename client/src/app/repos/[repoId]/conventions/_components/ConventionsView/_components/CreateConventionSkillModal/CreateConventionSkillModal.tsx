"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  ErrorState,
  FormField,
  Icon,
  Modal,
  SelectInput,
  Skeleton,
  Textarea,
  TextInput,
  Toggle,
} from "@devdigest/ui";
import type { ConventionSkillDraft, SkillType } from "@devdigest/shared";
import { useConventionSkillDraft, useCreateConventionSkill } from "@/lib/hooks/conventions";
import { SKILL_BODY_MAX_CHARS, SKILL_TYPES, estimateTokens, type SkillDraft } from "@/lib/skills";
import { useToast } from "@/lib/toast";
import { BODY_ROWS, MODAL_WIDTH } from "./constants";
import { s } from "./styles";

/**
 * "Create skill from conventions" — fetches the server-merged draft of the
 * accepted conventions, lets the user edit every field (name, description,
 * type, enabled, markdown body), then saves it as a new `extracted` skill.
 * The skill is NOT linked to an agent here — that happens on the Agents page.
 */
export function CreateConventionSkillModal({
  repoId,
  repoName,
  onClose,
}: {
  repoId: string;
  repoName: string;
  onClose: () => void;
}) {
  const t = useTranslations("conventions");
  const draft = useConventionSkillDraft(repoId, true);

  if (draft.isLoading || draft.isError || !draft.data) {
    return (
      <Modal width={MODAL_WIDTH} title={t("modal.title")} onClose={onClose}>
        <div style={s.state}>
          {draft.isError ? (
            <ErrorState title={t("modal.loadError")} body={draft.error?.message} onRetry={() => draft.refetch()} />
          ) : (
            <>
              <p style={s.enabledHint}>{t("modal.loading")}</p>
              <Skeleton height={220} />
            </>
          )}
        </div>
      </Modal>
    );
  }
  // Seed the form once from the merged draft; the user owns it from here on.
  return <SkillForm repoId={repoId} repoName={repoName} initial={draft.data} onClose={onClose} />;
}

function SkillForm({
  repoId,
  repoName,
  initial,
  onClose,
}: {
  repoId: string;
  repoName: string;
  initial: ConventionSkillDraft;
  onClose: () => void;
}) {
  const t = useTranslations("conventions");
  const tSkills = useTranslations("skills");
  const router = useRouter();
  const toast = useToast();
  const create = useCreateConventionSkill(repoId);
  const [form, setForm] = React.useState<SkillDraft>({
    name: initial.name,
    description: initial.description,
    type: initial.type,
    enabled: initial.enabled,
    body: initial.body,
  });
  const set = (patch: Partial<SkillDraft>) => setForm((f) => ({ ...f, ...patch }));

  const nameMissing = form.name.trim().length === 0;
  const bodyMissing = form.body.trim().length === 0;
  const bodyTooLong = form.body.length > SKILL_BODY_MAX_CHARS;
  const canSubmit = !nameMissing && !bodyMissing && !bodyTooLong && !create.isPending;
  const typeOptions = SKILL_TYPES.map((v) => ({ value: v, label: tSkills(`type.${v}`) }));

  // mutate (not mutateAsync): a failed create surfaces via the global mutation
  // error toast and leaves the modal open with the user's edits intact.
  const submit = () => {
    if (!canSubmit) return;
    create.mutate(
      { ...form, name: form.name.trim() },
      {
        onSuccess: (skill) => {
          toast.success(t("modal.created", { name: skill.name }));
          onClose();
          router.push(`/skills/${skill.id}`);
        },
      },
    );
  };

  const bodyHint = bodyTooLong
    ? t("modal.bodyTooLong", { count: form.body.length, max: SKILL_BODY_MAX_CHARS })
    : bodyMissing
      ? t("modal.bodyRequired")
      : undefined;

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("modal.title")}
      subtitle={<span className="mono">{form.name.trim() || initial.name}</span>}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <span style={s.footerNote}>
            <Icon.GitCommit size={13} />
            {t("modal.footerNote")}
          </span>
          <Button kind="ghost" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button kind="primary" icon="Sparkles" onClick={submit} disabled={!canSubmit}>
            {create.isPending ? t("modal.creating") : t("modal.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        <div style={s.banner} role="note">
          <span style={s.bannerIcon}>
            <Icon.Wrench size={15} />
          </span>
          <span>
            {t.rich("modal.banner", {
              count: initial.accepted_count,
              repo: repoName,
              b: (chunks) => <strong>{chunks}</strong>,
              code: (chunks) => (
                <span className="mono" style={s.bannerRepo}>
                  {chunks}
                </span>
              ),
            })}
          </span>
        </div>

        <FormField label={t("modal.name")} required hint={nameMissing ? t("modal.nameRequired") : undefined}>
          <TextInput value={form.name} onChange={(name) => set({ name })} mono />
        </FormField>
        <FormField label={t("modal.description")}>
          <TextInput value={form.description} onChange={(description) => set({ description })} />
        </FormField>
        <div style={s.row}>
          <FormField label={t("modal.type")}>
            <SelectInput value={form.type} onChange={(v) => set({ type: v as SkillType })} options={typeOptions} />
          </FormField>
          <FormField label={t("modal.enabled")}>
            <div style={s.enabledRow}>
              <Toggle on={form.enabled} onChange={(enabled) => set({ enabled })} />
              <span style={s.enabledHint}>{t("modal.enabledHint")}</span>
            </div>
          </FormField>
        </div>
        <FormField
          label={t("modal.body")}
          required
          hint={bodyHint}
          right={
            <span style={s.bodyMeta}>
              <Icon.FileText size={12} />
              <span className="mono">{form.name.trim() || "skill"}.md</span>
              <Badge color="var(--text-muted)">{t("modal.unsaved")}</Badge>
              <span className="mono" style={s.tokens}>
                {t("modal.tokens", { count: estimateTokens(form.body) })}
              </span>
            </span>
          }
        >
          <Textarea value={form.body} onChange={(body) => set({ body })} rows={BODY_ROWS} mono />
        </FormField>
      </div>
    </Modal>
  );
}
