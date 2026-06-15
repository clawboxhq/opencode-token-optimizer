/**
 * Tests for custom tools:
 * - validateTaskScope  (T9: Single-concern delegation validator)
 * - trackTask, checkDuplicate, _resetTaskRegistry  (T10: Anti-duplication guard)
 */
import { describe, expect, it, beforeEach } from "bun:test";
import {
  validateTaskScope,
  trackTask,
  checkDuplicate,
  _resetTaskRegistry,
} from "../patterns/tools.js";
import type { PluginConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Setup — fresh registry before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  _resetTaskRegistry();
});

// ---------------------------------------------------------------------------
// trackTask
// ---------------------------------------------------------------------------

describe("trackTask", () => {
  it("registers a new task and returns duplicate: false", () => {
    const result = trackTask({ taskId: "task-1", description: "fix the button" });
    expect(result).toEqual({ duplicate: false });
  });

  it("detects duplicate task ID and returns existing description", () => {
    trackTask({ taskId: "task-1", description: "fix the button" });
    const result = trackTask({ taskId: "task-1", description: "something else" });
    expect(result).toEqual({
      duplicate: true,
      existingTask: "fix the button",
    });
  });

  it("allows different task IDs with the same description (not duplicates)", () => {
    trackTask({ taskId: "task-1", description: "fix the button" });
    const result = trackTask({ taskId: "task-2", description: "fix the button" });
    expect(result).toEqual({ duplicate: false });
  });
});

// ---------------------------------------------------------------------------
// checkDuplicate
// ---------------------------------------------------------------------------

describe("checkDuplicate", () => {
  it("returns isDuplicate: false on an empty registry", () => {
    const result = checkDuplicate({ query: "fix the button" });
    expect(result).toEqual({ isDuplicate: false });
  });

  it("finds a registered task with > 50% word overlap", () => {
    trackTask({ taskId: "task-1", description: "fix the login button color" });
    const result = checkDuplicate({ query: "fix the button" });
    expect(result.isDuplicate).toBe(true);
    expect(result.matchedTask).toBe("fix the login button color");
  });

  it("returns false for unrelated tasks", () => {
    trackTask({ taskId: "task-1", description: "implement authentication" });
    const result = checkDuplicate({ query: "fix button styling" });
    expect(result).toEqual({ isDuplicate: false });
  });

  it("returns false for empty query", () => {
    trackTask({ taskId: "task-1", description: "fix button" });
    const result = checkDuplicate({ query: "" });
    expect(result).toEqual({ isDuplicate: false });
  });

  it("ignores stop words when calculating overlap", () => {
    // "fix" and "button" are the significant words — "the" and "a" are stop words
    trackTask({ taskId: "task-1", description: "fix the button color" });
    const result = checkDuplicate({ query: "fix a button" });
    expect(result.isDuplicate).toBe(true);
    expect(result.matchedTask).toBe("fix the button color");
  });

  it("does not flag when overlap is exactly 50% (must be > 50%)", () => {
    // Query has 4 significant words: ["create", "user", "profile", "page"]
    // Description has 2: ["create", "user"] → overlap = 2/4 = 0.5 → not > 0.5
    trackTask({ taskId: "task-1", description: "create user" });
    const result = checkDuplicate({
      query: "create user profile page",
    });
    expect(result).toEqual({ isDuplicate: false });
  });

  it("flags when overlap is just above 50%", () => {
    // Query has 3 significant words: ["create", "user", "profile"]
    // Description has ["create", "user"] → overlap = 2/3 ≈ 0.667 > 0.5
    trackTask({ taskId: "task-1", description: "create user" });
    const result = checkDuplicate({
      query: "create user profile",
    });
    expect(result.isDuplicate).toBe(true);
  });

  it("matches across multiple registered tasks", () => {
    trackTask({ taskId: "task-1", description: "implement authentication" });
    trackTask({ taskId: "task-2", description: "fix the login button" });
    trackTask({ taskId: "task-3", description: "deploy to production" });

    const result = checkDuplicate({ query: "fix button styling" });
    expect(result.isDuplicate).toBe(true);
    expect(result.matchedTask).toBe("fix the login button");
  });
});

// ---------------------------------------------------------------------------
// _resetTaskRegistry — session isolation
// ---------------------------------------------------------------------------

describe("_resetTaskRegistry", () => {
  it("clears all registered tasks", () => {
    trackTask({ taskId: "task-1", description: "fix the button" });
    _resetTaskRegistry();
    const result = trackTask({ taskId: "task-1", description: "fix the button" });
    // After reset task-1 is no longer registered → should succeed
    expect(result).toEqual({ duplicate: false });
  });

  it("allows checkDuplicate after reset with no false positives", () => {
    trackTask({ taskId: "task-1", description: "fix the login button" });
    _resetTaskRegistry();
    const result = checkDuplicate({ query: "fix the button" });
    expect(result).toEqual({ isDuplicate: false });
  });
});

// ---------------------------------------------------------------------------
// validateTaskScope  (T9: Single-concern delegation validator)
// ---------------------------------------------------------------------------

function makeConfig(
  overrides: Partial<PluginConfig> = {},
): PluginConfig {
  return {
    precisePrompts: false,
    antiDuplication: false,
    singleConcernDelegation: false,
    quickCategoryRouting: false,
    preComputationGuidance: false,
    cutExploreAgent: false,
    ...overrides,
  };
}

describe("validateTaskScope", () => {
  it("passes for single-concern prompt (no delimiters)", () => {
    const result = validateTaskScope(
      { prompt: "Fix the button alignment in the header" },
      makeConfig(),
    );
    expect(result.valid).toBe(true);
    expect(result.concerns).toEqual([]);
    expect(result.suggestion).toBe("");
  });

  it("passes for single-concern prompt with multiple steps", () => {
    const result = validateTaskScope(
      { prompt: "Implement auth module: first add login, then add logout, then add session refresh" },
      makeConfig(),
    );
    // "and" and "then" are not delimiters — this has one concern
    expect(result.valid).toBe(true);
  });

  it("fails for multi-concern prompt with AND", () => {
    const result = validateTaskScope(
      { prompt: "Fix the button AND add a new API endpoint" },
      makeConfig(),
    );
    expect(result.valid).toBe(false);
    expect(result.concerns).toHaveLength(2);
    expect(result.suggestion).toContain("Split into 2 separate");
  });

  it("fails for multi-concern prompt with ALSO", () => {
    const result = validateTaskScope(
      { prompt: "Refactor auth module ALSO update the tests" },
      makeConfig(),
    );
    expect(result.valid).toBe(false);
    expect(result.concerns).toHaveLength(2);
  });

  it("fails for multi-concern prompt with additionally", () => {
    const result = validateTaskScope(
      { prompt: "Add user profile page additionally fix the nav bar" },
      makeConfig(),
    );
    expect(result.valid).toBe(false);
    expect(result.concerns).toHaveLength(2);
  });

  it("fails for multi-concern prompt with meanwhile", () => {
    const result = validateTaskScope(
      { prompt: "Deploy to staging meanwhile update the CHANGELOG" },
      makeConfig(),
    );
    expect(result.valid).toBe(false);
    expect(result.concerns).toHaveLength(2);
  });

  it("fails for multi-concern prompt with separately", () => {
    const result = validateTaskScope(
      { prompt: "Fix the database migration separately run the linter" },
      makeConfig(),
    );
    expect(result.valid).toBe(false);
    expect(result.concerns).toHaveLength(2);
  });

  it("passes for empty string", () => {
    const result = validateTaskScope(
      { prompt: "" },
      makeConfig(),
    );
    expect(result.valid).toBe(true);
    expect(result.concerns).toEqual([]);
  });

  it("passes for single word", () => {
    const result = validateTaskScope(
      { prompt: "hello" },
      makeConfig(),
    );
    expect(result.valid).toBe(true);
  });

  it("respects custom maxConcerns", () => {
    const result = validateTaskScope(
      { prompt: "Fix button AND add API AND update docs", maxConcerns: 3 },
      makeConfig(),
    );
    // 3 concerns with maxConcerns=3 → valid
    expect(result.valid).toBe(true);
  });

  it("fails when concerns exceed custom maxConcerns", () => {
    const result = validateTaskScope(
      { prompt: "Fix button AND add API AND update docs AND run tests", maxConcerns: 2 },
      makeConfig(),
    );
    // 4 concerns with maxConcerns=2 → invalid
    expect(result.valid).toBe(false);
    expect(result.concerns).toHaveLength(4);
  });

  it("detects file paths in concerns", () => {
    const result = validateTaskScope(
      { prompt: "Fix src/Button.tsx AND update src/Header.tsx" },
      makeConfig(),
    );
    expect(result.valid).toBe(false);
    expect(result.concerns).toHaveLength(2);
    expect(result.concerns[0]).toContain("Button.tsx");
    expect(result.concerns[1]).toContain("Header.tsx");
  });

  it("handles complex multi-concern with mixed keywords", () => {
    const result = validateTaskScope(
      {
        prompt:
          "Implement user authentication in src/auth/login.ts AND " +
          "add rate limiting to src/middleware.ts additionally " +
          "write tests for the API endpoints separately " +
          "update the deployment config",
      },
      makeConfig(),
    );
    expect(result.valid).toBe(false);
    expect(result.concerns.length).toBeGreaterThanOrEqual(2);
  });

  it("passes for whitespace-only prompt", () => {
    const result = validateTaskScope(
      { prompt: "   " },
      makeConfig(),
    );
    expect(result.valid).toBe(true);
  });

  it("does not split on lowercase 'and' (not all-caps)", () => {
    const result = validateTaskScope(
      { prompt: "Read and write files" },
      makeConfig(),
    );
    // "and" is lowercase — should NOT be a delimiter
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Integration: validate_task_scope tool registration
// ---------------------------------------------------------------------------

describe("validate_task_scope tool registration", () => {
  it("registers validate_task_scope when singleConcernDelegation is enabled", async () => {
    // Default config enables everything
    const { default: plugin } = await import("../index.js");
    const hooks = await plugin({
      client: {} as any,
      project: { id: "test", worktree: "/tmp", time: { created: Date.now() } },
      directory: "/tmp",
      worktree: "/tmp",
      experimental_workspace: { register: () => {} },
      serverUrl: new URL("http://localhost:0"),
      $: {} as any,
    });
    // When enabled, the tool should be registered
    expect(hooks).toHaveProperty("tool");
    expect(hooks.tool).toHaveProperty("validate_task_scope");
  });
});
