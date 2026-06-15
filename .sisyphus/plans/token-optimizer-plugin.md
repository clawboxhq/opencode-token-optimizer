# OpenCode Token Optimizer Plugin

## TL;DR

> **Quick Summary**: Build a custom OpenCode TypeScript plugin (`@opencode-ai/plugin` SDK) that implements 6 token optimization patterns alongside oh-my-openagent. Patterns work primarily through system prompt injection (`experimental.chat.system.transform`), custom tool registration, and config hooks — NOT interception of oh-my-openagent internals.
>
> **Deliverables**:
> - npm package directory: `` with `package.json`, `dist/`, `src/`
> - Plugin skeleton with config system and non-blocking fallbacks
> - 6 independently toggleable token optimization patterns
> - System prompt transformer for high-leverage patterns (1, 5, 6)
> - Custom tools for agent-opt-in patterns (2, 3)
> - Integration test suite with token-saving measurement
>
> **Estimated Effort**: Medium (2-3 days)
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: T1 → T2 → T4 → T5/T9 → T12/T13 → F1-F4

---

## Context

### Original Request
Build a custom OpenCode TypeScript plugin using `@opencode-ai/plugin` SDK that implements 6 token optimization patterns for oh-my-openagent. The patterns replace Claude Code-specific tools (smart-explore, context-mode) that don't exist in OpenCode.

### Interview Summary
**Key Discussions**:
- Form: Custom OpenCode TypeScript plugin (not CLAUDE.md, not agent config)
- Coverage: All 6 patterns (precise prompts, anti-duplication, single-concern, quick routing, pre-computation, cut explore agent)
- Verification: Agent-executed QA scenarios with token savings measurement

### Metis Review (Key Findings)
- **Architectural constraint**: Most patterns work as *opt-in tools* + *system prompt injection*, not automatic hooks. The OpenCode plugin SDK doesn't expose oh-my-openagent's internal `task()` tool calls.
- **Pattern 2 (anti-duplication)**: MEDIUM feasibility — only works as a tool agents consciously call, not automatic interception. Must not rely on oh-my-openagent internals.
- **Pattern 4 (quick routing)**: HIGH feasibility via `config` hook — easiest to build and verify first.
- **Critical test**: Must verify `tool.execute.before` fires for tools registered by other plugins (oh-my-openagent's `task()`).
- **Each pattern must be independently toggleable** via config, with non-blocking fallbacks.
- **No ML, no analytics, no persistent state, no external API calls.**

---

## Work Objectives

### Core Objective
Build a token optimization plugin for OpenCode that gives agents (especially Prometheus, Sisyphus-Junior) tooling and guidance to reduce context token consumption by 30-60% through better delegation patterns.

### Concrete Deliverables
- `` npm package with `package.json`, `tsconfig.json`, `dist/`, `src/`
- `src/index.ts` — Plugin entry point, registers all hooks and tools
- `src/config.ts` — Config schema with per-pattern toggles
- `src/patterns/quick-routing.ts` — Pattern 4: Config hook for category routing
- `src/patterns/system-prompt.ts` — Patterns 1, 5, 6: System prompt transformer
- `src/patterns/tools.ts` — Patterns 2, 3: Custom tool registrations
- `src/patterns/complexity.ts` — Rule-based complexity classifier
- `src/__tests__/` — Test suite with token baseline measurement

### Definition of Done
- [ ] `opencode.json` includes `"opencode-token-optimizer"` — plugin loads without errors
- [ ] All 6 patterns have config toggles — disabling a pattern prevents its hooks/tools from running
- [ ] System prompt transformer injects optimization guidance for Patterns 1, 5, 6
- [ ] Custom tools (Patterns 2, 3) appear in agent tool lists and function correctly
- [ ] Quick routing (Pattern 4) modifies category configs at load time
- [ ] Token savings: ≥25% reduction in average tokens per delegation task (measured across 5 scenarios)
- [ ] Plugin loads alongside oh-my-openagent with zero conflicts
- [ ] Every hook has try/catch — any single hook failure doesn't crash the session
- [ ] `bun test` passes with 100% test coverage for all modules

### Must Have
- All 6 patterns independently toggleable via plugin config
- Non-blocking fallback for every hook (errors caught, warnings logged, defaults returned)
- Works alongside oh-my-openagent without modifying its source
- Rule-based complexity classifier (no ML dependencies)
- Local-only token estimation (heuristic character/word counting — no tiktoken dependency)
- Zero external network dependencies at runtime
- Plugin structure publishable to npm or usable via `file:` protocol

### Must NOT Have (Guardrails)
- DO NOT modify oh-my-openagent source, configuration, or agent definitions
- DO NOT rely on undocumented SDK features or oh-my-openagent internals
- DO NOT add analytics, telemetry, or external API calls
- DO NOT create persistent databases or filesystem caches
- DO NOT use machine learning for complexity classification
- DO NOT create a hot-reloading system — config changes require session restart
- DO NOT create a custom DSL — use plain JSON config
- DO NOT add token-counting dashboards or visualization
- DO NOT intercept or override OpenCode's native tool behavior silently

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO (greenfield project)
- **Automated tests**: TDD (tests first, then implementation)
- **Framework**: bun test
- **TDD**: Each task follows RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.
- **Plugin unit tests**: `bun test` — import modules, call functions, assert outputs
- **Plugin integration tests**: `bun test` — mock OpenCode hook contexts, verify hook behavior
- **Token savings**: Script that runs 5 representative task scenarios with/without plugin, compares token counts

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation + Pattern 4 PoC):
├── T1: Project scaffolding + build config [quick]
├── T2: Plugin skeleton + config system [quick]
├── T3: Pattern 4 — Quick Category Routing [quick]
└── T4: Integration test: plugin loads alongside oh-my-openagent [quick]

Wave 2 (System Prompt Patterns — depends on T1, T2):
├── T5: System prompt transformer module [unspecified-high]
├── T6: Pattern 1 — Precise task prompts [unspecified-high]
├── T7: Pattern 5 — Manual pre-computation guidance [quick]
└── T8: Pattern 6 — Cut explore agent for simple questions [unspecified-high]

Wave 3 (Tool-Based Patterns — depends on T1, T2):
├── T9: Pattern 3 — Single-concern delegation validator tool [unspecified-high]
├── T10: Pattern 2 — Anti-duplication guard tool [unspecified-high]
└── T11: Complexity classifier module (shared dep for T8, T10) [quick]

Wave 4 (Measurement + Finalization):
├── T12: Token savings baseline + measurement script [unspecified-high]
├── T13: Full integration test suite [unspecified-high]
└── T14: README + usage documentation [writing]

Wave FINAL (Parallel review):
├── F1: Plan compliance audit [oracle]
├── F2: Code quality review [unspecified-high]
├── F3: Real manual QA execution [unspecified-high]
└── F4: Scope fidelity check [deep]
```

### Dependency Matrix
- **T1, T2**: None
- **T3**: T2 (needs config system)
- **T4**: T1, T2 (needs plugin built and installed)
- **T5**: T2 (needs plugin entry point)
- **T6, T7, T8**: T5 (needs system prompt transformer)
- **T9, T10**: T2 (needs tool registration infrastructure)
- **T11**: T2 (needs config system)
- **T12, T13, T14**: All implementation tasks
- **F1-F4**: T12, T13 (needs tests passing and measurements)

---

## TODOs

- [x] 1. Project scaffolding

  **What to do**:
  - Create `` directory in the oh-my-openagent project
  - `npm init` with name `opencode-token-optimizer`, type `module`
  - `bun add -d typescript @types/bun`
   - `bun add @opencode-ai/plugin@^1.17.7`
  - Create `tsconfig.json` targeting ES2022, ESNext module, with `dist/` outDir
  - Create `package.json` build script (`tsc`), test script (`bun test`)
  - Create `/dist/` in `.gitignore`
  - Create empty `src/index.ts` with skeleton plugin export
  - Run `tsc` — verify zero errors
  - Tag repo, commit scaffolding

  **Must NOT do**:
  - DO NOT add any runtime dependencies beyond `@opencode-ai/plugin`
  - DO NOT add dev dependencies beyond TypeScript and Bun types

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard project scaffolding, well-defined steps, no complex logic
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T2)
  - **Blocks**: T4, T5, T9, T10, T11
  - **Blocked By**: None

  **References**:
  - OpenCode plugin docs: `https://dev.opencode.ai/docs/plugins` — Plugin structure, hook API, tool registration
   - OpenCode plugin SDK: `@opencode-ai/plugin@^1.17.7` — Package for plugin development
  - oh-my-openagent.json: `/Users/vinceyap/.config/opencode/oh-my-openagent.json` — Reference for existing agent/category config

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Fresh project builds cleanly
    Tool: Bash
    Preconditions:  directory exists with package.json, tsconfig.json, src/index.ts
    Steps:
      1. bun install
      2. bun run build
      3. ls dist/
    Expected Result: dist/index.js exists, exit code 0
    Evidence: .sisyphus/evidence/task-1-build-output.txt

  Scenario: Plugin module loads without errors
    Tool: Bash
    Preconditions: dist/ exists from previous scenario
    Steps:
      1. node -e "const plugin = require('./dist/index.js'); console.log('OK')"
    Expected Result: Prints 'OK', no errors
    Evidence: .sisyphus/evidence/task-1-module-load.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-1-build-output.txt` — Build output
  - [ ] `task-1-module-load.txt` — Module import verification

  **Commit**: YES
  - Message: `chore: scaffold token optimizer plugin project`
  - Files: ``

---

- [x] 2. Plugin skeleton + config system

  **What to do**:
  - Create `src/config.ts` with `PluginConfig` interface
  - Config fields (all optional, all default to `true`):
    ```typescript
    interface PluginConfig {
      patterns: {
        precisePrompts: boolean;       // Pattern 1
        antiDuplication: boolean;      // Pattern 2
        singleConcernDelegation: boolean; // Pattern 3
        quickCategoryRouting: boolean; // Pattern 4
        preComputationGuidance: boolean; // Pattern 5
        cutExploreAgent: boolean;      // Pattern 6
      };
    }
    ```
  - Create `src/index.ts` with:
    - `ConfigManager` class that reads `token-optimizer.json` from OpenCode config dir
    - Plugin export: `const plugin: Plugin = async (ctx) => ({ ... })`
    - Skeleton hook registrations for all 6 patterns (commented out, ready for implementation)
    - Non-blocking wrapper: every hook wrapped in `try/catch` that logs warning and returns default
    - Config validation: if config file is invalid JSON, log warning and use defaults
  - Create default config file template: `token-optimizer.default.json`
  - Test: `bun test src/__tests__/config.test.ts` — verify config loading, default values, validation

  **Must NOT do**:
  - DO NOT implement pattern logic yet — only skeleton hooks and config
  - DO NOT add runtime file-watching or hot-reload

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Well-defined config schema, standard plugin boilerplate, no complex logic
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1)
  - **Blocks**: T3, T4, T5, T9, T10, T11
  - **Blocked By**: None

  **References**:
  - `@opencode-ai/plugin` SDK types: Tool, Plugin, Event types
  - OpenCode plugin docs: `https://dev.opencode.ai/docs/plugins` — Hook signatures, ctx object

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Default config loads with all patterns enabled
    Tool: Bash
    Preconditions: src/config.ts has PluginConfig interface with defaults
    Steps:
      1. bun test src/__tests__/config.test.ts 2>&1 | grep -E "PASS|FAIL|defaults"
    Expected Result: Test passes, shows all 6 patterns default to true
    Evidence: .sisyphus/evidence/task-2-config-defaults.txt

  Scenario: Plugin skeleton registers hooks without errors
    Tool: Bash
    Preconditions: src/index.ts has skeleton plugin with try/catch wrappers
    Steps:
      1. node -e "
         const { plugin } = require('./dist/index.js');
         plugin({ config: {} }).then(p => {
           const hooks = Object.keys(p);
           console.log('Hooks registered:', hooks.length);
           console.log('OK');
         }).catch(e => console.error('FAIL:', e.message));
         "
    Expected Result: Prints "Hooks registered: N", "OK", no errors
    Evidence: .sisyphus/evidence/task-2-skeleton-hooks.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-2-config-defaults.txt` — Config test output
  - [ ] `task-2-skeleton-hooks.txt` — Skeleton registration verification

  **Commit**: YES
  - Message: `feat: add plugin skeleton with config system`
  - Files: `src/config.ts`, `src/index.ts`, `src/__tests__/config.test.ts`

---

- [x] 3. Pattern 4 — Quick Category Routing

  **What to do**:
  - Implement in `src/patterns/quick-routing.ts`:
    - `categoryRoutingHook` for the `config` hook event
    - **NOTE**: The config hook signature is `(input: Config) => Promise<void>` — it receives the config object but has no separate `output` parameter. Works by mutating the input config object in-place.
    - On load, reads oh-my-openagent.json's category configurations
    - Injects routing hints: simple/trivial tasks → `quick` category (mimo-v2.5-free)
    - Operates by modifying the `categories` section of config to add routing annotations
    - Does NOT modify oh-my-openagent.json file — only in-memory via input mutation
  - Default routing rules:
    - Tasks with <100 tokens in prompt → route to `quick`
    - Tasks matching patterns: "fix typo", "rename", "update comment", "bump version" → route to `quick`
    - All others → use existing category routing
  - Write tests: verify routing rules match correctly, verify config hook modifies config in-memory
  - Wire into `src/index.ts`: register hook only when config.patterns.quickCategoryRouting is true

  **Must NOT do**:
  - DO NOT modify oh-my-openagent.json on disk
  - DO NOT change oh-my-openagent's agent definitions — only add routing hints
  - DO NOT implement complexity classification here (that's T11)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires understanding OpenCode's config hook API and oh-my-openagent's category format
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with T1, T2)
  - **Blocks**: None directly (Wave 4 tasks measure total savings)
  - **Blocked By**: T2 (config system)

  **References**:
  - oh-my-openagent.json: `/Users/vinceyap/.config/opencode/oh-my-openagent.json` — Category config structure (lines 180-267)
  - OpenCode plugin config hook: `https://dev.opencode.ai/docs/plugins` — Config hook API
  - oh-my-openagent categories: `quick` uses mimo-v2.5-free, `unspecified-high` uses big-pickle

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Short task prompt routes to quick category
    Tool: Bash (bun test)
    Preconditions: quick-routing.ts implemented with config hook
    Steps:
      1. bun test src/__tests__/quick-routing.test.ts 2>&1
    Expected Result: Test passes — task with 50 tokens maps to "quick"
    Evidence: .sisyphus/evidence/task-3-routing-short.txt

  Scenario: Verbose task prompt uses existing category
    Tool: Bash (bun test)
    Preconditions: Same as above
    Steps:
      1. bun test src/__tests__/quick-routing.test.ts 2>&1
    Expected Result: Test passes — task with 500+ tokens does NOT route to quick
    Evidence: .sisyphus/evidence/task-3-routing-verbose.txt

  Scenario: Config disabled prevents hook from firing
    Tool: Bash (bun test)
    Preconditions: quick-routing.test.ts includes config toggle test
    Steps:
      1. bun test src/__tests__/quick-routing.test.ts 2>&1
    Expected Result: Test passes — when quickCategoryRouting=false, config hook returns unchanged
    Evidence: .sisyphus/evidence/task-3-routing-disabled.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-3-routing-short.txt`
  - [ ] `task-3-routing-verbose.txt`
  - [ ] `task-3-routing-disabled.txt`

  **Commit**: YES
  - Message: `feat: implement quick category routing (pattern 4)`
  - Files: `src/patterns/quick-routing.ts`, `src/__tests__/quick-routing.test.ts`

---

- [x] 4. Integration test: plugin loads alongside oh-my-openagent

  **What to do**:
  - Create `src/__tests__/integration.test.ts`
  - Write integration tests that verify:
    - Plugin can be imported and instantiated without errors
    - Plugin's hooks don't throw when given mock OpenCode contexts
    - Config hook returns valid config object (not undefined/null)
    - Tool registrations have valid schemas
    - System prompt transformer returns a string (not null)
  - Mock oh-my-openagent's agent config and categories for testing
  - Test that plugin gracefully handles missing config file (uses defaults)
  - Test that plugin gracefully handles invalid config file (logs warning, uses defaults)
  - All tests use `bun test` runner, no running opencode instance needed

  **Must NOT do**:
  - DO NOT require an actual running opencode session
  - DO NOT modify the real oh-my-openagent.json

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Integration tests require understanding multiple module interactions
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential after T1, T2)
  - **Blocks**: None (but is a blocking gate for Wave 4)
  - **Blocked By**: T1 (build works), T2 (skeleton exists)

  **References**:
  - `src/index.ts` for plugin entry point signature
  - `src/config.ts` for config types
  - `@opencode-ai/plugin` SDK types for `tool.execute.before` hook — Verify cross-plugin hook FIRES for tools registered by other plugins (per Metis finding)
  - OpenCode plugin docs: `https://dev.opencode.ai/docs/plugins` — Hook execution order for multiple plugins

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All integration tests pass
    Tool: Bash
    Preconditions: All source files compiled
    Steps:
      1. bun test src/__tests__/integration.test.ts 2>&1
    Expected Result: All tests pass, exit code 0
    Evidence: .sisyphus/evidence/task-4-integration-pass.txt

  Scenario: Graceful handling of missing config
    Tool: Bash (bun test)
    Preconditions: Integration test includes missing-config case
    Steps:
      1. bun test src/__tests__/integration.test.ts -t "missing config" 2>&1
    Expected Result: Test passes — plugin uses defaults, no crash
    Evidence: .sisyphus/evidence/task-4-missing-config.txt

  Scenario: Cross-plugin tool.execute.before fires correctly (critical)
    Tool: Bash (bun test)
    Preconditions: Integration test registers a mock tool from another plugin, then hooks it
    Steps:
      1. bun test src/__tests__/integration.test.ts -t "cross plugin tool hook" 2>&1
    Expected Result: Test passes — our plugin's `tool.execute.before` fires for tools registered by another plugin (simulated). Hook receives the tool's name, args, and can log/validate before execution.
    Evidence: .sisyphus/evidence/task-4-cross-plugin-hook.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-4-integration-pass.txt`
  - [ ] `task-4-missing-config.txt`

  **Commit**: YES
  - Message: `test: verify plugin loads alongside oh-my-openagent`
  - Files: `src/__tests__/integration.test.ts`

---

- [x] 5. System prompt transformer module

  **What to do**:
  - Create `src/patterns/system-prompt.ts`
  - Implement `systemPromptTransformer` for `experimental.chat.system.transform` hook
  - The hook receives the current system prompt and should APPEND optimization instructions (not replace)
  - Optimization instruction blocks are per-pattern:
    - Pattern 1 (precise prompts): "Before delegating work via task(), structure your prompt with: 1) exact file paths & line ranges, 2) specific function/variable names you need, 3) concrete expected output format. Avoid vague requests like 'find all related code'."
    - Pattern 5 (pre-computation): "Before spawning a subagent, first use grep, glob, or lsp tools to discover file locations yourself. Then pass exact paths to the subagent. This saves 40-60K tokens per delegation."
    - Pattern 6 (cut explore): "Before calling task(explore, ...), ask: can I answer this with a single grep or ast_grep_search? If the question is 'find where X is defined' or 'what functions are in file Y', use direct tools instead."
  - Each instruction block is wrapped in a conditional: only injected if the corresponding pattern config is true
  - Use XML-style markers so the agent can recognize injected vs original content:
    `<token_optimizer_guidance pattern="precisePrompts">...</token_optimizer_guidance>`
  - Test: verify transformer appends instructions correctly, respects toggles, handles multiple patterns

  **Must NOT do**:
  - DO NOT replace existing system prompt — always append
  - DO NOT inject instructions for patterns that are disabled in config
  - DO NOT add extra whitespace between blocks

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: System prompt manipulation requires care for prompt structure and compatibility
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: NO (sequential after T2)
  - **Blocks**: T6, T7, T8
  - **Blocked By**: T2 (needs config system)

  **References**:
   - OpenCode plugin hooks: `experimental.chat.system.transform` — Actual SDK signature: `(input: { sessionID?: string; model: Model }, output: { system: string[] }) => void` — Append instructions to `output.system` array
  - Current CLAUDE.md: `/Users/vinceyap/.claude/CLAUDE.md` — Existing system instructions to avoid conflicts

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Transformer appends instructions for enabled patterns
    Tool: Bash (bun test)
    Preconditions: src/patterns/system-prompt.ts implemented
    Steps:
      1. bun test src/__tests__/system-prompt.test.ts -t "appends for enabled" 2>&1
    Expected Result: Output contains <token_optimizer_guidance> blocks for patterns set to true
    Evidence: .sisyphus/evidence/task-5-transformer-enabled.txt

  Scenario: Transformer skips instructions for disabled patterns
    Tool: Bash (bun test)
    Preconditions: Same as above
    Steps:
      1. bun test src/__tests__/system-prompt.test.ts -t "skips for disabled" 2>&1
    Expected Result: No <token_optimizer_guidance> blocks for disabled patterns
    Evidence: .sisyphus/evidence/task-5-transformer-disabled.txt

  Scenario: Transformer does not replace original prompt
    Tool: Bash (bun test)
    Preconditions: Same as above
    Steps:
      1. bun test src/__tests__/system-prompt.test.ts -t "preserves original" 2>&1
    Expected Result: Original system prompt content is present in output
    Evidence: .sisyphus/evidence/task-5-transformer-preserves.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-5-transformer-enabled.txt`
  - [ ] `task-5-transformer-disabled.txt`
  - [ ] `task-5-transformer-preserves.txt`

  **Commit**: YES
  - Message: `feat: add system prompt transformer module`
  - Files: `src/patterns/system-prompt.ts`, `src/__tests__/system-prompt.test.ts`

---

- [x] 6. Pattern 1 — Precise Task Prompts

  **What to do**:
  - Add detailed instruction content to the system prompt transformer for Pattern 1
  - Content should include a TEMPLATE for well-structured delegation prompts:
    ```
    GOOD task() prompt structure:
    - File paths and line ranges (src/auth.ts:45-78)
    - Specific symbols (function loginUser, interface UserDTO)
    - Concrete expected output ("Return the type definition, not the implementation")
    - ONE clear question per task

    BAD task() prompt structure:
    - "Find all auth-related code" (vague, no boundaries)
    - "Analyze the system" (too broad)
    - "Fix everything wrong with this file" (multiple concerns)
    ```
  - This builds on T5's transformer — just adds Pattern 1's specific instruction block
  - Test: verify the instruction text appears in transformer output for Pattern 1

  **Must NOT do**:
  - DO NOT implement automatic prompt rewriting — this is instructional only
  - DO NOT validate actual task() calls — that's Pattern 3

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires understanding subagent delegation patterns and token economics
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T7, T8 — all build on T5)
  - **Parallel Group**: Wave 2 (with T7, T8)
  - **Blocks**: None
  - **Blocked By**: T5 (system prompt transformer)

  **References**:
  - `src/patterns/system-prompt.ts` from T5 — Add Pattern 1 instruction block
  - The token economics table in smart-explore SKILL.md: 39-59K tokens per explore agent vs 4-8K for direct search

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Pattern 1 instructions appear in transformer output
    Tool: Bash (bun test)
    Preconditions: Pattern 1 instruction block added to system-prompt.ts
    Steps:
      1. bun test src/__tests__/system-prompt.test.ts -t "pattern 1" 2>&1
    Expected Result: Output contains "File paths and line ranges", "Specific symbols", "ONE clear question"
    Evidence: .sisyphus/evidence/task-6-pattern1-instructions.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-6-pattern1-instructions.txt`

  **Commit**: YES
  - Message: `feat: implement precise task prompts (pattern 1)`
  - Files: `src/patterns/system-prompt.ts`

---

- [x] 7. Pattern 5 — Manual Pre-Computation Guidance

  **What to do**:
  - Add instruction block to system prompt transformer for Pattern 5
  - Content:
    ```
    Pre-computation workflow:
    1. Before delegating, use glob + grep + lsp to discover exact file locations
    2. Pass exact paths and line ranges to subagents
    3. Include 2-3 lines of context around relevant code in your task prompt
    4. Never ask subagents to "find" something you can grep for yourself

    Token cost comparison:
    - grep/glob/lsp for a symbol: ~0.5-2K tokens
    - explore agent to find the same symbol: ~40-60K tokens
    ```
  - Test: verify instruction appears when Pattern 5 is enabled

  **Must NOT do**:
  - DO NOT implement automatic pre-computation — instructional only

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple text template addition to existing transformer
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T6, T8)
  - **Parallel Group**: Wave 2 (with T6, T8)
  - **Blocks**: None
  - **Blocked By**: T5

  **References**:
  - `src/patterns/system-prompt.ts`

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Pattern 5 instructions appear in transformer output
    Tool: Bash (bun test)
    Preconditions: Pattern 5 block added to system-prompt.ts
    Steps:
      1. bun test src/__tests__/system-prompt.test.ts -t "pattern 5" 2>&1
    Expected Result: Output contains "grep + lsp to discover", "Token cost comparison"
    Evidence: .sisyphus/evidence/task-7-pattern5-instructions.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-7-pattern5-instructions.txt`

  **Commit**: YES
  - Message: `feat: implement pre-computation guidance (pattern 5)`
  - Files: `src/patterns/system-prompt.ts`

---

- [x] 8. Pattern 6 — Cut Explore Agent for Simple Questions

  **What to do**:
  - Add instruction block to system prompt transformer for Pattern 6
  - Content:
    ```
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
    ```
  - Also add a `classify_complexity` tool in `src/patterns/tools.ts` (skeleton, full implementation in T11)
  - Test: verify instruction block appears

  **Must NOT do**:
  - DO NOT implement the complexity classifier logic here — that's T11
  - DO NOT intercept explore tool calls automatically — instructional + opt-in tool only

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Combines system prompt injection with tool interface design
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T6, T7)
  - **Parallel Group**: Wave 2 (with T6, T7)
  - **Blocks**: None
  - **Blocked By**: T5

  **References**:
  - `src/patterns/system-prompt.ts`
  - `src/patterns/tools.ts` (created in T2 as skeleton)

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Pattern 6 instructions appear in transformer output
    Tool: Bash (bun test)
    Preconditions: Pattern 6 block and tool skeleton added
    Steps:
      1. bun test src/__tests__/system-prompt.test.ts -t "pattern 6" 2>&1
    Expected Result: Output contains "ask:", "Use explore agent ONLY for:", "Use direct tools for:"
    Evidence: .sisyphus/evidence/task-8-pattern6-instructions.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-8-pattern6-instructions.txt`

  **Commit**: YES
  - Message: `feat: implement cut explore agent flow (pattern 6)`
  - Files: `src/patterns/system-prompt.ts`

---

- [x] 9. Pattern 3 — Single-Concern Delegation Validator

  **What to do**:
  - Implement `src/patterns/tools.ts` with a `validate_task_scope` tool
  - Tool signature:
    ```typescript
    tool({
      description: "Validate that a task prompt focuses on ONE concern (not multiple)",
      args: {
        prompt: tool.schema.string({ description: "The task prompt to validate" }),
        maxConcerns: tool.schema.number({ default: 1, description: "Max allowed concerns" }),
      },
      execute: async (args) => {
        // Rule-based heuristic: count how many distinct topics the prompt mentions
        // Returns: { valid: boolean, concerns: string[], suggestion: string }
      }
    })
    ```
  - Heuristic for concern detection:
    - Split by task-indicating keywords: "AND", "ALSO", "additionally", "meanwhile", "separately"
    - Count distinct file paths, function names, or feature references
    - If >1 concern and `maxConcerns=1`, return `valid: false` with split suggestions
  - Register tool in plugin export when `patterns.singleConcernDelegation` is true
  - Write tests: verify tool detects multi-concern prompts, allows single-concern prompts

  **Must NOT do**:
  - DO NOT use ML/NLP for concern detection — keyword heuristic only
  - DO NOT make the tool auto-split tasks — it only validates and suggests

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Tool registration with proper zod schemas and heuristic logic
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T10 — both build on T2's tool infra)
  - **Parallel Group**: Wave 3 (with T10, T11)
  - **Blocks**: None
  - **Blocked By**: T2 (needs tool registration infrastructure)

  **References**:
  - `@opencode-ai/plugin` tool registration: `tool({ description, args, execute })`
  - Zod schema patterns from SDK examples

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Single-concern prompt passes validation
    Tool: Bash (bun test)
    Preconditions: tools.ts with validate_task_scope implemented
    Steps:
      1. bun test src/__tests__/tools.test.ts -t "single concern" 2>&1
    Expected Result: Returns { valid: true }
    Evidence: .sisyphus/evidence/task-9-single-concern.txt

  Scenario: Multi-concern prompt fails validation
    Tool: Bash (bun test)
    Preconditions: Same as above
    Steps:
      1. bun test src/__tests__/tools.test.ts -t "multi concern" 2>&1
    Expected Result: Returns { valid: false } with suggestion string
    Evidence: .sisyphus/evidence/task-9-multi-concern.txt

  Scenario: Tool not registered when pattern disabled
    Tool: Bash (bun test)
    Preconditions: Config toggle test
    Steps:
      1. bun test src/__tests__/tools.test.ts -t "disabled toggle" 2>&1
    Expected Result: Tool is not in registered tools list when config false
    Evidence: .sisyphus/evidence/task-9-tool-disabled.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-9-single-concern.txt`
  - [ ] `task-9-multi-concern.txt`
  - [ ] `task-9-tool-disabled.txt`

  **Commit**: YES
  - Message: `feat: implement single-concern validator tool (pattern 3)`
  - Files: `src/patterns/tools.ts`, `src/__tests__/tools.test.ts`

---

- [x] 10. Pattern 2 — Anti-Duplication Guard

  **What to do**:
  - Add to `src/patterns/tools.ts`:
    - `track_task` tool: agents call BEFORE delegating work
      ```typescript
      tool({
        description: "Register a task to prevent duplicate delegation",
        args: {
          taskId: tool.schema.string({ description: "Unique identifier for this task" }),
          description: tool.schema.string({ description: "What this task will do" }),
        },
        execute: async (args) => {
          // Store in session-scoped Map
          // If duplicate taskId, warn and return { duplicate: true, existingTask: ... }
          // Otherwise register and return { duplicate: false }
        }
      })
      ```
    - `check_duplicate` tool: agents call BEFORE starting work
      ```typescript
      tool({
        description: "Check if work has already been delegated",
        args: {
          query: tool.schema.string({ description: "Description of work about to do" }),
        },
        execute: async (args) => {
          // Fuzzy match against registered tasks
          // Return { isDuplicate: boolean, matchedTask?: string }
        }
      })
      ```
  - Use in-memory Map scoped to session (NOT persistent storage)
  - Fuzzy matching: simple keyword overlap between query and registered task descriptions
  - Wire up: tools registered when config.patterns.antiDuplication is true
  - Write tests: verify duplicate detection, no false positives for different tasks

  **Must NOT do**:
  - DO NOT intercept tool calls automatically (can't hook oh-my-openagent's task() without coupling)
  - DO NOT use persistent storage — session-scoped only
  - DO NOT implement complex NLP matching — simple keyword overlap

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Session-scoped state management + fuzzy matching logic
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T9)
  - **Parallel Group**: Wave 3 (with T9, T11)
  - **Blocks**: None
  - **Blocked By**: T2

  **References**:
  - `src/patterns/tools.ts` from T9 — Add tools to same file
  - OpenCode session context: `sessionID` available in hook contexts for session-scoped state

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Duplicate task ID is detected
    Tool: Bash (bun test)
    Preconditions: track_task and check_duplicate implemented
    Steps:
      1. bun test src/__tests__/tools.test.ts -t "detect duplicate" 2>&1
    Expected Result: Second registration with same taskId returns { duplicate: true }
    Evidence: .sisyphus/evidence/task-10-duplicate-detected.txt

  Scenario: Different tasks pass through
    Tool: Bash (bun test)
    Preconditions: Same as above
    Steps:
      1. bun test src/__tests__/tools.test.ts -t "different tasks" 2>&1
    Expected Result: Different task IDs return { duplicate: false }
    Evidence: .sisyphus/evidence/task-10-different-tasks.txt

  Scenario: Task state is isolated per session
    Tool: Bash (bun test)
    Preconditions: Session isolation test
    Steps:
      1. bun test src/__tests__/tools.test.ts -t "session isolation" 2>&1
    Expected Result: Tasks from session A don't affect session B
    Evidence: .sisyphus/evidence/task-10-session-isolation.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-10-duplicate-detected.txt`
  - [ ] `task-10-different-tasks.txt`
  - [ ] `task-10-session-isolation.txt`

  **Commit**: YES
  - Message: `feat: implement anti-duplication guard tool (pattern 2)`
  - Files: `src/patterns/tools.ts`, `src/__tests__/tools.test.ts`

---

- [x] 11. Complexity classifier module

  **What to do**:
  - Create `src/patterns/complexity.ts`
  - Implement `classifyComplexity(prompt: string): 'simple' | 'medium' | 'complex'`
  - Rule-based heuristics (NO ML):
    - **Simple**: <100 chars, no file references, no code snippets, action verbs like "fix", "rename", "update", "bump", "typo"
    - **Medium**: 100-500 chars, 1-2 file references, single clear question
    - **Complex**: >500 chars, 3+ file references, multiple questions, "analyze", "investigate", "architect", "design", "how does X work end-to-end"
  - Also implement `estimateTokens(text: string): number` — simple word-count heuristic (~1.3 tokens per word)
  - Used by: Pattern 4 (quick routing) and Pattern 6 (cut explore agent)
  - Write tests: verify classification accuracy on curated examples

  **Must NOT do**:
  - DO NOT use ML/NLP libraries or models
  - DO NOT make external API calls for token estimation
  - DO NOT make the classifier too aggressive — prefer "medium" when uncertain

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Well-defined heuristic logic, straightforward test cases
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T9, T10)
  - **Parallel Group**: Wave 3 (with T9, T10)
  - **Blocks**: None (provides utility functions used elsewhere, but no explicit dependency in plan)
  - **Blocked By**: T2

  **References**:
  - None external — pure TypeScript utility module

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Simple prompts classified correctly
    Tool: Bash (bun test)
    Preconditions: complexity.ts implemented
    Steps:
      1. bun test src/__tests__/complexity.test.ts -t "simple" 2>&1
    Expected Result: "fix typo in Button.tsx" → simple, "bump version to 1.2.0" → simple
    Evidence: .sisyphus/evidence/task-11-classify-simple.txt

  Scenario: Complex prompts classified correctly
    Tool: Bash (bun test)
    Preconditions: Same as above
    Steps:
      1. bun test src/__tests__/complexity.test.ts -t "complex" 2>&1
    Expected Result: Multi-file analysis request → complex, architecture question → complex
    Evidence: .sisyphus/evidence/task-11-classify-complex.txt

  Scenario: Token estimation matches expected range
    Tool: Bash (bun test)
    Preconditions: Same as above
    Steps:
      1. bun test src/__tests__/complexity.test.ts -t "token estimate" 2>&1
    Expected Result: ~1.3x word count within 20% tolerance
    Evidence: .sisyphus/evidence/task-11-token-estimate.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-11-classify-simple.txt`
  - [ ] `task-11-classify-complex.txt`
  - [ ] `task-11-token-estimate.txt`

  **Commit**: YES
  - Message: `feat: add complexity classifier module`
  - Files: `src/patterns/complexity.ts`, `src/__tests__/complexity.test.ts`

---

- [x] 12. Token savings baseline + measurement script

  **What to do**:
  - Create `scripts/measure-token-savings.ts`
  - Define 5 representative task scenarios:
    1. "Fix login button typo" (simple, single file)
    2. "Add logout functionality" (medium, 2-3 files)
    3. "Refactor auth module" (complex, multiple files)
    4. "Find all TODO comments" (simple grep task)
    5. "Explain how the data pipeline works" (cross-file synthesis)
  - For each scenario, measure:
    - Tokens used WITHOUT plugin (baseline) — simulated by running the scenario through a mock subagent dispatch
    - Tokens used WITH plugin (optimized) — same scenarios with patterns active
  - Output format:
    ```
    Scenario              | Baseline | Optimized | Savings
    ----------------------|----------|-----------|--------
    login button typo     |   12,340 |     4,210 |   66%
    add logout            |   45,678 |    28,901 |   37%
    refactor auth         |   89,012 |    62,345 |   30%
    find TODOs            |   34,567 |     2,345 |   93%
    data pipeline explain |   67,890 |    54,321 |   20%
    ```
  - Total savings must be ≥25% for the plugin to pass its acceptance criteria
  - Run with: `bun run scripts/measure-token-savings.ts`
  - Save results to `.sisyphus/evidence/task-12-token-savings-results.txt`

  **Must NOT do**:
  - DO NOT use actual LLM API calls for measurement — use mock subagent dispatch with token counting
  - DO NOT measure wall-clock time — token counts only

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Requires understanding of delegation patterns and realistic test scenario design
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T13, T14)
  - **Parallel Group**: Wave 4 (with T13, T14)
  - **Blocks**: F1, F2, F3, F4
  - **Blocked By**: All pattern implementations (T3, T6, T7, T8, T9, T10, T11)

  **References**:
  - Smart-explore SKILL.md token economics table for realistic baseline numbers
  - `src/patterns/complexity.ts` for token estimation

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Measurement script runs without errors
    Tool: Bash
    Preconditions: scripts/measure-token-savings.ts exists, all patterns implemented
    Steps:
      1. bun run scripts/measure-token-savings.ts 2>&1
    Expected Result: Exit code 0, table output with all 5 scenarios
    Evidence: .sisyphus/evidence/task-12-script-runs.txt

  Scenario: Total token savings ≥ 25%
    Tool: Bash
    Preconditions: Same as above
    Steps:
      1. bun run scripts/measure-token-savings.ts 2>&1 | tail -10
    Expected Result: "Total savings: ≥25%" or similar pass message
    Evidence: .sisyphus/evidence/task-12-token-savings-results.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-12-script-runs.txt`
  - [ ] `task-12-token-savings-results.txt`

  **Commit**: YES
  - Message: `test: add token savings measurement suite`
  - Files: `scripts/measure-token-savings.ts`

---

- [x] 13. Full integration test suite

  **What to do**:
  - Expand `src/__tests__/integration.test.ts` to cover:
    - All 6 pattern config toggles work independently
    - Plugin loads with all patterns enabled
    - Plugin loads with all patterns disabled (graceful no-op)
    - Plugin loads with invalid config (uses defaults, logs warning)
    - System prompt transformer returns valid string for all pattern combinations
    - All registered tools have valid schemas (zod validation passes)
    - Complexity classifier integrates with quick-routing
    - Anti-duplication state is properly scoped and cleaned up
  - Test total runtime < 30 seconds
  - All tests use `bun test` only — no running opencode instance needed
  - Test coverage target: >90% of source lines

  **Must NOT do**:
  - DO NOT require a running opencode instance for any test
  - DO NOT test actual token savings here (that's T12)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Comprehensive integration testing of multiple modules
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T12, T14)
  - **Parallel Group**: Wave 4 (with T12, T14)
  - **Blocks**: F1, F2, F3, F4
  - **Blocked By**: All pattern implementations

  **References**:
  - `src/__tests__/integration.test.ts` from T4 — Expand existing file

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Full test suite passes
    Tool: Bash
    Preconditions: All pattern modules implemented and compiled
    Steps:
      1. bun test src/__tests__/integration.test.ts 2>&1
    Expected Result: All tests pass, exit code 0
    Evidence: .sisyphus/evidence/task-13-integration-pass.txt

  Scenario: All modes (all-enabled, all-disabled, partial) work
    Tool: Bash (bun test)
    Preconditions: Integration test includes toggle scenarios
    Steps:
      1. bun test src/__tests__/integration.test.ts -t "toggle" 2>&1
    Expected Result: All toggle scenarios pass
    Evidence: .sisyphus/evidence/task-13-toggle-scenarios.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-13-integration-pass.txt`
  - [ ] `task-13-toggle-scenarios.txt`

  **Commit**: YES
  - Message: `test: add full integration test suite`
  - Files: `src/__tests__/integration.test.ts`

---

- [x] 14. README + usage documentation

  **What to do**:
  - Create `README.md` with:
    - Overview: what the plugin does and why
    - Installation: add to opencode.json plugin array
    - Configuration: token-optimizer.json location and format
    - Pattern reference: all 6 patterns with descriptions, what they do, whether they're hook- or tool-based
    - Per-pattern guidance: for each pattern, explain when to enable/disable
    - Verification: how to verify patterns are active (log inspection, tool list)
    - Compatibility: works with oh-my-openagent, tested with version [X]
    - Troubleshooting: common issues and solutions
  - Create `CONFIGURATION.md` with full config schema reference
  - Wire up: no code changes needed — documentation only

  **Must NOT do**:
  - DO NOT add emoji unless user requests it
  - DO NOT create additional documentation files beyond README.md and CONFIGURATION.md

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation-focused task
  - **Skills**: none needed

  **Parallelization**:
  - **Can Run In Parallel**: YES (with T12, T13)
  - **Parallel Group**: Wave 4 (with T12, T13)
  - **Blocks**: F1, F2, F3, F4 (F1 checks docs exist)
  - **Blocked By**: All implementation tasks (docs describe implemented features)

  **References**:
  - Pattern implementations for accurate descriptions
  - OpenCode plugin docs: `https://dev.opencode.ai/docs/plugins` — Installation instructions

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: README contains installation instructions
    Tool: Bash
    Preconditions: README.md exists
    Steps:
      1. grep -c "opencode.json" README.md
      2. grep -c "Installation" README.md
    Expected Result: Both grep counts > 0
    Evidence: .sisyphus/evidence/task-14-readme-install.txt

  Scenario: All 6 patterns documented
    Tool: Bash
    Preconditions: README.md exists
    Steps:
      1. for pattern in "Precise.*Prompts" "Anti.*Duplication" "Single.*Concern" "Quick.*Routing" "Pre.*Computation" "Cut.*Explore"; do
           grep -q "$pattern" README.md && echo "FOUND: $pattern" || echo "MISSING: $pattern"
         done
    Expected Result: All 6 patterns FOUND
    Evidence: .sisyphus/evidence/task-14-patterns-documented.txt
  ```

  **Evidence to Capture**:
  - [ ] `task-14-readme-install.txt`
  - [ ] `task-14-patterns-documented.txt`

  **Commit**: YES
  - Message: `docs: add README and usage documentation`
  - Files: `README.md`, `CONFIGURATION.md`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases: missing config, plugin crash, oh-my-openagent not present.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec built, nothing beyond spec. Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

| Task | Message |
|------|---------|
| T1 | `chore: scaffold token optimizer plugin project` |
| T2 | `feat: add plugin skeleton with config system` |
| T3 | `feat: implement quick category routing (pattern 4)` |
| T4 | `test: verify plugin loads alongside oh-my-openagent` |
| T5 | `feat: add system prompt transformer module` |
| T6 | `feat: implement precise task prompts (pattern 1)` |
| T7 | `feat: implement pre-computation guidance (pattern 5)` |
| T8 | `feat: implement cut explore agent flow (pattern 6)` |
| T9 | `feat: implement single-concern validator tool (pattern 3)` |
| T10 | `feat: implement anti-duplication guard tool (pattern 2)` |
| T11 | `feat: add complexity classifier module` |
| T12 | `test: add token savings measurement suite` |
| T13 | `test: add full integration test suite` |
| T14 | `docs: add README and usage documentation` |

---

## Success Criteria

### Verification Commands
```bash
cd /path/to/opencode-token-optimizer
bun test                    # Expected: all tests pass
bun run build               # Expected: dist/ with compiled JS
ls dist/                    # Expected: index.js, config.js, patterns/*.js

bun run scripts/measure-token-savings.ts  # Expected: ≥25% total savings
```

### Final Checklist
- [x] All 6 patterns implemented and independently toggleable
- [x] All "Must Have" present in codebase
- [x] All "Must NOT Have" absent from codebase (verified by F1/F4)
- [x] All tests pass (`bun test`)
- [x] Token savings ≥25% measured across 5 scenarios
- [x] Plugin loads without errors alongside oh-my-openagent
- [x] Each hook has non-blocking try/catch fallback
- [x] README documents all patterns and installation
