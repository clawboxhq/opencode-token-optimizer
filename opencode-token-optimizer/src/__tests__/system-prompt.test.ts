import { describe, expect, it, spyOn } from "bun:test";
import { systemPromptTransformer } from "../patterns/system-prompt.js";
import type { PluginConfig } from "../config.js";
import type { Model } from "@opencode-ai/sdk";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
      input: {
        text: true,
        audio: false,
        image: false,
        video: false,
        pdf: false,
      },
      output: {
        text: true,
        audio: false,
        image: false,
        video: false,
        pdf: false,
      },
    },
    cost: { input: 1, output: 2, cache: { read: 0.5, write: 1 } },
    limit: { context: 100_000, output: 4096 },
    status: "active",
    options: {},
    headers: {},
  };
}

/**
 * Build a PluginConfig with all transformer-related patterns disabled by
 * default, then selectively enable via overrides.
 */
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("systemPromptTransformer", () => {
  // ── Basic appending behaviour ──────────────────────────────────────────

  it("appends precisePrompts block when that pattern is enabled", () => {
    const output = { system: ["> Original prompt"] };
    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({ precisePrompts: true }),
    );

    expect(output.system).toHaveLength(2);
    expect(output.system[0]).toBe("> Original prompt");
    expect(output.system[1]).toContain(
      '<token_optimizer_guidance pattern="precisePrompts">',
    );
  });

  it("appends preComputationGuidance block when that pattern is enabled", () => {
    const output = { system: ["> Original prompt"] };
    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({ preComputationGuidance: true }),
    );

    expect(output.system).toHaveLength(2);
    expect(output.system[1]).toContain(
      '<token_optimizer_guidance pattern="preComputationGuidance">',
    );
  });

  it("appends cutExploreAgent block when that pattern is enabled", () => {
    const output = { system: ["> Original prompt"] };
    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({ cutExploreAgent: true }),
    );

    expect(output.system).toHaveLength(2);
    expect(output.system[1]).toContain(
      '<token_optimizer_guidance pattern="cutExploreAgent">',
    );
  });

  // ── Disabled patterns ──────────────────────────────────────────────────

  it("skips precisePrompts block when that pattern is disabled", () => {
    const output = { system: ["> Original prompt"] };
    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({
        precisePrompts: false,
        preComputationGuidance: true,
      }),
    );

    expect(output.system).toHaveLength(2);
    expect(output.system[1]).toContain("preComputationGuidance");
    expect(output.system[1]).not.toContain("precisePrompts");
  });

  it("skips all blocks when every transformer pattern is disabled", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const output = { system: ["> Original prompt"] };

    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({}),
    );

    expect(output.system).toHaveLength(1);
    expect(output.system[0]).toBe("> Original prompt");
    expect(warnSpy).toHaveBeenCalled();
    const msg = String(warnSpy.mock.calls[0][0]);
    expect(msg).toContain("no transformer patterns are enabled");
    warnSpy.mockRestore();
  });

  // ── Preservation of original prompt ────────────────────────────────────

  it("does NOT replace the original prompt content", () => {
    const original = [
      "You are a helpful assistant.",
      "Follow the user's instructions carefully.",
    ];
    const output = { system: [...original] };

    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({
        precisePrompts: true,
        preComputationGuidance: true,
        cutExploreAgent: true,
      }),
    );

    // The first two entries must still be the originals
    expect(output.system[0]).toBe(original[0]);
    expect(output.system[1]).toBe(original[1]);
    // New blocks come after
    expect(output.system).toHaveLength(original.length + 3);
  });

  // ── Multiple patterns simultaneously ───────────────────────────────────

  it("includes blocks for multiple enabled patterns", () => {
    const output = { system: ["> Base"] };

    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({
        precisePrompts: true,
        preComputationGuidance: true,
        cutExploreAgent: true,
      }),
    );

    expect(output.system).toHaveLength(4);
    expect(output.system[1]).toContain("precisePrompts");
    expect(output.system[2]).toContain("preComputationGuidance");
    expect(output.system[3]).toContain("cutExploreAgent");
  });

  it("includes both precisePrompts and preComputationGuidance (subset)", () => {
    const output = { system: ["> Base"] };

    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({
        precisePrompts: true,
        preComputationGuidance: true,
      }),
    );

    expect(output.system).toHaveLength(3);
    expect(output.system[1]).toContain("precisePrompts");
    expect(output.system[2]).toContain("preComputationGuidance");
  });

  // ── XML marker correctness ─────────────────────────────────────────────

  it("wraps each block in a <token_optimizer_guidance> tag", () => {
    const output = { system: ["> Original"] };

    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({
        precisePrompts: true,
        preComputationGuidance: true,
        cutExploreAgent: true,
      }),
    );

    for (let i = 1; i < output.system.length; i++) {
      const block = output.system[i];
      expect(block).toMatch(/^<token_optimizer_guidance/);
      expect(block).toMatch(/<\/token_optimizer_guidance>$/);
    }
  });

  it("each block has a distinct pattern attribute", () => {
    const output = { system: ["> Original"] };

    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({
        precisePrompts: true,
        preComputationGuidance: true,
        cutExploreAgent: true,
      }),
    );

    expect(output.system[1]).toContain('pattern="precisePrompts"');
    expect(output.system[2]).toContain('pattern="preComputationGuidance"');
    expect(output.system[3]).toContain('pattern="cutExploreAgent"');
  });

  // ── Edge cases ─────────────────────────────────────────────────────────

  it("handles empty system array gracefully (adds to empty array)", () => {
    const output = { system: [] };
    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      makeConfig({ precisePrompts: true }),
    );

    expect(output.system).toHaveLength(1);
    expect(output.system[0]).toContain("precisePrompts");
  });

  it("handles empty config object gracefully (all flags undefined)", () => {
    const warnSpy = spyOn(console, "warn").mockImplementation(() => {});
    const output = { system: ["> Original"] };

    // Simulate what happens if config fields are missing/undefined
    const emptyConfig = {} as PluginConfig;
    systemPromptTransformer(
      { sessionID: "ses-1", model: mockModel() },
      output,
      emptyConfig,
    );

    // All flags are undefined → falsy → no blocks appended
    expect(output.system).toHaveLength(1);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("handles missing sessionID gracefully", () => {
    const output = { system: ["> Original"] };

    systemPromptTransformer(
      { model: mockModel() },
      output,
      makeConfig({ precisePrompts: true }),
    );

    expect(output.system).toHaveLength(2);
    expect(output.system[1]).toContain("precisePrompts");
  });
});
