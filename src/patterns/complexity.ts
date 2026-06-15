/**
 * Rule-based complexity classifier. Safety: prefer "medium" when uncertain.
 */

const SIMPLE_MAX_CHARS = 100;
const MEDIUM_MAX_CHARS = 500;

const SIMPLE_ACTION_VERBS: readonly string[] = [
  "fix typo",
  "rename",
  "update comment",
  "bump version",
  "update",
  "fix",
  "bump",
  "typo",
  "delete",
  "remove",
  "add import",
  "sort imports",
  "format",
  "lint",
  "prettier",
];

const COMPLEX_SIGNAL_WORDS: readonly string[] = [
  "analyze",
  "investigate",
  "architect",
  "design",
  "end-to-end",
  "end to end",
  "refactor",
  "migrate",
  "redesign",
  "restructure",
  "audit",
  "benchmark",
  "profile",
  "performance",
  "architecture",
];

// Matches file paths like src/foo.ts, ./bar.js, ../../baz.py
const FILE_REF_REGEX = /(?:^|\s)(?:\.\/|\.\.\/|[a-zA-Z0-9_\-/]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb|c|cpp|h|css|json|yaml|yml|md|txt|toml))/g;

function countFileRefs(prompt: string): number {
  return (prompt.match(FILE_REF_REGEX) ?? []).length;
}

function countQuestionMarks(prompt: string): number {
  let count = 0;
  for (const ch of prompt) {
    if (ch === "?") count++;
  }
  return count;
}

function hasSimpleActionVerb(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return SIMPLE_ACTION_VERBS.some((v) => lower.includes(v));
}

function hasComplexSignalWord(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return COMPLEX_SIGNAL_WORDS.some((w) => lower.includes(w));
}

/**
 * Classify a task prompt as 'simple', 'medium', or 'complex'.
 *
 * - **simple**: < 100 chars, no file refs, action-verb driven
 * - **medium**: 100–500 chars, 1–2 file refs, single question (default when uncertain)
 * - **complex**: > 500 chars OR 3+ file refs OR 2+ question marks OR complex signal words
 */
export function classifyComplexity(
  prompt: string,
): "simple" | "medium" | "complex" {
  const trimmed = prompt.trim();
  if (trimmed.length === 0) {
    return "simple";
  }

  const len = trimmed.length;
  const fileRefs = countFileRefs(trimmed);
  const questionMarks = countQuestionMarks(trimmed);
  const isSimpleVerb = hasSimpleActionVerb(trimmed);
  const isComplexWord = hasComplexSignalWord(trimmed);

  if (len < SIMPLE_MAX_CHARS && fileRefs === 0 && isSimpleVerb) {
    return "simple";
  }

  if (len > MEDIUM_MAX_CHARS) {
    if (isComplexWord || fileRefs >= 3 || questionMarks >= 2) {
      return "complex";
    }
    return "medium";
  }

  if (fileRefs >= 3) {
    return "complex";
  }

  if (questionMarks >= 2) {
    return "complex";
  }

  if (isComplexWord && len >= 100) {
    return "complex";
  }

  return "medium";
}

/**
 * Estimate token count: ceil(wordCount * 1.3). Not a real tokenizer.
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return 0;
  }
  const wordCount = trimmed.split(/\s+/).length;
  return Math.ceil(wordCount * 1.3);
}
