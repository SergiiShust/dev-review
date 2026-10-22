"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill, SkillVersion } from "@devdigest/shared";
import { useRestoreSkillVersion, useSkillVersions } from "@/lib/hooks/skills";
import { useToast } from "@/lib/toast";
import { computeLineDiff, diffMarker, formatVersionDate, hasChanges, versionLabel } from "./helpers";
import { s } from "./styles";

/** Versions tab — body snapshots (newest first) with a diff against the current body and Restore. */
export function VersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const { data: versions, isLoading, isError, refetch } = useSkillVersions(skill.id);
  const [openDiff, setOpenDiff] = React.useState<number | null>(null);

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("versions.title")}</h2>
        {versions && <Badge color="var(--text-secondary)">{t("versions.count", { count: versions.length })}</Badge>}
      </div>
      <p style={s.subtitle}>{t("versions.subtitle")}</p>

      {isLoading && (
        <div style={s.list}>
          <Skeleton height={64} />
          <Skeleton height={64} />
        </div>
      )}
      {isError && <ErrorState body={t("versions.loadError")} onRetry={() => refetch()} />}
      {versions && versions.length === 0 && <p style={s.empty}>{t("versions.empty")}</p>}
      {versions && versions.length > 0 && (
        <div style={s.list}>
          {versions.map((v) => (
            <VersionRow
              key={v.version}
              v={v}
              skill={skill}
              diffOpen={openDiff === v.version}
              onToggleDiff={() => setOpenDiff((cur) => (cur === v.version ? null : v.version))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function VersionRow({
  v,
  skill,
  diffOpen,
  onToggleDiff,
}: {
  v: SkillVersion;
  skill: Skill;
  diffOpen: boolean;
  onToggleDiff: () => void;
}) {
  const t = useTranslations("skills");
  const toast = useToast();
  const restore = useRestoreSkillVersion();
  const isCurrent = v.version === skill.version;

  const onRestore = () => {
    if (!window.confirm(t("versions.restoreConfirm", { version: v.version }))) return;
    restore.mutate(
      { id: skill.id, version: v.version },
      { onSuccess: (data) => toast.success(t("versions.restoredToast", { from: v.version, version: data.version })) },
    );
  };

  return (
    <div style={s.row(isCurrent)}>
      <div style={s.rowHead}>
        <span className="mono" style={s.versionChip(isCurrent)}>
          v{v.version}
        </span>
        <div style={s.rowText}>
          <span style={s.firstLine}>{versionLabel(v.body)}</span>
          <span style={s.date}>{formatVersionDate(v.created_at)}</span>
        </div>
        {isCurrent ? (
          <Badge color="var(--ok)" dot>
            {t("versions.current")}
          </Badge>
        ) : (
          <div style={s.actions}>
            <Button kind="secondary" size="sm" icon="Eye" onClick={onToggleDiff} active={diffOpen}>
              {diffOpen ? t("versions.hideDiff") : t("versions.diff")}
            </Button>
            <Button kind="secondary" size="sm" icon="History" onClick={onRestore} disabled={restore.isPending}>
              {t("versions.restore")}
            </Button>
          </div>
        )}
      </div>
      {diffOpen && !isCurrent && <DiffView before={v.body} after={skill.body} version={v.version} />}
    </div>
  );
}

function DiffView({ before, after, version }: { before: string; after: string; version: number }) {
  const t = useTranslations("skills");
  const diff = React.useMemo(() => computeLineDiff(before, after), [before, after]);
  return (
    <div style={s.diffWrap}>
      <div style={s.diffCaption}>{t("versions.diffAgainst", { version })}</div>
      {hasChanges(diff) ? (
        <pre className="mono" style={s.diffPre} data-testid="skill-diff">
          {diff.map((line, i) => (
            <div key={i} style={s.diffLine(line.kind)}>
              <span style={s.diffMarker}>{diffMarker(line.kind)}</span>
              {line.text || " "}
            </div>
          ))}
        </pre>
      ) : (
        <p style={s.empty}>{t("versions.noChanges")}</p>
      )}
    </div>
  );
}
