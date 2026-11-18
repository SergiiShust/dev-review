import { and, desc, eq, inArray, ne } from 'drizzle-orm';
import type { ConventionStatus } from '@devdigest/shared';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import type { ConventionRow, ConventionScanRow } from '../../../db/rows.js';

/**
 * Conventions data-access. Owns `conventions` and `convention_scans`; reads
 * `repos` only to resolve the workspace-scoped repo a scan targets.
 * Workspace-scoped throughout.
 */

export type RepoRow = typeof t.repos.$inferSelect;

export interface NewScan {
  sampleCount: number;
  candidateCount: number;
  droppedCount: number;
  model: string;
  costUsd: number | null;
}

export interface NewConvention {
  category: string;
  rule: string;
  evidencePath: string;
  evidenceLineStart: number;
  evidenceLineEnd: number;
  evidenceSnippet: string;
  confidence: number;
}

export interface ConventionPatch {
  status?: ConventionStatus;
  rule?: string;
  category?: string;
}

export class ConventionsRepository {
  constructor(private db: Db) {}

  async findRepo(workspaceId: string, repoId: string): Promise<RepoRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.repos)
      .where(and(eq(t.repos.workspaceId, workspaceId), eq(t.repos.id, repoId)));
    return row;
  }

  async latestScan(workspaceId: string, repoId: string): Promise<ConventionScanRow | undefined> {
    const [row] = await this.db
      .select()
      .from(t.conventionScans)
      .where(
        and(eq(t.conventionScans.workspaceId, workspaceId), eq(t.conventionScans.repoId, repoId)),
      )
      .orderBy(desc(t.conventionScans.createdAt))
      .limit(1);
    return row;
  }

  async list(workspaceId: string, repoId: string, status?: ConventionStatus): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          ...(status ? [eq(t.conventions.status, status)] : []),
        ),
      );
  }

  /** Rules already decided (accepted/rejected) — a re-scan must not resurrect them as pending. */
  async listDecided(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          ne(t.conventions.status, 'pending'),
        ),
      );
  }

  /**
   * Persist one scan atomically: record the scan, drop the repo's previous
   * PENDING candidates (accepted/rejected survive), insert the new ones.
   */
  async saveScan(
    workspaceId: string,
    repoId: string,
    scan: NewScan,
    candidates: NewConvention[],
  ): Promise<ConventionScanRow> {
    return this.db.transaction(async (tx) => {
      const [scanRow] = await tx
        .insert(t.conventionScans)
        .values({ workspaceId, repoId, ...scan })
        .returning();
      await tx
        .delete(t.conventions)
        .where(
          and(
            eq(t.conventions.workspaceId, workspaceId),
            eq(t.conventions.repoId, repoId),
            eq(t.conventions.status, 'pending'),
          ),
        );
      if (candidates.length > 0) {
        await tx.insert(t.conventions).values(
          candidates.map((c) => ({
            workspaceId,
            repoId,
            scanId: scanRow!.id,
            status: 'pending' as const,
            ...c,
          })),
        );
      }
      return scanRow!;
    });
  }

  async update(
    workspaceId: string,
    id: string,
    patch: ConventionPatch,
  ): Promise<ConventionRow | undefined> {
    const changes = {
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
      ...(patch.category !== undefined ? { category: patch.category } : {}),
    };
    // Drizzle rejects an empty SET — an empty patch is a read.
    if (Object.keys(changes).length === 0) {
      const [row] = await this.db
        .select()
        .from(t.conventions)
        .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)));
      return row;
    }
    const [row] = await this.db
      .update(t.conventions)
      .set({ ...changes, updatedAt: new Date() })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }

  /** Set `status` on many candidates of one repo; ids outside the repo/workspace are ignored. */
  async bulkUpdateStatus(
    workspaceId: string,
    repoId: string,
    ids: string[],
    status: ConventionStatus,
  ): Promise<ConventionRow[]> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return [];
    return this.db
      .update(t.conventions)
      .set({ status, updatedAt: new Date() })
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          inArray(t.conventions.id, unique),
        ),
      )
      .returning();
  }
}
