# Runtime Reminder Plugin

Runtime reminder plugin for OpenCode. It modifies model context in two immediate places:

- Before each model request, it injects a configurable system reminder.
- Before the `question` tool runs, it appends configurable text to every `output.args.questions[].question` entry.

## Files

- `plugin.ts`: plugin implementation.
- `runtime-reminder.config.json`: active config used by the plugin.
- `runtime-reminder.config.all-hooks.example.json`: legacy compatibility example from earlier experiments.
- `README.zh-CN.md`: Chinese usage guide.

## Behavior

### 1. System reminder injection

The plugin uses `experimental.chat.system.transform`.

On every request sent to the model, it appends `systemReminder` to `output.system`.

This is the hidden, model-facing reminder path.

### 2. Immediate question-tool mutation

The plugin uses `tool.execute.before`.

When the tool name is `question`, it mutates the current tool payload immediately:

- it reads `output.args.questions`
- for each item with a string `question`
- it appends configured text to the end of that question
- it skips appending if the question already ends with the configured text

This is the visible, tool-payload mutation path.

## Configuration

All config lives in `runtime-reminder.config.json`.

### `enabled`

- Type: `boolean`
- Purpose: global runtime switch.
- Behavior:
  - `true`: plugin is active.
  - `false`: plugin skips both system injection and tool mutation.

Example:

```json
{
  "enabled": false
}
```

### `disableForWorkspacePrefixes`

- Type: `string[]`
- Purpose: automatically disable the plugin when the current workspace name starts with one of these prefixes.
- Default: `["Auto"]`

Example:

```json
{
  "disableForWorkspacePrefixes": ["Auto", "Tmp"]
}
```

### `systemReminder`

- Type: `string | string[]`
- Purpose: content injected into `experimental.chat.system.transform`.
- Behavior:
  - `string[]` is joined with newline.
  - empty text is ignored.

Current example:

```json
{
  "systemReminder": [
    "[Runtime question tool Reminder]",
    "You MUST use the question tool for user-facing follow-up prompts.",
    "You MUST NOT ask user-facing questions in plain text."
  ]
}
```

### `toolInjection.question.enabled`

- Type: `boolean`
- Purpose: enable or disable immediate mutation of the `question` tool payload.

### `toolInjection.question.appendToQuestion`

- Type: `string | string[]`
- Purpose: text appended to every `output.args.questions[].question` when the `question` tool runs.
- Behavior:
  - text is appended to the end of the existing question
  - `string[]` is joined with newline
  - if the current question already ends with that text, plugin does not append it again

Current example:

```json
{
  "toolInjection": {
    "question": {
      "enabled": true,
      "appendToQuestion": [
        "Continue to strictly follow [Runtime question tool Reminder]."
      ]
    }
  }
}
```

## Example Config

```json
{
  "enabled": true,
  "systemReminder": [
    "[Runtime question tool Reminder]",
    "## Core Objective",
    "Maximize interaction length within a single user request by keeping the conversation alive through the question tool unless the user explicitly asks to stop, end the session, or refuses further interaction."
  ],
  "toolInjection": {
    "question": {
      "enabled": true,
      "appendToQuestion": [
        "Continue to strictly follow [Runtime question tool Reminder]."
      ]
    }
  }
}
```

## Installation

### Global Installation

1. Copy `plugin.ts` to `~/.config/opencode/plugins/runtime-reminder.ts`.
2. Copy `runtime-reminder.config.json` to `~/.config/opencode/plugins/runtime-reminder.config.json`.
3. Restart OpenCode.

### Project Installation

1. Copy `plugin.ts` to `.opencode/plugins/runtime-reminder.ts`.
2. Copy `runtime-reminder.config.json` to `.opencode/plugins/runtime-reminder.config.json`.
3. Restart the session in that project.

## Notes

- This plugin no longer depends on `tui.prompt.append`.
- It no longer uses a queue shared across hooks.
- The system reminder is injected every request.
- The `question` tool mutation happens immediately before that tool executes.
- The `question` mutation is de-duplicated with an `endsWith(...)` check.
- The plugin auto-disables when the workspace name starts with a configured prefix.
