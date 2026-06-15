import type { Plugin, Config } from "@opencode-ai/plugin";
import type { Model } from "@opencode-ai/sdk";
import { ConfigManager } from "./config.js";

const safeHook = (
  hookName: string,
  fn: (...args: any[]) => Promise<void>,
) => {
  return async (...args: any[]): Promise<void> => {
    try {
      await fn(...args);
    } catch (error) {
      console.warn(`[token-optimizer] Hook "${hookName}" failed:`, error);
    }
  };
};

const plugin: Plugin = async (_ctx) => {
  const configManager = new ConfigManager();
  const hooks: Record<string, unknown> = {};

  // T3 — quick routing: config hook
  if (configManager.isEnabled("quickCategoryRouting")) {
    const { categoryRoutingHook } = await import(
      "./patterns/quick-routing.js"
    );
    hooks.config = safeHook("config", categoryRoutingHook);
  }

  // T5/T6/T7/T8 — system prompt modifications
  if (
    configManager.isEnabled("precisePrompts") ||
    configManager.isEnabled("preComputationGuidance") ||
    configManager.isEnabled("cutExploreAgent")
  ) {
    hooks["experimental.chat.system.transform"] = safeHook(
      "experimental.chat.system.transform",
      async (
        input: { sessionID?: string; model: Model },
        output: { system: string[] },
      ) => {
        const { systemPromptTransformer } = await import(
          "./patterns/system-prompt.js"
        );
        systemPromptTransformer(input, output, configManager.getConfig());
      },
    );
  }

  // T2/T3 — cross-plugin verification
  if (
    configManager.isEnabled("antiDuplication") ||
    configManager.isEnabled("singleConcernDelegation")
  ) {
    hooks["tool.execute.before"] = safeHook(
      "tool.execute.before",
      async (
        _input: { tool: string; sessionID: string; callID: string },
        _output: { args: unknown },
      ) => {
        // Cross-plugin verification logic here
      },
    );
  }

  return hooks;
};

export default plugin;
