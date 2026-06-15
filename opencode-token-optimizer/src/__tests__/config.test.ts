import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { ConfigManager, getDefaultConfig } from "../config.js";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "token-opt-test-"));
}

function removeTempDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

describe("getDefaultConfig", () => {
  it("returns all patterns enabled", () => {
    const config = getDefaultConfig();
    expect(config.precisePrompts).toBe(true);
    expect(config.antiDuplication).toBe(true);
    expect(config.singleConcernDelegation).toBe(true);
    expect(config.quickCategoryRouting).toBe(true);
    expect(config.preComputationGuidance).toBe(true);
    expect(config.cutExploreAgent).toBe(true);
  });
});

describe("ConfigManager", () => {
  it("loads from valid JSON file", () => {
    const tmpDir = createTempDir();
    try {
      writeFileSync(
        join(tmpDir, "token-optimizer.json"),
        JSON.stringify({
          patterns: {
            precisePrompts: true,
            antiDuplication: false,
            singleConcernDelegation: true,
            quickCategoryRouting: false,
            preComputationGuidance: true,
            cutExploreAgent: false,
          },
        }),
      );
      const manager = new ConfigManager(tmpDir);
      const config = manager.getConfig();
      expect(config.precisePrompts).toBe(true);
      expect(config.antiDuplication).toBe(false);
      expect(config.singleConcernDelegation).toBe(true);
      expect(config.quickCategoryRouting).toBe(false);
      expect(config.preComputationGuidance).toBe(true);
      expect(config.cutExploreAgent).toBe(false);
    } finally {
      removeTempDir(tmpDir);
    }
  });

  it("returns defaults when file missing", () => {
    const tmpDir = createTempDir();
    try {
      const manager = new ConfigManager(tmpDir);
      const config = manager.getConfig();
      expect(config.precisePrompts).toBe(true);
      expect(config.antiDuplication).toBe(true);
      expect(config.singleConcernDelegation).toBe(true);
      expect(config.quickCategoryRouting).toBe(true);
      expect(config.preComputationGuidance).toBe(true);
      expect(config.cutExploreAgent).toBe(true);
    } finally {
      removeTempDir(tmpDir);
    }
  });

  it("returns defaults when file has invalid JSON", () => {
    const tmpDir = createTempDir();
    try {
      writeFileSync(join(tmpDir, "token-optimizer.json"), "not valid json");
      const manager = new ConfigManager(tmpDir);
      const config = manager.getConfig();
      expect(config.precisePrompts).toBe(true);
      expect(config.antiDuplication).toBe(true);
      expect(config.singleConcernDelegation).toBe(true);
      expect(config.quickCategoryRouting).toBe(true);
      expect(config.preComputationGuidance).toBe(true);
      expect(config.cutExploreAgent).toBe(true);
    } finally {
      removeTempDir(tmpDir);
    }
  });

  it("respects per-pattern overrides in file", () => {
    const tmpDir = createTempDir();
    try {
      writeFileSync(
        join(tmpDir, "token-optimizer.json"),
        JSON.stringify({
          patterns: {
            precisePrompts: false,
          },
        }),
      );
      const manager = new ConfigManager(tmpDir);
      const config = manager.getConfig();
      expect(config.precisePrompts).toBe(false);
      expect(config.antiDuplication).toBe(true);
      expect(config.singleConcernDelegation).toBe(true);
      expect(config.quickCategoryRouting).toBe(true);
      expect(config.preComputationGuidance).toBe(true);
      expect(config.cutExploreAgent).toBe(true);
    } finally {
      removeTempDir(tmpDir);
    }
  });

  it("isEnabled returns correct value for pattern", () => {
    const tmpDir = createTempDir();
    try {
      writeFileSync(
        join(tmpDir, "token-optimizer.json"),
        JSON.stringify({
          patterns: {
            antiDuplication: false,
          },
        }),
      );
      const manager = new ConfigManager(tmpDir);
      expect(manager.isEnabled("precisePrompts")).toBe(true);
      expect(manager.isEnabled("antiDuplication")).toBe(false);
      expect(manager.isEnabled("cutExploreAgent")).toBe(true);
    } finally {
      removeTempDir(tmpDir);
    }
  });
});
