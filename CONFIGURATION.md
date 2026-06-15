# Configuration

The opencode-token-optimizer plugin is configured through a JSON file. All six patterns are enabled by default, so you only need a config file if you want to customize which patterns are active.

---

## Config File Location

**Default path:** `~/.config/opencode/token-optimizer.json`

If the file does not exist, the plugin uses defaults (all patterns enabled) and prints a warning:

```
[token-optimizer] Config file not found at ~/.config/opencode/token-optimizer.json, using defaults
```

There is no way to specify a custom path in the current version.

---

## Schema

The config file uses a `patterns` object with six boolean fields:

```json
{
  "patterns": {
    "precisePrompts": true,
    "antiDuplication": true,
    "singleConcernDelegation": true,
    "quickCategoryRouting": true,
    "preComputationGuidance": true,
    "cutExploreAgent": true
  }
}
```

### Field Reference

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `precisePrompts` | boolean | `true` | Injects structured prompting guidelines into the system prompt, teaching the AI to delegate with exact file paths, line ranges, and expected outputs. |
| `antiDuplication` | boolean | `true` | Registers the `track_task` and `check_duplicate` tools for session-scoped duplicate delegation detection using word overlap. |
| `singleConcernDelegation` | boolean | `true` | Registers the `validate_task_scope` tool that checks task prompts for multiple concerns using keyword-based heuristics. |
| `quickCategoryRouting` | boolean | `true` | Activates a config hook that reads `oh-my-openagent.json` and injects quick-category routing rules for trivial tasks. |
| `preComputationGuidance` | boolean | `true` | Injects guidance into the system prompt encouraging the AI to resolve paths and symbols locally before spawning subagents. |
| `cutExploreAgent` | boolean | `true` | Injects guidance into the system prompt and registers the `classify_complexity` tool to discourage expensive explore agent use for simple lookups. |

Each field is optional in the config file. Missing fields default to `true`, so you can enable a subset without listing every field:

```json
{
  "patterns": {
    "cutExploreAgent": false
  }
}
```

The config above disables only Pattern 6; all other patterns remain enabled.

---

## Example Configurations

### All enabled (default)

If you do not create a config file, this is the effective configuration:

```json
{
  "patterns": {
    "precisePrompts": true,
    "antiDuplication": true,
    "singleConcernDelegation": true,
    "quickCategoryRouting": true,
    "preComputationGuidance": true,
    "cutExploreAgent": true
  }
}
```

### Minimal custom config

Disable quick category routing (if you don't use oh-my-openagent) and the cut explore agent pattern (if your work is mostly cross-file synthesis):

```json
{
  "patterns": {
    "quickCategoryRouting": false,
    "cutExploreAgent": false
  }
}
```

### System prompt only

Enable only the patterns that inject guidance into the system prompt, disabling all tools:

```json
{
  "patterns": {
    "precisePrompts": true,
    "antiDuplication": false,
    "singleConcernDelegation": false,
    "quickCategoryRouting": false,
    "preComputationGuidance": true,
    "cutExploreAgent": true
  }
}
```

### Tools only

Enable only the custom tools, disabling all system prompt modifications:

```json
{
  "patterns": {
    "precisePrompts": false,
    "antiDuplication": true,
    "singleConcernDelegation": true,
    "quickCategoryRouting": false,
    "preComputationGuidance": false,
    "cutExploreAgent": false
  }
}
```

### All disabled

If you ever need to temporarily disable the plugin without removing it from your opencode.json:

```json
{
  "patterns": {
    "precisePrompts": false,
    "antiDuplication": false,
    "singleConcernDelegation": false,
    "quickCategoryRouting": false,
    "preComputationGuidance": false,
    "cutExploreAgent": false
  }
}
```

---

## Pattern Grouping Reference

The six patterns map to three distinct OpenCode extension points. Understanding this helps you predict the effect of enabling or disabling combinations:

| Extension Point | Patterns | Effect When Disabled |
|----------------|----------|---------------------|
| System prompt transformer (`experimental.chat.system.transform`) | precisePrompts, preComputationGuidance, cutExploreAgent | No guidance blocks appended to the system prompt. The AI receives no token-saving instructions. |
| Custom tools (`hooks.tool`) | antiDuplication, singleConcernDelegation | The `track_task`, `check_duplicate`, and `validate_task_scope` tools are not registered. |
| Config hook (`hooks.config`) | quickCategoryRouting | No routing rules injected. All tasks use the default category. |

When you disable all three patterns in a group, that hook is not registered at all (defensive, the plugin checks before importing hook handlers).

---

## Error Handling

The plugin handles configuration errors gracefully:

- **File not found**: logs a warning, uses defaults, continues.
- **Invalid JSON**: logs the parse error with stack trace, uses defaults, continues.
- **Missing field**: defaults to `true` for that pattern.
- **Unknown fields**: ignored, no error.

This means a typo in your config file never crashes the plugin -- the worst case is a pattern you meant to disable stays enabled.
