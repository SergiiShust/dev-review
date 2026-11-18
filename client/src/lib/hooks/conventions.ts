/* hooks/conventions.ts — React Query hooks for the Conventions Extractor:
     GET   /repos/:id/conventions              → { scan, candidates }
     POST  /repos/:id/conventions/extract      → run a scan (sync), returns the list
     PATCH /conventions/:id                    → accept / reject / edit one
     PATCH /repos/:id/conventions              → bulk status (Deselect all)
     GET   /repos/:id/conventions/skill-draft  → accepted merged into a skill draft
     POST  /repos/:id/conventions/skill        → save the edited draft as a skill */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type {
  ConventionCandidate,
  ConventionSkillDraft,
  ConventionsList,
  ConventionStatus,
  Skill,
  SkillType,
} from "@devdigest/shared";

const listKey = (repoId: string | null | undefined) => ["conventions", repoId] as const;
const draftKey = (repoId: string | null | undefined) => ["convention-skill-draft", repoId] as const;

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: listKey(repoId),
    queryFn: () => api.get<ConventionsList>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

export function useExtractConventions(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConventionsList>(`/repos/${repoId}/conventions/extract`),
    onSuccess: (data) => {
      qc.setQueryData(listKey(repoId), data);
      qc.invalidateQueries({ queryKey: draftKey(repoId) });
    },
  });
}

/** Replace candidates (by id) inside the cached list. */
function patchCached(
  prev: ConventionsList | undefined,
  updated: ConventionCandidate[],
): ConventionsList | undefined {
  if (!prev) return prev;
  const byId = new Map(updated.map((c) => [c.id, c]));
  return { ...prev, candidates: prev.candidates.map((c) => byId.get(c.id) ?? c) };
}

export interface UpdateConventionInput {
  id: string;
  patch: { status?: ConventionStatus; rule?: string; category?: string };
}

/** Accept / reject / edit one candidate. Optimistic — the card flips instantly, rolls back on error. */
export function useUpdateConvention(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateConventionInput) =>
      api.patch<ConventionCandidate>(`/conventions/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: listKey(repoId) });
      const prev = qc.getQueryData<ConventionsList>(listKey(repoId));
      const current = prev?.candidates.find((c) => c.id === id);
      if (current) qc.setQueryData(listKey(repoId), patchCached(prev, [{ ...current, ...patch }]));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(listKey(repoId), ctx.prev);
    },
    onSuccess: (row) => {
      qc.setQueryData<ConventionsList>(listKey(repoId), (prev) => patchCached(prev, [row]));
      qc.invalidateQueries({ queryKey: draftKey(repoId) });
    },
  });
}

export function useBulkUpdateConventions(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { ids: string[]; status: ConventionStatus }) =>
      api.patch<ConventionCandidate[]>(`/repos/${repoId}/conventions`, input),
    onSuccess: (rows) => {
      qc.setQueryData<ConventionsList>(listKey(repoId), (prev) => patchCached(prev, rows));
      qc.invalidateQueries({ queryKey: draftKey(repoId) });
    },
  });
}

/** The accepted candidates merged into a skill draft — fetched when the create modal opens. */
export function useConventionSkillDraft(repoId: string | null | undefined, enabled: boolean) {
  return useQuery({
    queryKey: draftKey(repoId),
    queryFn: () => api.get<ConventionSkillDraft>(`/repos/${repoId}/conventions/skill-draft`),
    enabled: !!repoId && enabled,
    // The modal seeds its local draft from this once; never refetch underneath the user.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export interface CreateConventionSkillInput {
  name: string;
  description: string;
  type: SkillType;
  enabled: boolean;
  body: string;
}

export function useCreateConventionSkill(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConventionSkillInput) =>
      api.post<Skill>(`/repos/${repoId}/conventions/skill`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}
