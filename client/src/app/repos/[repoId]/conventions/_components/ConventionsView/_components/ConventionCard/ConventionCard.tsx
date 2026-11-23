"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, FormField, Icon, ProgressBar, TextInput } from "@devdigest/ui";
import type { ConventionCandidate, ConventionStatus } from "@devdigest/shared";
import { COPIED_RESET_MS } from "./constants";
import { confidenceColor, evidenceRef } from "./helpers";
import { s } from "./styles";

export interface ConventionEdit {
  rule: string;
  category: string;
}

/**
 * One extracted convention: rule, code evidence (path:lines + real snippet),
 * confidence bar, and Accept / Reject toggles. Clicking the active toggle again
 * returns the candidate to pending. Edit switches rule + category into inputs.
 */
export function ConventionCard({
  convention,
  onStatus,
  onEdit,
  busy = false,
}: {
  convention: ConventionCandidate;
  onStatus: (status: ConventionStatus) => void;
  onEdit: (edit: ConventionEdit) => void;
  busy?: boolean;
}) {
  const t = useTranslations("conventions");
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState<ConventionEdit>({
    rule: convention.rule,
    category: convention.category,
  });
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(id);
  }, [copied]);

  const { status } = convention;
  const ref = evidenceRef(convention);
  const pct = Math.round(convention.confidence * 100);
  const canSave = draft.rule.trim().length > 0 && draft.category.trim().length > 0;

  const startEdit = () => {
    setDraft({ rule: convention.rule, category: convention.category });
    setEditing(true);
  };
  const save = () => {
    if (!canSave) return;
    onEdit({ rule: draft.rule.trim(), category: draft.category.trim() });
    setEditing(false);
  };
  const copy = () => {
    void navigator.clipboard?.writeText(ref).then(
      () => setCopied(true),
      () => undefined,
    );
  };

  return (
    <article style={s.card(status)} aria-label={convention.rule} data-status={status}>
      <div style={s.main}>
        {editing ? (
          <div style={s.editFields}>
            <FormField label={t("card.rule")} required>
              <TextInput value={draft.rule} onChange={(rule) => setDraft((d) => ({ ...d, rule }))} />
            </FormField>
            <FormField label={t("card.category")} required>
              <TextInput
                value={draft.category}
                onChange={(category) => setDraft((d) => ({ ...d, category }))}
                mono
              />
            </FormField>
            <div style={s.editActions}>
              <Button kind="primary" size="sm" icon="Check" onClick={save} disabled={!canSave || busy}>
                {t("card.save")}
              </Button>
              <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>
                {t("card.cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div style={s.titleRow}>
            <h3 style={s.rule}>{convention.rule}</h3>
            <Badge mono style={s.category}>
              {convention.category}
            </Badge>
          </div>
        )}

        <div style={s.evidence}>
          <div style={s.evidenceHeader}>
            <span className="mono" style={s.evidencePath} title={ref}>
              {ref}
            </span>
            <button type="button" style={s.copyBtn} onClick={copy} aria-label={t("card.copy")}>
              {copied ? <Icon.Check size={13} /> : <Icon.Copy size={13} />}
              {copied && t("card.copied")}
            </button>
          </div>
          <pre className="mono" style={s.snippet}>
            {convention.evidence_snippet}
          </pre>
        </div>

        <div style={s.confidenceRow}>
          <span style={s.confidenceLabel}>{t("card.confidence")}</span>
          <div style={s.confidenceBar}>
            <ProgressBar value={pct} color={confidenceColor(convention.confidence)} />
          </div>
          <span className="mono" style={s.confidenceValue}>
            {pct}%
          </span>
        </div>
      </div>

      <div style={s.actions}>
        <Button
          kind={status === "accepted" ? "primary" : "secondary"}
          icon="Check"
          full
          aria-pressed={status === "accepted"}
          disabled={busy}
          onClick={() => onStatus(status === "accepted" ? "pending" : "accepted")}
        >
          {status === "accepted" ? t("card.accepted") : t("card.accept")}
        </Button>
        <Button
          kind={status === "rejected" ? "danger" : "ghost"}
          icon="X"
          full
          aria-pressed={status === "rejected"}
          disabled={busy}
          onClick={() => onStatus(status === "rejected" ? "pending" : "rejected")}
        >
          {status === "rejected" ? t("card.rejected") : t("card.reject")}
        </Button>
        {!editing && (
          <Button kind="ghost" icon="Edit" full disabled={busy} onClick={startEdit}>
            {t("card.edit")}
          </Button>
        )}
      </div>
    </article>
  );
}
