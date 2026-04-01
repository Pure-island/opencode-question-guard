# Runtime Reminder Plugin（中文说明）

这是一个 OpenCode 运行时注入插件。它会在交互过程中按配置注入提醒文本，主要用于强化“用户向提问与后续追问优先使用 `question` 工具”的行为。

## 文件结构

- `plugin.ts`：插件实现。
- `runtime-reminder.config.json`：当前生效配置。
- `runtime-reminder.config.all-hooks.example.json`：覆盖所有文档钩子/事件的样例配置。
- `README.md`：英文说明。

## 工作机制

插件采用“队列注入”模型：

1. 启动时读取与 `plugin.ts` 同目录的 `runtime-reminder.config.json`。
2. 通过 `event` 钩子监听事件。
3. 如果事件名在 `enabledHooks` 中，则将 `messagesByHook[eventType]` 入队。
4. 通过 `tool.execute.after` 监听工具执行；当工具名命中 `toolAfterTrigger.tools`（如 `question`）时，追加强化提醒入队。
5. 在 `tui.prompt.append` 阶段统一注入：
   - 基础提醒（`messagesByHook["tui.prompt.append"]`）
   - 所有排队消息（由其他钩子触发）
6. 注入目标按 `targets` 顺序选择（`prompt` -> `text` -> `messages`）。

## 配置项说明

配置文件：`runtime-reminder.config.json`

### `enabled`

- 类型：`boolean`
- 作用：插件总开关。
- 行为：
  - `true`（默认）：插件正常执行注入。
  - `false`：插件在所有钩子中直接返回，不进行任何注入。

示例：

```json
{
  "enabled": false
}
```

### `enabledHooks`

- 类型：`string[]`
- 作用：允许哪些钩子/事件触发入队。
- 说明：
  - 想每轮都注入基础提醒，请包含 `tui.prompt.append`。
  - 想按工具调用强化，请包含 `tool.execute.after`。

示例：

```json
{
  "enabledHooks": ["tui.prompt.append", "tool.execute.after", "message.updated"]
}
```

### `messagesByHook`

- 类型：`Record<string, string | string[]>`
- 作用：按钩子/事件定义注入文本。
- 说明：
  - `string[]` 会自动按换行拼接。
  - 空文本会被忽略。

示例：

```json
{
  "messagesByHook": {
    "tui.prompt.append": [
      "[Runtime Reminder]",
      "用户向追问请优先使用 question 工具"
    ],
    "message.updated": "消息有更新，请检查是否需要 question 工具续问"
  }
}
```

### `targets`

- 类型：`Array<"prompt" | "text" | "messages">`
- 作用：注入目标优先级。
- 行为：
  - 按顺序尝试写入。
  - 命中第一个可用目标即停止。
  - 都不可用时回退到 `output.prompt`。

示例：

```json
{
  "targets": ["prompt", "text", "messages"]
}
```

### `toolAfterTrigger`

- 类型：对象
- 作用：在 `tool.execute.after` 阶段按工具名触发额外提醒。

字段：

- `enabled`（`boolean`）：是否开启。
- `tools`（`string[]`）：工具白名单（如 `"question"`）。
- `message`（`string | string[]`）：触发后入队文本。

示例：

```json
{
  "toolAfterTrigger": {
    "enabled": true,
    "tools": ["question"],
    "message": [
      "[Post-Question Reminder]",
      "已调用 question 工具，后续仍应保持 question 流程"
    ]
  }
}
```

## 常用使用模式

### 模式 A：最小 question 强化

- `enabledHooks` 仅保留 `tui.prompt.append` + `tool.execute.after`
- `toolAfterTrigger.tools` 保持 `["question"]`

### 模式 B：事件驱动强化

- 增加 `message.updated`、`session.updated`、`permission.asked` 等
- 在 `messagesByHook` 中写短句提醒

### 模式 C：全钩子实验模式

- 以 `runtime-reminder.config.all-hooks.example.json` 为起点
- 删除不需要的钩子与文案

## 安装方式

### 全局安装

1. 复制 `plugin.ts` 到 `~/.config/opencode/plugins/runtime-reminder.ts`
2. 复制配置到 `~/.config/opencode/plugins/runtime-reminder.config.json`
3. 重启 OpenCode

### 项目安装

1. 复制 `plugin.ts` 到 `.opencode/plugins/runtime-reminder.ts`
2. 复制配置到 `.opencode/plugins/runtime-reminder.config.json`
3. 重启该项目会话

## 备注

- 本目录是模板包，不会自动安装。
- 若配置读取失败，会回退到内置默认配置。
- 插件只做运行时提醒注入，不会修改代码库或权限模型。
