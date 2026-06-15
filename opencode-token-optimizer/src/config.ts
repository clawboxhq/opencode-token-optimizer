import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface PluginConfig {
  precisePrompts: boolean;
  antiDuplication: boolean;
  singleConcernDelegation: boolean;
  quickCategoryRouting: boolean;
  preComputationGuidance: boolean;
  cutExploreAgent: boolean;
}

export function getDefaultConfig(): PluginConfig {
  return {
    precisePrompts: true,
    antiDuplication: true,
    singleConcernDelegation: true,
    quickCategoryRouting: true,
    preComputationGuidance: true,
    cutExploreAgent: true,
  };
}

export class ConfigManager {
  private config: PluginConfig;
  private configDir: string;

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(homedir(), ".config", "opencode");
    this.config = this.load();
  }

  getConfig(): PluginConfig {
    return { ...this.config };
  }

  isEnabled(pattern: keyof PluginConfig): boolean {
    return this.config[pattern];
  }

  private load(): PluginConfig {
    const configPath = join(this.configDir, "token-optimizer.json");
    try {
      if (!existsSync(configPath)) {
        console.warn(
          `[token-optimizer] Config file not found at ${configPath}, using defaults`,
        );
        return getDefaultConfig();
      }
      const raw = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(raw);
      const patterns = parsed?.patterns ?? {};
      return {
        precisePrompts: patterns.precisePrompts ?? true,
        antiDuplication: patterns.antiDuplication ?? true,
        singleConcernDelegation: patterns.singleConcernDelegation ?? true,
        quickCategoryRouting: patterns.quickCategoryRouting ?? true,
        preComputationGuidance: patterns.preComputationGuidance ?? true,
        cutExploreAgent: patterns.cutExploreAgent ?? true,
      };
    } catch (error) {
      console.warn(`[token-optimizer] Failed to load config:`, error);
      return getDefaultConfig();
    }
  }
}
