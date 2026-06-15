# Learnings — Token Optimizer Plugin

## 2026-06-15 Session Start
- Momus review completed: plan OKAY. Hook signature `experimental.chat.system.transform` actual SDK: `(input: { sessionID?, model }, output: { system: string[] })` — push to `output.system`.
- Plugin SDK latest: `@opencode-ai/plugin@^1.17.7`
- Config hook: `(input: Config) => Promise<void>` — mutates input, no output param.
- Need to validate `tool.execute.before` fires for cross-plugin tools.

## Task T1: Project Scaffolding (2026-06-15)
- TypeScript 6.0.3 installed with ES2022 target, ESNext module, bundler resolution
- @opencode-ai/plugin@1.17.7 resolves cleanly with bun
- Plugin SDK export is a function (Plugin type) — skeleton compiles and loads correctly
- `moduleResolution: "bundler"` needed for ESM + TypeScript 6.x compatibility
- ESM module load test uses dynamic `import()` (not require) — must match package.json "type": "module"

## Task T4: Integration Tests (2026-06-15)
- `toHaveProperty` with dot-containing keys needs array form: `toHaveProperty(["experimental.chat.system.transform"])` — plain string treats dots as nested paths.
- Bun spy API: `spyOn` returns Mock with `.mock.calls` (not `.calls`). Access args via `mock.calls[i][j]`, not `.mock.calls[i].arguments`.
- Mock context needed for `PluginInput`: minimum fields are `client` (empty obj cast), `project` (Project), `directory`, `worktree`, `experimental_workspace`, `serverUrl`, `$`.
- Model mock needed for system transform hook: full `Model` type with all required fields (id, providerID, api, capabilities, cost, limit, status, options, headers).
- Config mock is lenient — only `model?: string` is minimally needed.
- Integration tests should create fresh spy in each test (no shared afterEach cleanup needed for spy state).
- `bun test --grep <regex>` filters by test name for focused runs.

## Task T3: Quick Category Routing (2026-06-15)
- `omoConfigPath()` uses `process.env.HOME` at runtime (not `homedir()` at import) so tests can override via `process.env.HOME = tmpDir` — critical for test isolation
- Config hook `(input: Config) => Promise<void>` mutates the in-memory Config — use `Record<string, unknown>` cast to set custom properties like `experimental.category_routing`
- Dynamic import (`await import("./patterns/quick-routing.js")`) works for conditional hook registration — resolved at plugin init, not at hook invocation
- `safeHook` wrapper from index.ts provides catch-all error boundary — hook functions don't need their own try/catch
- Console prefix `[token-optimizer]` for all warnings
- `quick` category uses `opencode/mimo-v2.5-free` model (cheap/fast) — verified from oh-my-openagent.json
- Routing rules: `maxPromptChars=100`, 4 patterns (`fix typo`, `rename`, `update comment`, `bump version`)
- Test helpers must write to `~/.config/opencode/oh-my-openagent.json` (not just `~/oh-my-openagent.json`) to match the hook's path resolution
- `mkdirSync(targetDir, { recursive: true })` needed for nested `.config/opencode/` directory creation

## Task T5: System Prompt Transformer (2026-06-15)
- `experimental.chat.system.transform` hook pushes to `output.system[]` — each string becomes a segment of the system prompt
- Transformer function takes config as third param (not curried) — simplest approach; index.ts wraps with `configManager.getConfig()`
- Dynamic import pattern consistent with T3: `await import("./patterns/system-prompt.js")` for conditional hook registration
- XML markers `<token_optimizer_guidance pattern="...">` wrap each guidance block with distinct pattern attribute
- Ordering: precisePrompts → preComputationGuidance → cutExploreAgent (deterministic append order)
- Safety guard in transformer: warns if called with no relevant patterns enabled (defensive, since index.ts already gates registration)
- `expect.stringContaining()` matcher useful for asserting partial content in array elements
- Integration test for "all hooks complete" needed updating from T5 stub — now verifies guidance blocks are appended for each enabled pattern

## Task T10: Anti-Duplication Guard (2026-06-15)
- `tool()` from `@opencode-ai/plugin/tool` creates tool definitions with Zod schemas via `tool.schema.*`
- Combined import syntax works: `import { type Plugin, type Config, tool } from "@opencode-ai/plugin"` — `type` prefix scopes to individual specifiers only
- `hooks.tool` must be an object with tool name keys and `ToolDefinition` values
- When multiple features register tools (T9 + T10), use spread: `{ ...(typeof hooks.tool === "object" ? ... : {}), track_task: ..., check_duplicate: ... }`
- Simple word overlap > 50% is sufficient for duplicate detection — no need for NLP
- Stop words: "the", "a", "an", "in", "to", "for", "of", "and", "or", "is", "are"
- `_resetTaskRegistry()` provides session isolation for testing by clearing the in-memory Map
- Integration test for "tools not registered when disabled" validates config gating via ConfigManager directly (hard to test plugin reinit with different config in same process)
- Evidence files: task-10-duplicate-detected.txt, task-10-different-tasks.txt, task-10-session-isolation.txt

## Task T9: Single-Concern Delegation Validator (2026-06-15)
- Keyword-based heuristic: split prompt on `AND`, `ALSO` (all-caps only), `additionally`, `meanwhile`, `separately`
- Regex without `i` flag for `AND`/`ALSO` prevents false splits on lowercase "and"/"also"
- Adverb forms need capitalized variants: `additionally|Additionally` — sentences can start with them
- `extractConcerns()` returns segments from delimiter split; single-segment = no delimiters found = valid
- `summarizeConcern()` prioritises: file paths → function references (`word(`) → first phrase
- `tool()` registration in index.ts using `tool.schema` for zod args (avoids direct zod import)
- When T9 + T10 both enabled, `hooks.tool` uses spread merge to avoid overwriting tools
- `tool.schema` is available at runtime (`tool.schema = z`) — safe to use `toolFn.schema.string()`
- Integration test for tool registration reused mockPluginInput pattern from integration.test.ts
- Evidence files: task-9-single-concern.txt, task-9-multi-concern.txt, task-9-tool-disabled.txt

## Task T11: Complexity Classifier (2026-06-15)
- Pure rule-based classifier: no ML, no external APIs, ~115 lines of logic
- Simple detection: < 100 chars + no file refs + action verb match (fix, rename, update, etc.)
- Complex detection: > 500 chars OR 3+ file refs OR 2+ question marks OR complex signal words
- Safety: defaults to 'medium' when uncertain — never defaults to 'complex'
- Token estimation: `Math.ceil(wordCount * 1.3)` — simple heuristic, not a real tokenizer
- File ref regex: matches paths with common extensions (ts, js, py, go, etc.)
- tools.ts wiring: `classifyComplexity` import placed at top, thin wrapper delegates to complexity.ts
- Build: `tsc` errors are pre-existing in index.ts (tool undefined), my files have zero TS errors

## Documentation: README.md + CONFIGURATION.md (2026-06-15)
- README.md covers: overview, installation (npm + local), quick start, 6-pattern reference table, per-pattern detail sections, verification steps, oh-my-openagent compatibility, troubleshooting table
- CONFIGURATION.md covers: file location (~/.config/opencode/token-optimizer.json), full PluginConfig schema with types/defaults/descriptions, 5 example config files (all enabled, minimal custom, system-prompt-only, tools-only, all disabled), pattern grouping by extension point, error handling behavior
- Used source files directly for accuracy: quick-routing.ts (maxPromptChars=100, 4 routing patterns), system-prompt.ts (3 guidance blocks with XML markers), tools.ts (4 tool registrations + keyword heuristics), complexity.ts (rule-based classifier, 3 tiers)
- No emoji used per project style guide
- Professional technical writing tone, no AI-slop phrases

## Task T12: Token Savings Measurement Script (2026-06-15)
- `import.meta.dir` available in Bun for script-relative path resolution
- Bun resolves `.js` imports to `.ts` files natively (moduleResolution: bundler)
- `fs.mkdirSync(dir, { recursive: true })` works for nested dir creation
- `classifyComplexity` classifies "fix typo" prompts as `simple`, "refactor"/"analyze" as `medium`/`complex`
- `estimateTokens` returns small numbers (12-21) for short prompts — realistic task costs are orders of magnitude larger (2K-89K)
- Weighted total savings target (≥25%) passed at 39.3%
- Evidence output: table with per-scenario + weighted total appended to .sisyphus/evidence/task-12-token-savings-results.txt
- Script location: `scripts/measure-token-savings.ts`, run with `bun run scripts/measure-token-savings.ts`
- 5 scenarios cover all 3 complexity classes (simple, medium, complex) and diverse task types (typo fix, feature add, refactor, grep, analysis)
