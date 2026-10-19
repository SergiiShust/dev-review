import type { Container } from '../../platform/container.js';
import type {
  Settings,
  SettingsUpdate,
  ConnTestProvider,
  ConnTestResult,
  SecretsStatus,
} from '@devdigest/shared';
import { SettingsRepository } from './repository.js';
import { GITHUB_PROVIDER, SECRET_KEY_BY_PROVIDER } from './constants.js';
import { rowsToSettings } from './helpers.js';

/**
 * F1 — settings service. Business logic for the Settings feature:
 *   - read / upsert non-secret workspace prefs
 *   - report which provider keys are configured (booleans only)
 *   - test a provider connection (OpenAI/Anthropic/OpenRouter/GitHub)
 *
 * No HTTP and no raw SQL live here — persistence goes through SettingsRepository,
 * pure transforms through helpers.ts. Secrets and provider clients are resolved
 * through the container's ports; secret VALUES are never returned.
 */
export class SettingsService {
  private settings: SettingsRepository;

  constructor(private container: Container) {
    this.settings = new SettingsRepository(container.db);
  }

  /** Current non-secret prefs for the workspace. */
  async get(workspaceId: string): Promise<Settings> {
    return rowsToSettings(await this.settings.listByWorkspace(workspaceId));
  }

  /** Upsert prefs (one row per key), then return the merged result. */
  async update(workspaceId: string, userId: string, body: SettingsUpdate): Promise<Settings> {
    for (const [key, value] of Object.entries(body)) {
      await this.settings.upsert(workspaceId, userId, key, value);
    }
    return rowsToSettings(await this.settings.listByWorkspace(workspaceId));
  }

  /**
   * Which provider keys are configured — booleans only, the values are NEVER
   * returned. Drives the "Configured / Not set" badges in the API Keys panel.
   */
  async secretsStatus(): Promise<SecretsStatus> {
    const entries = await Promise.all(
      (Object.entries(SECRET_KEY_BY_PROVIDER) as [keyof SecretsStatus, string][]).map(
        async ([provider, key]) => [provider, Boolean(await this.container.secrets.get(key))] as const,
      ),
    );
    return Object.fromEntries(entries) as SecretsStatus;
  }

  /**
   * Test a provider key with a cheap live call. When the UI supplies a key,
   * persist it (BYO key) first so the test reflects — and the rest of the app
   * can use — the new value. Never throws: failures come back as `ok: false`.
   */
  async testConnection(input: { provider: ConnTestProvider; key?: string }): Promise<ConnTestResult> {
    const { provider, key } = input;
    try {
      if (key) {
        if (!this.container.secrets.set) {
          return { provider, ok: false, message: 'Secrets backend is read-only' };
        }
        await this.container.secrets.set(SECRET_KEY_BY_PROVIDER[provider], key);
        this.container.invalidateSecretCaches();
      }
      if (provider === GITHUB_PROVIDER) {
        const gh = await this.container.github();
        const login = await gh.currentLogin();
        return { provider, ok: true, message: `Connected as @${login}` };
      }
      const llm = await this.container.llm(provider);
      const models = await llm.listModels();
      return { provider, ok: true, message: `OK — ${models.length} models available` };
    } catch (err) {
      return { provider, ok: false, message: (err as Error).message };
    }
  }
}
