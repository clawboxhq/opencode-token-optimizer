import type { Config } from "@opencode-ai/plugin";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

/** Compute the path to oh-my-openagent.json at runtime (test-friendly via HOME). */
function omoConfigPath(): string {
  return join(
    process.env.HOME || process.env.USERPROFILE || "/Users/vinceyap",
    ".config",
    "opencode",
    "oh-my-openagent.json",
  );
}

/**
 * Patterns that indicate a task is trivial and should be routed to `quick`.
 * Each pattern is checked as a case-insensitive substring match against the
 * task prompt.
 */
export const QUICK_ROUTING_PATTERNS: readonly string[] = [
  "fix typo",
  "rename",
  "update comment",
  "bump version",
];

/**
 * Maximum prompt character length for automatic quick routing.
 * Tasks with prompts shorter than this threshold are routed to `quick`.
 */
export const QUICK_MAX_PROMPT_CHARS = 100;

/**
 * Config hook that injects quick-category routing hints into the in-memory
 * Config object.  Reads oh-my-openagent.json to verify the `quick` category
 * exists, then attaches routing rules to `experimental.category_routing`.
 *
 * The hook is a no-op (safe) when:
 * - oh-my-openagent.json is missing or unreadable
 * - The `quick` category is not defined in oh-my-openagent.json
 *
 * @param input - The in-memory Config object (mutated in-place).
 */
export async function categoryRoutingHook(input: Config): Promise<void> {
  // 1. Read oh-my-openagent.json to validate the category structure
  const configPath = omoConfigPath();
  let omoCategories: Record<string, unknown> = {};
  try {
    if (existsSync(configPath)) {
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      omoCategories = (parsed.categories as Record<string, unknown>) ?? {};
      console.warn(
        `[token-optimizer] Loaded ${Object.keys(omoCategories).length} categories from oh-my-openagent.json`,
      );
    }
  } catch (error) {
    console.warn(
      `[token-optimizer] Could not read oh-my-openagent.json:`,
      error,
    );
  }

  // 2. Bail if the `quick` category isn't defined
  if (!omoCategories.quick) {
    console.warn(
      `[token-optimizer] 'quick' category not found — skipping routing injection`,
    );
    return;
  }

  // 3. Ensure the experimental section exists
  const configAny = input as Record<string, unknown>;
  if (
    !configAny.experimental ||
    typeof configAny.experimental !== "object"
  ) {
    configAny.experimental = {};
  }

  // 4. Attach routing rules to experimental.category_routing
  const experimental = configAny.experimental as Record<string, unknown>;
  experimental.category_routing = {
    quick: {
      maxPromptChars: QUICK_MAX_PROMPT_CHARS,
      patterns: [...QUICK_ROUTING_PATTERNS],
    },
  };

  console.warn(
    `[token-optimizer] Injected quick routing rules (maxPromptChars=${QUICK_MAX_PROMPT_CHARS}, ${QUICK_ROUTING_PATTERNS.length} patterns)`,
  );
}

/**
 * Determines whether a task prompt should be routed to the `quick` category
 * based on the configured criteria.
 *
 * Routing is triggered when:
 * 1. The prompt is shorter than `QUICK_MAX_PROMPT_CHARS` characters, OR
 * 2. The prompt (case-insensitive) contains one of the `QUICK_ROUTING_PATTERNS`
 *
 * @param prompt - The full task prompt text.
 * @returns `true` if the task qualifies for quick routing.
 */
export function shouldRouteToQuick(prompt: string): boolean {
  // Short prompts → quick
  if (prompt.length < QUICK_MAX_PROMPT_CHARS) {
    return true;
  }

  // Pattern-matched prompts → quick
  const lower = prompt.toLowerCase();
  return QUICK_ROUTING_PATTERNS.some((p) => lower.includes(p));
}
