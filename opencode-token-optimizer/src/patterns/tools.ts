/**
 * Tool registrations for the opencode-token-optimizer plugin.
 *
 * - T9: validate_task_scope (single-concern delegation validator) — stub
 * - T10: track_task + check_duplicate (anti-duplication guard) ✓
 * - T11: classify_complexity (complexity classifier) — stub
 */

import type { PluginConfig } from "../config.js";
import { classifyComplexity as classifyComplexityImpl } from "./complexity.js";

// ---------------------------------------------------------------------------
// Tool argument types
// ---------------------------------------------------------------------------

export interface ValidateTaskScopeArgs {
  prompt: string;
  maxConcerns?: number;
}

export interface ValidateTaskScopeResult {
  valid: boolean;
  concerns: string[];
  suggestion: string;
}

export interface TrackTaskArgs {
  taskId: string;
  description: string;
}

export interface TrackTaskResult {
  duplicate: boolean;
  existingTask?: string;
}

export interface CheckDuplicateArgs {
  query: string;
}

export interface CheckDuplicateResult {
  isDuplicate: boolean;
  matchedTask?: string;
}

export interface ClassifyComplexityArgs {
  prompt: string;
}

// ---------------------------------------------------------------------------
// Tool schemas (for @opencode-ai/plugin tool() registration)
// ---------------------------------------------------------------------------

/** Schema for validate_task_scope tool. */
export function validateTaskScopeSchema() {
  return {
    description:
      "Validate that a task prompt focuses on ONE concern (not multiple)",
    args: {
      prompt: {
        type: "string",
        description: "The task prompt to validate",
      },
      maxConcerns: {
        type: "number",
        default: 1,
        description: "Maximum number of concerns to allow",
      },
    },
  };
}

/** Schema for track_task tool. */
export function trackTaskSchema() {
  return {
    description: "Register a task to prevent duplicate delegation",
    args: {
      taskId: {
        type: "string",
        description: "Unique identifier for this task",
      },
      description: {
        type: "string",
        description: "What this task will do",
      },
    },
  };
}

/** Schema for check_duplicate tool. */
export function checkDuplicateSchema() {
  return {
    description: "Check if work has already been delegated",
    args: {
      query: {
        type: "string",
        description: "Description of work about to do",
      },
    },
  };
}

/** Schema for classify_complexity tool. */
export function classifyComplexitySchema() {
  return {
    description:
      "Classify a task prompt as 'simple', 'medium', or 'complex' based on heuristics",
    args: {
      prompt: {
        type: "string",
        description: "The task prompt to classify",
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Session-scoped state for anti-duplication (in-memory Map)
// ---------------------------------------------------------------------------

const taskRegistry = new Map<string, { description: string }>();

// ---------------------------------------------------------------------------
// Concern-detection heuristics (keyword-based, no ML/NLP)
// ---------------------------------------------------------------------------

/**
 * Delimiter keywords that indicate a new concern/task is being introduced.
 * - `AND` and `ALSO` match only in all-caps form (emphatic connectors)
 * - Lowercase adverbs match common multi-concern phrasing
 */
const CONCERN_DELIMITER =
  /\b(?:AND|ALSO)\b|\b(?:additionally|Additionally|meanwhile|Meanwhile|separately|Separately)\b/g;

/**
 * Pattern to detect file-path-like references (path/to/file.ext).
 */
const FILE_PATH_PATTERN = /(?:[^\s()]+\/)?[^\s()]+\.[a-zA-Z]{1,5}\b/g;

/**
 * Extract distinct concern labels from a prompt by splitting on delimiter
 * keywords and summarizing each segment.
 */
function extractConcerns(prompt: string): string[] {
  const segments = prompt
    .split(CONCERN_DELIMITER)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // A single segment means no delimiter matched → single concern
  if (segments.length <= 1) return [];

  return segments.map(summarizeConcern);
}

/**
 * Produce a short human-readable label for a concern segment.
 * Prioritises: file paths → function references → first phrase.
 */
function summarizeConcern(text: string): string {
  const paths = text.match(FILE_PATH_PATTERN);
  if (paths && paths.length > 0) return paths.join(", ");

  const funcs = text.match(/\b[a-zA-Z_]\w+(?=\s*\()/g);
  if (funcs && funcs.length > 0) return funcs.slice(0, 3).join(", ");

  const cleaned = text.replace(/[,;.].*$/, "").trim();
  return cleaned.length > 60 ? cleaned.substring(0, 57) + "..." : cleaned;
}

// ---------------------------------------------------------------------------
// Tool executors
// ---------------------------------------------------------------------------

/**
 * Validate that a task prompt focuses on a single concern.
 *
 * Uses keyword-based heuristics (no ML/NLP) to split the prompt on
 * task-indicating keywords, then counts the resulting concern segments.
 *
 * @returns  { valid: true }  if concerns ≤ maxConcerns, or
 *           { valid: false, concerns[], suggestion }  if too many concerns.
 */
export function validateTaskScope(
  args: ValidateTaskScopeArgs,
  _config: PluginConfig,
): ValidateTaskScopeResult {
  try {
    const { prompt, maxConcerns = 1 } = args;

    // Empty / whitespace-only prompts are always valid
    if (!prompt || prompt.trim().length === 0) {
      return { valid: true, concerns: [], suggestion: "" };
    }

    const concerns = extractConcerns(prompt);

    if (concerns.length > maxConcerns) {
      return {
        valid: false,
        concerns,
        suggestion: `Split into ${concerns.length} separate tasks. Each task should focus on one concern.`,
      };
    }

    return { valid: true, concerns: [], suggestion: "" };
  } catch (error) {
    console.warn(`[token-optimizer] validateTaskScope failed:`, error);
    // On error, allow the task through rather than blocking
    return { valid: true, concerns: [], suggestion: "" };
  }
}

/** Stub — full implementation in T10. */
export function trackTask(args: TrackTaskArgs): TrackTaskResult {
  if (taskRegistry.has(args.taskId)) {
    const existing = taskRegistry.get(args.taskId)!;
    return { duplicate: true, existingTask: existing.description };
  }
  taskRegistry.set(args.taskId, { description: args.description });
  return { duplicate: false };
}

// ---------------------------------------------------------------------------
// Keyword overlap helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  "the", "a", "an", "in", "to", "for", "of", "and", "or", "is", "are",
]);

function getSignificantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.;:!?()]+/)
    .filter((w) => w.length > 0 && !STOP_WORDS.has(w));
}

function calculateOverlap(
  queryWords: string[],
  descriptionWords: string[],
): number {
  if (queryWords.length === 0) return 0;
  const common = queryWords.filter((w) => descriptionWords.includes(w)).length;
  return common / queryWords.length;
}

/** Check query against registered tasks — duplicate if word overlap > 50%. */
export function checkDuplicate(
  args: CheckDuplicateArgs,
): CheckDuplicateResult {
  const queryWords = getSignificantWords(args.query);
  if (queryWords.length === 0) {
    return { isDuplicate: false };
  }

  for (const [, entry] of taskRegistry) {
    const descWords = getSignificantWords(entry.description);
    if (descWords.length === 0) continue;

    const overlap = calculateOverlap(queryWords, descWords);
    if (overlap > 0.5) {
      return { isDuplicate: true, matchedTask: entry.description };
    }
  }

  return { isDuplicate: false };
}

export function classifyComplexity(
  args: ClassifyComplexityArgs,
): "simple" | "medium" | "complex" {
  return classifyComplexityImpl(args.prompt);
}

/** Clear the in-memory task registry (for testing). */
export function _resetTaskRegistry(): void {
  taskRegistry.clear();
}
