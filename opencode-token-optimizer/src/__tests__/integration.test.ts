/**
 * Integration tests for opencode-token-optimizer plugin.
 *
 * These tests verify the plugin loads correctly, registers hooks,
 * and handles various runtime scenarios without requiring a running
 * opencode instance.
 */
import { describe, expect, it, spyOn } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync, existsSync } from "fs";
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
    // Hook should not have mutated the output (T5/T6/T7/T8 stubs)
    expect(sysOutput.system).toEqual(["> Original prompt"]);

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
});
