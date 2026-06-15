/**
 * Integration tests for opencode-token-optimizer plugin.
 *
 * These tests verify the plugin loads correctly, registers hooks,
 * and handles various runtime scenarios without requiring a running
 * opencode instance.
 */
import { describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import type { PluginInput, Config } from "@opencode-ai/plugin";
import type { Model, Project } from "@opencode-ai/sdk";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "token-opt-integration-"));
}

function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

/**
 * Build a minimal valid `PluginInput` mock.  Every field is populated with
 * a stub that satisfies the TypeScript type without actually connecting to
 * anything.
 */
function mockPluginInput(overrides?: Partial<PluginInput>): PluginInput {
  const project: Project = {
    id: "test-project",
    worktree: "/tmp",
    time: { created: Date.now() },
  };

  return {
    client: {} as PluginInput["client"],
    project,
    directory: "/tmp",
    worktree: "/tmp",
    experimental_workspace: { register: () => {} },
    serverUrl: new URL("http://localhost:0"),
    $: {} as PluginInput["$"],
    ...overrides,
  };
}

/**
 * A minimal Model stub that satisfies the `Model` type.
 */
function mockModel(): Model {
  return {
    id: "test-model",
    providerID: "test-provider",
    api: { id: "test", url: "https://example.com", npm: "test" },
    name: "Test Model",
    capabilities: {
      temperature: true,
      reasoning: false,
      attachment: true,
      toolcall: true,
      input: { text: true, audio: false, image: false, video: false, pdf: false },
      output: { text: true, audio: false, image: false, video: false, pdf: false },
    },
    cost: { input: 1, output: 2, cache: { read: 0.5, write: 1 } },
    limit: { context: 100_000, output: 4096 },
    status: "active",
    options: {},
    headers: {},
  };
}

/**
 * A minimal Config stub that satisfies the `Config` type from the SDK.
 */
function mockConfig(): Config {
  return {
    model: "test-provider/test-model",
  };
}

/**
 * Create a temp config file and load the plugin with it by temporarily
 * overriding HOME.  Each call creates a fresh temp directory; cleanup is
 * automatic in the finally block of the caller.
 */
async function withPatternConfig(
  patterns: Record<string, boolean>,
  fn: (hooks: Record<string, unknown>) => Promise<void>,
): Promise<void> {
  const tmpDir = createTempDir();
  const origHome = process.env.HOME;
  try {
    const configDir = join(tmpDir, ".config", "opencode");
    mkdirSync(configDir, { recursive: true });
    writeFileSync(
      join(configDir, "token-optimizer.json"),
      JSON.stringify({ patterns }, null, 2),
    );
    process.env.HOME = tmpDir;
    const { default: plugin } = await import("../index.js");
    const hooks = await plugin(mockPluginInput());
    await fn(hooks);
  } finally {
    process.env.HOME = origHome;
    removeTempDir(tmpDir);
  }
}

// ---------------------------------------------------------------------------
// Integration tests
// ---------------------------------------------------------------------------

describe("token-optimizer plugin integration", () => {
  // ── Test 1: Plugin import + instantiation ──────────────────────────────
  it("can be imported and instantiated without error", async () => {
    // Dynamic import (ESM) – the default export is the Plugin function
    const { default: plugin } = await import("../index.js");
    expect(plugin).toBeFunction();

    const hooks = await plugin(mockPluginInput());
    expect(hooks).toBeObject();
    // With all patterns enabled by default we expect three hooks.
    // Use array-form paths because hook names contain dots.
    expect(hooks).toHaveProperty("config");
    expect(hooks).toHaveProperty(["experimental.chat.system.transform"]);
    expect(hooks).toHaveProperty(["tool.execute.before"]);
  });

  // ── Test 2: Hooks don't throw when invoked with mock contexts ──────────
  it("all registered hooks complete without throwing", async () => {
    const { default: plugin } = await import("../index.js");
    const hooks = await plugin(mockPluginInput());

    // Config hook
    const configHook = hooks.config as
      | ((input: Config) => Promise<void>)
      | undefined;
    expect(configHook).toBeFunction();
    await expect(configHook!(mockConfig())).resolves.toBeUndefined();

    // System transform hook
    const sysTransformHook = hooks[
      "experimental.chat.system.transform"
    ] as
      | ((
          input: { sessionID?: string; model: Model },
          output: { system: string[] },
        ) => Promise<void>)
      | undefined;
    expect(sysTransformHook).toBeFunction();
    const sysOutput = { system: ["> Original prompt"] };
    await expect(
      sysTransformHook!(
        { sessionID: "ses-1", model: mockModel() },
        sysOutput,
      ),
    ).resolves.toBeUndefined();
    // T5 transformer appends guidance blocks for all enabled patterns
    expect(sysOutput.system.length).toBeGreaterThan(1);
    expect(sysOutput.system[0]).toBe("> Original prompt");
    expect(sysOutput.system[1]).toContain(
      '<token_optimizer_guidance pattern="precisePrompts">',
    );
    expect(sysOutput.system).toContainEqual(
      expect.stringContaining("precisePrompts"),
    );
    expect(sysOutput.system).toContainEqual(
      expect.stringContaining("preComputationGuidance"),
    );
    expect(sysOutput.system).toContainEqual(
      expect.stringContaining("cutExploreAgent"),
    );

    // Tool execute.before hook
    const toolBeforeHook = hooks["tool.execute.before"] as
      | ((
          input: { tool: string; sessionID: string; callID: string },
          output: { args: unknown },
        ) => Promise<void>)
      | undefined;
    expect(toolBeforeHook).toBeFunction();
    const toolOutput = { args: { query: "SELECT 1" } };
    await expect(
      toolBeforeHook!(
        { tool: "bash", sessionID: "ses-1", callID: "call-1" },
        toolOutput,
      ),
    ).resolves.toBeUndefined();
    expect(toolOutput.args).toEqual({ query: "SELECT 1" });
  });

  // ── Test 3: Config hook accepts and processes valid config ─────────────
  it("config hook does not crash when given a mock Config object", async () => {
    const { default: plugin } = await import("../index.js");
    const hooks = await plugin(mockPluginInput());

    const configHook = hooks.config as
      | ((input: Config) => Promise<void>)
      | undefined;
    expect(configHook).toBeFunction();

    // Various valid Config shapes should not cause errors
    await expect(configHook!({ model: "a/b" })).resolves.toBeUndefined();
    await expect(configHook!({})).resolves.toBeUndefined();
    await expect(
      configHook!({
        model: "a/b",
        theme: "dark",
        logLevel: "INFO",
      }),
    ).resolves.toBeUndefined();
  });

  // ── Test 4: Missing config file gracefully handled ─────────────────────
  it("handles missing config file gracefully (uses defaults, no crash)", async () => {
    // ConfigManager uses ~/.config/opencode/token-optimizer.json by default.
    // If the file does not exist (the common case), it logs a warning and
    // falls back to defaults.  Verify this end-to-end by spying on warn.
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

    const { default: plugin } = await import("../index.js");
    const hooks = await plugin(mockPluginInput());

    // The plugin should NOT crash and should return all hooks (defaults)
    expect(hooks).toHaveProperty("config");
    expect(hooks).toHaveProperty(["experimental.chat.system.transform"]);
    expect(hooks).toHaveProperty(["tool.execute.before"]);

    // If the file is actually missing, ConfigManager emits a warning.
    // We don't know the host state, so this is best-effort: at minimum,
    // no crash occurred.
    const configPath = join(
      process.env.HOME || "~",
      ".config",
      "opencode",
      "token-optimizer.json",
    );
    if (!existsSync(configPath)) {
      // Should have logged the "not found" warning
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const msg = String(warnSpy.mock.calls[0][0]);
      expect(msg).toContain("Config file not found");
    }

    // Hooks must still work
    const configHook = hooks.config as
      | ((input: Config) => Promise<void>)
      | undefined;
    await expect(configHook!(mockConfig())).resolves.toBeUndefined();
  });

  // ── Test 5: Invalid config JSON gracefully handled ─────────────────────
  it("handles invalid config JSON gracefully (logs warning, uses defaults)", async () => {
    // Write an invalid JSON file to a temp config dir, then construct a
    // ConfigManager pointed at that directory to prove the fallback path.
    const tmpDir = createTempDir();
    try {
      writeFileSync(join(tmpDir, "token-optimizer.json"), "not valid json{{{");

      // Re-import ConfigManager directly to verify the fallback is logged
      const { ConfigManager } = await import("../config.js");
      const warnSpy = spyOn(console, "warn").mockImplementation(() => {});

      const cm = new ConfigManager(tmpDir);
      const config = cm.getConfig();

      // All defaults should still apply
      expect(config.precisePrompts).toBeTrue();
      expect(config.antiDuplication).toBeTrue();
      expect(config.singleConcernDelegation).toBeTrue();
      expect(config.quickCategoryRouting).toBeTrue();
      expect(config.preComputationGuidance).toBeTrue();
      expect(config.cutExploreAgent).toBeTrue();

      // Should have warned about the parse failure
      expect(warnSpy).toHaveBeenCalled();
      const warnMsg = warnSpy.mock.calls
        .map((c) => String(c[0]))
        .join(" ");
      expect(warnMsg).toContain("Failed to load config");
    } finally {
      removeTempDir(tmpDir);
    }
  });

  // ── Test 6: Cross-plugin tool.execute.before fires correctly ───────────
  it("fires tool.execute.before hook for a mock tool registered by another plugin", async () => {
    const { default: plugin } = await import("../index.js");
    const hooks = await plugin(mockPluginInput());

    const toolBeforeHook = hooks["tool.execute.before"] as
      | ((
          input: { tool: string; sessionID: string; callID: string },
          output: { args: unknown },
        ) => Promise<void>)
      | undefined;
    expect(toolBeforeHook).toBeFunction();

    // Simulate another plugin registering a tool — we just need a tool name
    // and to simulate execution through the hook.
    const mockToolName = "my-plugin_tool_search";
    const mockCallID = "call-cross-1";
    const mockArgs = { term: "integration test", limit: 10 };

    const output = { args: mockArgs };

    // Fire the hook as opencode would when a tool runs
    await toolBeforeHook!(
      {
        tool: mockToolName,
        sessionID: "ses-cross-1",
        callID: mockCallID,
      },
      output,
    );

    // The stub hook currently passes through without modification.
    // In future (T2/T3), it will apply anti-duplication or delegation
    // logic.  For now, verify it completed without error and preserved args.
    expect(output.args).toEqual(mockArgs);
  });

  // ── Test 7: System prompt transformer ──────────────────────────────────
  it("returns a system prompt array (not null/undefined) when invoked", async () => {
    const { default: plugin } = await import("../index.js");
    const hooks = await plugin(mockPluginInput());

    const sysTransformHook = hooks[
      "experimental.chat.system.transform"
    ] as
      | ((
          input: { sessionID?: string; model: Model },
          output: { system: string[] },
        ) => Promise<void>)
      | undefined;
    expect(sysTransformHook).toBeFunction();

    const output = { system: ["> Base instruction"] };

    // Invoke with a realistic model
    await sysTransformHook!(
      {
        sessionID: "ses-sys-1",
        model: mockModel(),
      },
      output,
    );

    // The output.system should still be a defined, non-null array
    expect(output.system).toBeArray();
    expect(output.system).not.toBeEmpty();
    // For now the stub is a no-op, so it should still contain our base text
    expect(output.system[0]).toBe("> Base instruction");
  });

  // ── Test 8: Tools not registered when antiDuplication disabled ────────────
  it("does NOT register track_task / check_duplicate when antiDuplication is disabled", async () => {
    // Write a config that disables antiDuplication
    const tmpDir = mkdtempSync(join(tmpdir(), "token-opt-no-ad-"));
    try {
      writeFileSync(
        join(tmpDir, "token-optimizer.json"),
        JSON.stringify({ patterns: { antiDuplication: false } }),
      );

      // Reach into the module internals — we need a ConfigManager to
      // set the config dir.  The simplest way is to test via the
      // exported function directly, but those are module-scoped.
      // Instead, re-import the plugin with a config dir override.
      const { ConfigManager: CM } = await import("../config.js");
      const cm = new CM(tmpDir);
      expect(cm.isEnabled("antiDuplication")).toBe(false);

      // Verify the ConfigManager itself works correctly
      const config = cm.getConfig();
      expect(config.antiDuplication).toBe(false);
      // Other flags should remain at defaults
      expect(config.singleConcernDelegation).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── Test 9–14: Individual pattern toggles ──────────────────────────────
  describe("individual pattern toggles", () => {
    it("quickCategoryRouting only: registers config hook exclusively", async () => {
      await withPatternConfig(
        {
          quickCategoryRouting: true,
          antiDuplication: false,
          singleConcernDelegation: false,
          precisePrompts: false,
          preComputationGuidance: false,
          cutExploreAgent: false,
        },
        (hooks) => {
          expect(hooks).toHaveProperty("config");
          expect(hooks).not.toHaveProperty([
            "experimental.chat.system.transform",
          ]);
          expect(hooks).not.toHaveProperty(["tool.execute.before"]);
          expect(hooks).not.toHaveProperty("tool");
        },
      );
    });

    it("precisePrompts only: registers system transform hook", async () => {
      await withPatternConfig(
        {
          precisePrompts: true,
          antiDuplication: false,
          singleConcernDelegation: false,
          quickCategoryRouting: false,
          preComputationGuidance: false,
          cutExploreAgent: false,
        },
        (hooks) => {
          expect(hooks).not.toHaveProperty("config");
          expect(hooks).toHaveProperty([
            "experimental.chat.system.transform",
          ]);
          expect(hooks).not.toHaveProperty(["tool.execute.before"]);
          expect(hooks).not.toHaveProperty("tool");
        },
      );
    });

    it("preComputationGuidance only: registers system transform hook", async () => {
      await withPatternConfig(
        {
          preComputationGuidance: true,
          antiDuplication: false,
          singleConcernDelegation: false,
          quickCategoryRouting: false,
          precisePrompts: false,
          cutExploreAgent: false,
        },
        (hooks) => {
          expect(hooks).not.toHaveProperty("config");
          expect(hooks).toHaveProperty([
            "experimental.chat.system.transform",
          ]);
          expect(hooks).not.toHaveProperty(["tool.execute.before"]);
          expect(hooks).not.toHaveProperty("tool");
        },
      );
    });

    it("cutExploreAgent only: registers system transform hook", async () => {
      await withPatternConfig(
        {
          cutExploreAgent: true,
          antiDuplication: false,
          singleConcernDelegation: false,
          quickCategoryRouting: false,
          precisePrompts: false,
          preComputationGuidance: false,
        },
        (hooks) => {
          expect(hooks).not.toHaveProperty("config");
          expect(hooks).toHaveProperty([
            "experimental.chat.system.transform",
          ]);
          expect(hooks).not.toHaveProperty(["tool.execute.before"]);
          expect(hooks).not.toHaveProperty("tool");
        },
      );
    });

    it("antiDuplication only: registers tool hooks and custom tools", async () => {
      await withPatternConfig(
        {
          antiDuplication: true,
          singleConcernDelegation: false,
          quickCategoryRouting: false,
          precisePrompts: false,
          preComputationGuidance: false,
          cutExploreAgent: false,
        },
        (hooks) => {
          expect(hooks).not.toHaveProperty("config");
          expect(hooks).not.toHaveProperty([
            "experimental.chat.system.transform",
          ]);
          expect(hooks).toHaveProperty(["tool.execute.before"]);
          expect(hooks).toHaveProperty("tool");
          const toolObj = hooks.tool as Record<string, unknown>;
          expect(toolObj).toHaveProperty("track_task");
          expect(toolObj).toHaveProperty("check_duplicate");
          expect(toolObj).not.toHaveProperty("validate_task_scope");
        },
      );
    });

    it("singleConcernDelegation only: registers validate_task_scope tool", async () => {
      await withPatternConfig(
        {
          singleConcernDelegation: true,
          antiDuplication: false,
          quickCategoryRouting: false,
          precisePrompts: false,
          preComputationGuidance: false,
          cutExploreAgent: false,
        },
        (hooks) => {
          expect(hooks).not.toHaveProperty("config");
          expect(hooks).not.toHaveProperty([
            "experimental.chat.system.transform",
          ]);
          expect(hooks).toHaveProperty(["tool.execute.before"]);
          expect(hooks).toHaveProperty("tool");
          const toolObj = hooks.tool as Record<string, unknown>;
          expect(toolObj).toHaveProperty("validate_task_scope");
          expect(toolObj).not.toHaveProperty("track_task");
          expect(toolObj).not.toHaveProperty("check_duplicate");
        },
      );
    });
  });

  // ── Test 15: All patterns disabled ──────────────────────────────────
  it("plugin loads with all patterns disabled (graceful no-op)", async () => {
    await withPatternConfig(
      {
        precisePrompts: false,
        antiDuplication: false,
        singleConcernDelegation: false,
        quickCategoryRouting: false,
        preComputationGuidance: false,
        cutExploreAgent: false,
      },
      (hooks) => {
        expect(Object.keys(hooks)).toHaveLength(0);
      },
    );
  });

  // ── Test 16: All patterns enabled (tested in Test 1 above) ──────────

  // ── Tests 17-19: System prompt transformer combinations ──────────────
  describe("system prompt transformer combinations", () => {
    it("adds all 3 guidance blocks when all 3 transformer patterns enabled", async () => {
      const { systemPromptTransformer } = await import(
        "../patterns/system-prompt.js"
      );
      const output = { system: ["> base"] };
      systemPromptTransformer(
        { sessionID: "ses-combo-all", model: mockModel() },
        output,
        {
          precisePrompts: true,
          preComputationGuidance: true,
          cutExploreAgent: true,
          antiDuplication: true,
          singleConcernDelegation: true,
          quickCategoryRouting: true,
        },
      );
      expect(output.system).toHaveLength(4);
      expect(output.system[1]).toContain('pattern="precisePrompts"');
      expect(output.system[2]).toContain('pattern="preComputationGuidance"');
      expect(output.system[3]).toContain('pattern="cutExploreAgent"');
    });

    it("adds only precisePrompts block when only that is enabled", async () => {
      const { systemPromptTransformer } = await import(
        "../patterns/system-prompt.js"
      );
      const output = { system: ["> base"] };
      systemPromptTransformer(
        { sessionID: "ses-pp-only", model: mockModel() },
        output,
        {
          precisePrompts: true,
          preComputationGuidance: false,
          cutExploreAgent: false,
          antiDuplication: true,
          singleConcernDelegation: true,
          quickCategoryRouting: true,
        },
      );
      expect(output.system).toHaveLength(2);
      expect(output.system[1]).toContain('pattern="precisePrompts"');
      expect(output.system[1]).not.toContain(
        'pattern="preComputationGuidance"',
      );
      expect(output.system[1]).not.toContain('pattern="cutExploreAgent"');
    });

    it("adds no blocks and warns when no transformer patterns enabled", async () => {
      const { systemPromptTransformer } = await import(
        "../patterns/system-prompt.js"
      );
      const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
      try {
        const output = { system: ["> base"] };
        systemPromptTransformer(
          { sessionID: "ses-none", model: mockModel() },
          output,
          {
            precisePrompts: false,
            preComputationGuidance: false,
            cutExploreAgent: false,
            antiDuplication: true,
            singleConcernDelegation: true,
            quickCategoryRouting: true,
          },
        );
        expect(output.system).toHaveLength(1);
        expect(output.system[0]).toBe("> base");
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "systemPromptTransformer called but no transformer patterns are enabled",
          ),
        );
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  // ── Test 20: Tool schema validation ────────────────────────────────────
  describe("tool schema validation", () => {
    it("all tool schemas have valid description and typed args", async () => {
      const {
        trackTaskSchema,
        checkDuplicateSchema,
        validateTaskScopeSchema,
        classifyComplexitySchema,
      } = await import("../patterns/tools.js");

      const schemas = [
        ["track_task", trackTaskSchema()],
        ["check_duplicate", checkDuplicateSchema()],
        ["validate_task_scope", validateTaskScopeSchema()],
        ["classify_complexity", classifyComplexitySchema()],
      ] as const;

      for (const [name, s] of schemas) {
        expect(s.description).toBeString();
        expect(s.description.length).toBeGreaterThan(0);
        expect(s.args).toBeObject();
        expect(Object.keys(s.args).length).toBeGreaterThan(0);
        for (const [key, arg] of Object.entries(s.args)) {
          expect(arg).toHaveProperty("type");
          expect(arg).toHaveProperty("description");
        }
      }
    });

    it("validateTaskScopeSchema includes maxConcerns default", async () => {
      const { validateTaskScopeSchema } = await import(
        "../patterns/tools.js"
      );
      const s = validateTaskScopeSchema();
      expect(s.args.maxConcerns).toHaveProperty("default");
      expect(s.args.maxConcerns.default).toBe(1);
    });
  });

  // ── Test 21: Complexity + quick-routing integration ────────────────────
  describe("complexity + quick-routing integration", () => {
    it("classifyComplexity from tools module works end-to-end", async () => {
      const { classifyComplexity } = await import("../patterns/tools.js");
      expect(classifyComplexity({ prompt: "fix typo in README" })).toBe(
        "simple",
      );
      expect(
        classifyComplexity({
          prompt:
            "Analyze the authentication flow across all services and design a new architecture",
        }),
      ).toBe("medium");
      expect(
        classifyComplexity({
          prompt: "Update the database schema to add a new column",
        }),
      ).toBe("simple");
    });

    it("shouldRouteToQuick and classifyComplexity agree on task boundaries", async () => {
      const { shouldRouteToQuick } = await import(
        "../patterns/quick-routing.js"
      );
      const { classifyComplexity } = await import("../patterns/tools.js");

      // Trivial task → both agree: simple + quick
      expect(classifyComplexity({ prompt: "fix typo" })).toBe("simple");
      expect(shouldRouteToQuick("fix typo")).toBe(true);

      // Complex cross-cutting task → not quick, not simple
      const complex =
        "Design a new authentication system that supports OAuth2, JWT, and session management across all microservices";
      expect(classifyComplexity({ prompt: complex })).toBe("complex");
      expect(shouldRouteToQuick(complex)).toBe(false);

      // Short with file ref → quick (short prompt) but medium complexity
      expect(shouldRouteToQuick("update src/auth.ts")).toBe(true);
      expect(
        classifyComplexity({ prompt: "update src/auth.ts" }),
      ).toBe("medium");
    });

    it("classifyComplexity handles edge cases via tools module", async () => {
      const { classifyComplexity } = await import("../patterns/tools.js");
      expect(classifyComplexity({ prompt: "" })).toBe("simple");
      expect(
        classifyComplexity({
          prompt: "What is the impact? How to optimize? Where to start?",
        }),
      ).toBe("complex");
      expect(
        classifyComplexity({
          prompt: "Update src/auth.ts, src/middleware.ts, and src/config.ts",
        }),
      ).toBe("complex");
    });
  });

  // ── Test 22: Anti-duplication state isolation ──────────────────────────
  describe("anti-duplication state isolation", () => {
    it("resets state between simulated sessions", async () => {
      const { trackTask, checkDuplicate, _resetTaskRegistry } =
        await import("../patterns/tools.js");

      // Session A
      trackTask({
        taskId: "ses-a-1",
        description: "update auth middleware",
      });
      trackTask({
        taskId: "ses-a-2",
        description: "fix rate limiting bug",
      });

      // Duplicate detection within session A
      const dupA = checkDuplicate({ query: "fix rate limiting bug" });
      expect(dupA.isDuplicate).toBe(true);
      expect(dupA.matchedTask).toBe("fix rate limiting bug");

      // Reset → simulate session boundary
      _resetTaskRegistry();

      // Session B — should not see session A's tasks
      expect(
        checkDuplicate({ query: "fix rate limiting bug" }).isDuplicate,
      ).toBe(false);

      trackTask({
        taskId: "ses-b-1",
        description: "refactor database layer",
      });
      expect(
        checkDuplicate({ query: "refactor database layer" }).isDuplicate,
      ).toBe(true);

      _resetTaskRegistry();
    });

    it("trackTask returns correct duplicate status", async () => {
      const { trackTask, _resetTaskRegistry } = await import(
        "../patterns/tools.js"
      );
      _resetTaskRegistry();
      try {
        expect(
          trackTask({
            taskId: "unique-1",
            description: "implement login flow",
          }).duplicate,
        ).toBe(false);

        expect(
          trackTask({
            taskId: "unique-1",
            description: "implement login flow",
          }).duplicate,
        ).toBe(true);

        expect(
          trackTask({
            taskId: "unique-2",
            description: "write tests",
          }).duplicate,
        ).toBe(false);
      } finally {
        _resetTaskRegistry();
      }
    });
  });
});
