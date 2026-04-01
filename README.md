# Runtime Reminder Plugin

Runtime injection plugin for OpenCode. It appends configurable reminder text during interaction, with a primary focus on encouraging `question` tool usage for user-facing follow-ups.

## Files

- `plugin.ts`: plugin implementation.
- `runtime-reminder.config.json`: active config used by the plugin.
- `runtime-reminder.config.all-hooks.example.json`: full-coverage sample config for all documented hooks/events.
- `README.zh-CN.md`: Chinese usage guide.

## How It Works

This plugin uses a queue-based injection model:

1. It loads `runtime-reminder.config.json` from the same directory as `plugin.ts`.
2. It listens for runtime events via `event` hook.
3. If an event type is in `enabledHooks`, it enqueues `messagesByHook[eventType]`.
4. It listens to `tool.execute.after` and can enqueue extra reminder text when the tool matches `toolAfterTrigger.tools`.
5. On `tui.prompt.append`, it injects:
   - the base reminder (`messagesByHook["tui.prompt.append"]`) if enabled
   - all queued messages accumulated from previous hook triggers
6. Injection target is selected by `targets` priority (`prompt` -> `text` -> `messages`).

## Configuration Reference

All config lives in `runtime-reminder.config.json`.

### `enabledHooks`

- Type: `string[]`
- Purpose: allowlist of hook/event names that are allowed to enqueue reminder text.
- Notes:
  - Include `tui.prompt.append` if you want base reminder injection each turn.
  - Include `tool.execute.after` if you want tool-based reinforcement.

Example:

```json
{
  "enabledHooks": ["tui.prompt.append", "tool.execute.after", "message.updated"]
}
```

### `messagesByHook`

- Type: `Record<string, string | string[]>`
- Purpose: map each hook/event name to injected reminder content.
- Behavior:
  - `string[]` is joined with newline.
  - Empty or missing message is ignored.

Example:

```json
{
  "messagesByHook": {
    "tui.prompt.append": [
      "[Runtime Reminder]",
      "Use question tool for follow-ups."
    ],
    "message.updated": "A message changed; verify whether question follow-up is needed."
  }
}
```

### `targets`

- Type: `Array<"prompt" | "text" | "messages">`
- Purpose: output mutation priority.
- Behavior:
  - Plugin tries each target in order.
  - First usable target wins.
  - If none matches, falls back to `output.prompt`.

Example:

```json
{
  "targets": ["prompt", "text", "messages"]
}
```

### `toolAfterTrigger`

- Type: object
- Purpose: enqueue post-tool reminder from `tool.execute.after`.

Fields:

- `enabled` (`boolean`): turns this feature on/off.
- `tools` (`string[]`): tool allowlist, for example `"question"`.
- `message` (`string | string[]`): reminder text to enqueue when tool matches.

Example:

```json
{
  "toolAfterTrigger": {
    "enabled": true,
    "tools": ["question"],
    "message": [
      "[Post-Question Reminder]",
      "Keep using question tool for user-facing follow-ups."
    ]
  }
}
```

## Usage Patterns

### Pattern A: Minimal Question Guidance

- Enable only `tui.prompt.append` and `tool.execute.after`.
- Keep `toolAfterTrigger.tools` as `["question"]`.
- Suitable for lightweight behavior steering.

### Pattern B: Event-Driven Reinforcement

- Add events like `message.updated`, `session.updated`, `permission.asked`.
- Provide short, event-specific reminders in `messagesByHook`.
- Suitable when you want context-sensitive reinforcement.

### Pattern C: All-Hooks Lab Mode

- Start from `runtime-reminder.config.all-hooks.example.json`.
- Remove hooks/messages not needed for your environment.
- Suitable for experimentation and tuning.

## Installation

### Global Installation

1. Copy `plugin.ts` to `~/.config/opencode/plugins/runtime-reminder.ts`.
2. Copy your chosen config to `~/.config/opencode/plugins/runtime-reminder.config.json`.
3. Restart OpenCode.

### Project Installation

1. Copy `plugin.ts` to `.opencode/plugins/runtime-reminder.ts`.
2. Copy your chosen config to `.opencode/plugins/runtime-reminder.config.json`.
3. Restart the session in that project.

## Notes

- This folder is a template package and is not auto-installed.
- If config loading fails, plugin falls back to built-in defaults.
- Plugin scope is runtime prompt injection only; it does not change your codebase or permission model.
