import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ConfigManager } from "../config.js";
import {
  categoryRoutingHook,
  shouldRouteToQuick,
  QUICK_ROUTING_PATTERNS,
  QUICK_MAX_PROMPT_CHARS,
} from "../patterns/quick-routing.js";
import type { Config } from "@opencode-ai/plugin";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "token-opt-test-"));
}

function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/** Minimal Config stub that quacks like a real Config object. */
function createMinimalConfig(): Config {
  return {
    model: "opencode/big-pickle",
    experimental: {},
  };
}

/** Write oh-my-openagent.json so the hook finds it at ~/.config/opencode/. */
function writeOmoConfig(dir: string, overrides: Record<string, unknown> = {}) {
  const targetDir = join(dir, ".config", "opencode");
  mkdirSync(targetDir, { recursive: true });

  const base = {
    categories: {
      quick: {
        model: "opencode/mimo-v2.5-free",
        fallback_models: ["opencode/big-pickle"],
      },
    },
  };
  writeFileSync(
    join(targetDir, "oh-my-openagent.json"),
    JSON.stringify({ ...base, ...overrides }, null, 2),
  );
}

// ---------------------------------------------------------------------------
// Tests for shouldRouteToQuick
// ---------------------------------------------------------------------------

describe("shouldRouteToQuick", () => {
  it("routes to quick when prompt is under 100 characters", () => {
    expect(shouldRouteToQuick("fix the button")).toBe(true);
  });

  it("routes to quick for a 50-character prompt", () => {
    const prompt = "a".repeat(50);
    expect(prompt.length).toBe(50);
    expect(shouldRouteToQuick(prompt)).toBe(true);
  });

  it("does NOT route to quick for prompts >= 100 characters", () => {
    const prompt = "a".repeat(500);
    expect(prompt.length).toBeGreaterThanOrEqual(100);
    expect(shouldRouteToQuick(prompt)).toBe(false);
  });

  it("routes to quick when prompt contains a routing pattern", () => {
    expect(shouldRouteToQuick("fix typo in Button.tsx")).toBe(true);
  });

  it("routes to quick for 'rename' pattern", () => {
    expect(shouldRouteToQuick("rename the variable to something clearer")).toBe(
      true,
    );
  });

  it("routes to quick for 'update comment' pattern", () => {
    expect(shouldRouteToQuick("update comment in header")).toBe(true);
  });

  it("routes to quick for 'bump version' pattern", () => {
    expect(shouldRouteToQuick("bump version to 1.2.3")).toBe(true);
  });

  it("is case-insensitive for pattern matching", () => {
    expect(shouldRouteToQuick("FIX TYPO in App.tsx")).toBe(true);
    expect(shouldRouteToQuick("Fix Typo in App.tsx")).toBe(true);
  });

  it("does NOT route to quick when prompt is long and has no matching pattern", () => {
    const prompt =
      "Implement a comprehensive authentication system with OAuth2, " +
      "JWT tokens, refresh tokens, session management, and role-based " +
      "access control across all API endpoints";
    expect(prompt.length).toBeGreaterThanOrEqual(100);
    expect(shouldRouteToQuick(prompt)).toBe(false);
  });

  it("routes to quick for empty or very short strings", () => {
    expect(shouldRouteToQuick("")).toBe(true);
    expect(shouldRouteToQuick("a")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests for categoryRoutingHook
// ---------------------------------------------------------------------------

describe("categoryRoutingHook", () => {
  let tmpDir: string;
  let originalHome: string | undefined;

  beforeEach(() => {
    tmpDir = createTempDir();
    // Point HOME to the temp dir so the hook finds our test oh-my-openagent.json
    originalHome = process.env.HOME;
    process.env.HOME = tmpDir;
  });

  afterEach(() => {
    removeTempDir(tmpDir);
    if (originalHome !== undefined) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }
  });

  it("injects quick routing rules into config.experimental.category_routing", async () => {
    writeOmoConfig(tmpDir);
    const config = createMinimalConfig();
    await categoryRoutingHook(config);

    const experimental = (config as Record<string, unknown>)
      .experimental as Record<string, unknown>;
    const routing = experimental.category_routing as Record<string, unknown>;
    expect(routing).toBeDefined();
    expect(routing.quick).toBeDefined();

    const quickRule = routing.quick as Record<string, unknown>;
    expect(quickRule.maxPromptChars).toBe(QUICK_MAX_PROMPT_CHARS);
    expect(quickRule.patterns).toEqual([...QUICK_ROUTING_PATTERNS]);
  });

  it("handles missing oh-my-openagent.json gracefully (no crash)", async () => {
    // Don't write oh-my-openagent.json — it's missing
    const config = createMinimalConfig();
    await expect(categoryRoutingHook(config)).resolves.toBeUndefined();

    // Config should be unchanged since we couldn't verify the quick category
    const experimental = (config as Record<string, unknown>)
      .experimental as Record<string, unknown>;
    expect(experimental.category_routing).toBeUndefined();
  });

  it("handles missing 'quick' category gracefully (no crash)", async () => {
    writeOmoConfig(tmpDir, {
      categories: { unspecified: { model: "opencode/big-pickle" } },
    });
    const config = createMinimalConfig();
    await expect(categoryRoutingHook(config)).resolves.toBeUndefined();
  });

  it("handles malformed oh-my-openagent.json gracefully (no crash)", async () => {
    writeFileSync(join(tmpDir, "oh-my-openagent.json"), "not valid json");
    const config = createMinimalConfig();
    await expect(categoryRoutingHook(config)).resolves.toBeUndefined();
  });

  it("handles corrupted JSON gracefully (no crash)", async () => {
    // Create the file but with truncated content
    writeFileSync(join(tmpDir, "oh-my-openagent.json"), '{"categories": {');
    const config = createMinimalConfig();
    await expect(categoryRoutingHook(config)).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Integration: ConfigManager + quick routing wiring
// ---------------------------------------------------------------------------

describe("quick routing wire-up", () => {
  it("categoryRoutingHook is registered only when quickCategoryRouting is enabled", () => {
    // Enabled by default
    const managerEnabled = new ConfigManager();
    expect(managerEnabled.isEnabled("quickCategoryRouting")).toBe(true);

    // Can be disabled
    const tmpDir = createTempDir();
    try {
      writeFileSync(
        join(tmpDir, "token-optimizer.json"),
        JSON.stringify({ patterns: { quickCategoryRouting: false } }),
      );
      const managerDisabled = new ConfigManager(tmpDir);
      expect(managerDisabled.isEnabled("quickCategoryRouting")).toBe(false);
    } finally {
      removeTempDir(tmpDir);
    }
  });
});
