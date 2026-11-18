"use client";

import React from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import type { ConventionStatus } from "@devdigest/shared";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import {
  useBulkUpdateConventions,
  useConventions,
  useExtractConventions,
  useUpdateConvention,
} from "@/lib/hooks/conventions";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { ApiError } from "@/lib/api";
import { ConventionCard, type ConventionEdit } from "./_components/ConventionCard";
import { CreateConventionSkillModal } from "./_components/CreateConventionSkillModal";
import { NOT_CLONED_CODE, NOT_INDEXED_CODE, SKELETON_CARDS } from "./constants";
import { s } from "./styles";

/**
 * Skills Lab → Conventions for one repo: run/re-run extraction, curate the
 * grounded candidates (accept / reject / edit), and merge the accepted ones
 * into a skill via the create modal.
 */
export function ConventionsView({ repoId }: { repoId: string }) {
  const t = useTranslations("conventions");
  const format = useFormatter();
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const list = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const bulk = useBulkUpdateConventions(repoId);
  const [creating, setCreating] = React.useState(false);

  const repoName = activeRepo?.name ?? t("page.repoFallback");
  const crumb = [
    { label: t("page.crumbLab"), href: "/skills" },
    { label: t("page.crumbConventions") },
  ];

  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  const scan = list.data?.scan ?? null;
  const candidates = list.data?.candidates ?? [];
  const accepted = candidates.filter((c) => c.status === "accepted");
  const runExtraction = () => extract.mutate();

  const extractError =
    extract.error instanceof ApiError
      ? extract.error.code === NOT_INDEXED_CODE
        ? t("page.notIndexed")
        : extract.error.code === NOT_CLONED_CODE
          ? t("page.notCloned")
          : extract.error.message
      : extract.error?.message;

  const setStatus = (id: string, status: ConventionStatus) => update.mutate({ id, patch: { status } });
  const edit = (id: string, patch: ConventionEdit) => update.mutate({ id, patch });

  return (
    <AppShell crumb={crumb}>
      <div style={s.wrap}>
        <header style={s.header}>
          <div style={s.headerText}>
            <h1 style={s.title}>
              {t("page.headingPrefix")}
              <span className="mono" style={s.titleRepo}>
                {repoName}
              </span>
            </h1>
            <p style={s.subtitle}>
              {scan
                ? t("page.scanMeta", {
                    count: scan.sample_count,
                    ago: format.relativeTime(new Date(scan.created_at)),
                  })
                : t("page.subtitle")}
            </p>
            {scan && scan.dropped_count > 0 && (
              <p style={s.dropped}>{t("page.droppedMeta", { count: scan.dropped_count })}</p>
            )}
          </div>
          {scan && (
            <Button icon="RefreshCw" onClick={runExtraction} loading={extract.isPending}>
              {extract.isPending ? t("page.scanning") : t("page.rescan")}
            </Button>
          )}
        </header>

        {extract.isError && (
          <ErrorState title={t("page.extractionFailed")} body={extractError} onRetry={runExtraction} />
        )}

        {list.isLoading ? (
          <div style={s.loadingStack}>
            {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
              <Skeleton key={i} height={150} />
            ))}
          </div>
        ) : list.isError ? (
          <ErrorState
            title={t("page.loadError")}
            body={list.error instanceof ApiError ? list.error.message : undefined}
            onRetry={() => list.refetch()}
          />
        ) : candidates.length === 0 ? (
          <EmptyState
            icon="ListChecks"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={extract.isPending ? t("page.scanning") : t("page.empty.cta")}
            onCta={runExtraction}
            ctaLoading={extract.isPending}
          />
        ) : (
          <>
            <div style={s.toolbar}>
              <Button
                kind="secondary"
                size="sm"
                icon="X"
                disabled={accepted.length === 0 || bulk.isPending}
                onClick={() => bulk.mutate({ ids: accepted.map((c) => c.id), status: "pending" })}
              >
                {t("page.deselectAll")}
              </Button>
              <span style={s.acceptedCount}>
                {t("page.acceptedCount", { accepted: accepted.length, total: candidates.length })}
              </span>
              <div style={s.toolbarRight}>
                <Button
                  kind="primary"
                  icon="Sparkles"
                  disabled={accepted.length === 0}
                  onClick={() => setCreating(true)}
                >
                  {t("page.createSkill")}
                </Button>
              </div>
            </div>
            {candidates.map((c) => (
              <ConventionCard
                key={c.id}
                convention={c}
                onStatus={(status) => setStatus(c.id, status)}
                onEdit={(patch) => edit(c.id, patch)}
                busy={extract.isPending}
              />
            ))}
          </>
        )}
      </div>

      {creating && (
        <CreateConventionSkillModal repoId={repoId} repoName={repoName} onClose={() => setCreating(false)} />
      )}
    </AppShell>
  );
}
