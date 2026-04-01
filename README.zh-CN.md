# Runtime Reminder Plugin（中文说明）

这是一个 OpenCode 运行时提醒插件。它会在两个时机立即修改上下文：

- 每次模型请求前，通过系统提示注入可配置提醒。
- 在 `question` 工具执行前，立即把可配置文本追加到每个 `output.args.questions[].question` 后面。

## 文件结构

- `plugin.ts`：插件实现。
- `runtime-reminder.config.json`：当前生效配置。
- `runtime-reminder.config.all-hooks.example.json`：早期实验阶段遗留的兼容示例文件。
- `README.md`：英文说明。

## 工作机制

### 1. 系统提醒注入

插件使用 `experimental.chat.system.transform`。

每次请求真正发送给模型前，都会把 `systemReminder` 追加到 `output.system`。

这是给模型看的隐藏提醒路径。

### 2. question 工具即时改写

插件使用 `tool.execute.before`。

当工具名是 `question` 时，会立即修改当前工具入参：

- 读取 `output.args.questions`
- 遍历其中每个带字符串 `question` 的项目
- 把配置里的文本追加到该 `question` 后面
- 如果该 `question` 已经以该文本结尾，则不重复追加

这是工具载荷级别的即时注入路径。

## 配置项说明

配置文件：`runtime-reminder.config.json`

### `enabled`

- 类型：`boolean`
- 作用：插件总开关。
- 行为：
  - `true`：插件生效。
  - `false`：跳过系统注入与工具改写。

示例：

```json
{
  "enabled": false
}
```

### `systemReminder`

- 类型：`string | string[]`
- 作用：注入到 `experimental.chat.system.transform` 的内容。
- 行为：
  - `string[]` 会按换行拼接。
  - 空文本会被忽略。

当前示例：

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

- 类型：`boolean`
- 作用：是否开启 `question` 工具的即时改写。

### `toolInjection.question.appendToQuestion`

- 类型：`string | string[]`
- 作用：在 `question` 工具执行时，追加到每个 `output.args.questions[].question` 后面的文本。
- 行为：
  - 文本追加在原问题后面。
  - `string[]` 会按换行拼接。
  - 如果当前问题已经以这段文本结尾，则不会再次追加。

当前示例：

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

## 示例配置

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

## 安装方式

### 全局安装

1. 复制 `plugin.ts` 到 `~/.config/opencode/plugins/runtime-reminder.ts`
2. 复制 `runtime-reminder.config.json` 到 `~/.config/opencode/plugins/runtime-reminder.config.json`
3. 重启 OpenCode

### 项目安装

1. 复制 `plugin.ts` 到 `.opencode/plugins/runtime-reminder.ts`
2. 复制 `runtime-reminder.config.json` 到 `.opencode/plugins/runtime-reminder.config.json`
3. 重启该项目会话

## 备注

- 这个版本不再依赖 `tui.prompt.append`。
- 不再使用跨钩子的共享队列。
- `systemReminder` 会在每次请求前注入。
- `question` 工具改写会在工具执行前立即发生。
- `question` 改写通过 `endsWith(...)` 做末尾去重，避免重复叠加。
