import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

/**
 * F1 — settings data-access layer. The ONLY place that touches the `settings`
 * table (non-secret key/value prefs). Scoped by `workspaceId` (tenancy guard).
 */

export type SettingRow = typeof t.settings.$inferSelect;

export class SettingsRepository {
  constructor(private db: Db) {}

  async listByWorkspace(workspaceId: string): Promise<SettingRow[]> {
    return this.db.select().from(t.settings).where(eq(t.settings.workspaceId, workspaceId));
  }

  /** Upsert one pref row (unique workspace_id + user_id + key). */
  async upsert(
    workspaceId: string,
    userId: string,
    key: string,
    value: typeof t.settings.$inferInsert.value,
  ): Promise<void> {
    await this.db
      .insert(t.settings)
      .values({ workspaceId, userId, key, value })
      .onConflictDoUpdate({
        target: [t.settings.workspaceId, t.settings.userId, t.settings.key],
        set: { value },
      });
  }
}
