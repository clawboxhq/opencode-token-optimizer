import { type Plugin, type Config, tool } from "@opencode-ai/plugin";
import type { Model } from "@opencode-ai/sdk";
import type { ValidateTaskScopeArgs } from "./patterns/tools.js";
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

  // T10 — anti-duplication custom tools
  if (configManager.isEnabled("antiDuplication")) {
    const { trackTask, checkDuplicate } = await import(
      "./patterns/tools.js"
    );
    hooks.tool = {
      ...(typeof hooks.tool === "object" ? (hooks.tool as Record<string, unknown>) : {}),
      track_task: tool({
        description: "Register a task to prevent duplicate delegation",
        args: {
          taskId: tool.schema.string().describe("Unique identifier for this task"),
          description: tool.schema.string().describe("What this task will do"),
        },
        async execute(args) {
          return JSON.stringify(trackTask(args));
        },
      }),
      check_duplicate: tool({
        description: "Check if work has already been delegated",
        args: {
          query: tool.schema.string().describe("Description of work about to do"),
        },
        async execute(args) {
          return JSON.stringify(checkDuplicate(args));
        },
      }),
    };
  }

  // T9 — single-concern delegation: validate_task_scope tool
  if (configManager.isEnabled("singleConcernDelegation")) {
    const { validateTaskScope } = await import(
      "./patterns/tools.js"
    );
    hooks.tool = {
      ...(typeof hooks.tool === "object" ? (hooks.tool as Record<string, unknown>) : {}),
      validate_task_scope: tool({
        description:
          "Validate that a task prompt focuses on ONE concern (not multiple). " +
          "When the prompt describes multiple independent objectives, returns " +
          "the detected concerns so the orchestrator can split into separate tasks.",
        args: {
          prompt: tool.schema
            .string()
            .describe("The task prompt to validate for single-concern focus"),
          maxConcerns: tool.schema
            .number()
            .default(1)
            .describe("Maximum number of concerns to allow (default: 1)"),
        },
        async execute(args) {
          const result = validateTaskScope(
            args as ValidateTaskScopeArgs,
            configManager.getConfig(),
          );
          return JSON.stringify(result, null, 2);
        },
      }),
    };
  }

  return hooks;
};

export default plugin;
