import type { IconName } from "@devdigest/ui";

/** Editor tab descriptor. `labelKey` resolves under the `skills` namespace. */
export interface EditorTab {
  key: string;
  labelKey: string;
  icon: IconName;
}

/** Skill Editor tabs. Evals/Stats from the design are out of scope for now. */
export const TABS: readonly EditorTab[] = [
  { key: "config", labelKey: "editor.tabs.config", icon: "Settings" },
  { key: "preview", labelKey: "editor.tabs.preview", icon: "Eye" },
  { key: "versions", labelKey: "editor.tabs.versions", icon: "History" },
];

export const TAB_KEYS = TABS.map((tb) => tb.key);
export const DEFAULT_TAB = "config";

/** Rough chars-per-token ratio for the body's token estimate (English prose/markdown). */
export const CHARS_PER_TOKEN = 4;
