import type { Model } from "@opencode-ai/sdk";
import type { PluginConfig } from "../config.js";

// ---------------------------------------------------------------------------
// Instruction blocks — each wrapped in XML markers as required by the spec
// ---------------------------------------------------------------------------

const PRECISE_PROMPTS_GUIDANCE = `<token_optimizer_guidance pattern="precisePrompts">
Before delegating work via task(), structure your prompt with:
1) exact file paths & line ranges (src/auth.ts:45-78)
2) specific function/variable names you need (function loginUser, interface UserDTO)
3) concrete expected output format ("Return the type definition, not the implementation")
4) ONE clear question per task

GOOD task() prompt:
"Find the auth middleware in src/middleware/auth.ts and add rate limiting (max 100 req/min) to it"

BAD task() prompt:
"Find all auth-related code and fix everything wrong with it"
</token_optimizer_guidance>`;

const PRE_COMPUTATION_GUIDANCE = `<token_optimizer_guidance pattern="preComputationGuidance">
Before spawning a subagent, first use grep, glob, or lsp tools to discover file locations yourself.
Then pass exact paths to the subagent. This saves 40-60K tokens per delegation.

Token cost comparison:
- grep/glob/lsp for a symbol: ~0.5-2K tokens
- explore agent to find the same symbol: ~40-60K tokens
</token_optimizer_guidance>`;

const CUT_EXPLORE_AGENT_GUIDANCE = `<token_optimizer_guidance pattern="cutExploreAgent">
Before calling task(subagent_type="explore", ...), ask:
- "Can I answer this with grep, ast_grep_search, or lsp_find_references directly?"
- "Is this a single-file question or cross-file synthesis?"
- "Is the answer <20 lines of code?"

Use explore agent ONLY for:
- Cross-file synthesis (understanding how 5+ files connect)
- Architecture narrative ("how does the auth flow work end-to-end?")
- Open-ended investigation ("what could be causing this bug?")

Use direct tools for:
- "Where is X defined?" → lsp_find_references or ast_grep_search
- "What functions are in file Y?" → ast_grep_search or grep
- "Find all TODO/FIXME" → grep
</token_optimizer_guidance>`;

// ---------------------------------------------------------------------------
// Transformer function
// ---------------------------------------------------------------------------

/**
 * Appends token optimization instruction blocks to the system prompt.
 * Each enabled pattern contributes an XML-wrapped guidance block.
 *
 * The function does NOT replace or modify the existing prompt — it only
 * pushes new entries to the `output.system` array.  The SDK merges these
 * entries into the final system prompt.
 *
 * Hook signature: `(input: { sessionID?, model }, output: { system: string[] }) => void`
 *
 * @param _input     Hook input (sessionID and model metadata)
 * @param output     Hook output; push to `output.system` to append instructions
 * @param config     Plugin configuration controlling which patterns are enabled
 */
export function systemPromptTransformer(
  _input: { sessionID?: string; model: Model },
  output: { system: string[] },
  config: PluginConfig,
): void {
  // Safety guard: if no transformer-relevant patterns are enabled, warn and
  // return early (the hook is already gated in index.ts, but this ensures
  // correctness if called directly).
  if (
    !config.precisePrompts &&
    !config.preComputationGuidance &&
    !config.cutExploreAgent
  ) {
    console.warn(
      `[token-optimizer] systemPromptTransformer called but no transformer patterns are enabled`,
    );
    return;
  }

  // Append blocks for each enabled pattern.  Order is: precise prompts,
  // pre-computation guidance, then cut-explore-agent guidance.
  if (config.precisePrompts) {
    output.system.push(PRECISE_PROMPTS_GUIDANCE);
  }

  if (config.preComputationGuidance) {
    output.system.push(PRE_COMPUTATION_GUIDANCE);
  }

  if (config.cutExploreAgent) {
    output.system.push(CUT_EXPLORE_AGENT_GUIDANCE);
  }
}
