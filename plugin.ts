import { readFile } from "node:fs/promises"

type OutputLike = {
  prompt?: unknown
  text?: unknown
  messages?: unknown
}

type RuntimeReminderConfig = {
  enabledHooks?: string[]
  messagesByHook?: Record<string, string | string[]>
  targets?: Array<"prompt" | "text" | "messages">
  toolAfterTrigger?: {
    enabled?: boolean
    tools?: string[]
    message?: string | string[]
  }
}

const DEFAULT_CONFIG: RuntimeReminderConfig = {
  enabledHooks: ["tui.prompt.append", "tool.execute.after"],
  messagesByHook: {
    "tui.prompt.append": [
      "[Runtime Reminder]",
      "Use the question tool for user-facing questions and follow-up prompts.",
      "Do not ask user-facing questions in plain text.",
    ],
  },
  targets: ["prompt", "text", "messages"],
  toolAfterTrigger: {
    enabled: true,
    tools: ["question"],
    message: [
      "[Post-Question Reminder]",
      "You just used the question tool.",
      "Continue with question-tool-based follow-ups when applicable.",
    ],
  },
}

const toText = (value: string | string[] | undefined): string => {
  if (!value) return ""
  return Array.isArray(value) ? value.join("\n") : value
}

const mergeConfig = (loaded: RuntimeReminderConfig | null): RuntimeReminderConfig => {
  if (!loaded) return DEFAULT_CONFIG

  return {
    enabledHooks: loaded.enabledHooks ?? DEFAULT_CONFIG.enabledHooks,
    messagesByHook: {
      ...(DEFAULT_CONFIG.messagesByHook ?? {}),
      ...(loaded.messagesByHook ?? {}),
    },
    targets: loaded.targets ?? DEFAULT_CONFIG.targets,
    toolAfterTrigger: {
      ...(DEFAULT_CONFIG.toolAfterTrigger ?? {}),
      ...(loaded.toolAfterTrigger ?? {}),
    },
  }
}

const appendToOutput = (output: OutputLike, reminder: string, targets: Array<"prompt" | "text" | "messages">) => {
  const suffix = `\n\n${reminder}`

  for (const target of targets) {
    if (target === "prompt" && typeof output.prompt === "string") {
      output.prompt += suffix
      return
    }

    if (target === "text" && typeof output.text === "string") {
      output.text += suffix
      return
    }

    if (target === "messages" && Array.isArray(output.messages)) {
      ;(output.messages as Array<{ role: string; content: string }>).push({
        role: "system",
        content: reminder,
      })
      return
    }
  }

  output.prompt = reminder
}

const loadConfig = async (): Promise<RuntimeReminderConfig> => {
  try {
    const configUrl = new URL("./runtime-reminder.config.json", import.meta.url)
    const raw = await readFile(configUrl, "utf8")
    const parsed = JSON.parse(raw) as RuntimeReminderConfig
    return mergeConfig(parsed)
  } catch {
    return DEFAULT_CONFIG
  }
}

export const RuntimeQuestionReminderPlugin = async () => {
  const config = await loadConfig()
  const enabledHooks = new Set(config.enabledHooks ?? [])
  const targets = config.targets ?? ["prompt", "text", "messages"]
  const queue: string[] = []

  const enqueue = (text: string | string[] | undefined) => {
    const normalized = toText(text).trim()
    if (!normalized) return
    queue.push(normalized)
  }

  const basePromptReminder = toText(config.messagesByHook?.["tui.prompt.append"]).trim()
  const triggerTools = new Set(config.toolAfterTrigger?.tools ?? [])
  const postToolMessage = config.toolAfterTrigger?.message
  const postToolEnabled = Boolean(config.toolAfterTrigger?.enabled)

  return {
    event: async ({ event }: any) => {
      const eventType = event?.type
      if (!eventType) return

      if (!enabledHooks.has(eventType)) return

      const msg = config.messagesByHook?.[eventType]
      enqueue(msg)
    },

    "tool.execute.after": async (input: any) => {
      if (!enabledHooks.has("tool.execute.after")) return
      if (!postToolEnabled) return

      const toolName = input?.tool
      if (!toolName) return

      if (triggerTools.size > 0 && !triggerTools.has(toolName)) return
      enqueue(postToolMessage)
    },

    "tui.prompt.append": async (_input: any, output: OutputLike) => {
      if (enabledHooks.has("tui.prompt.append") && basePromptReminder) {
        appendToOutput(output, basePromptReminder, targets)
      }

      if (queue.length === 0) return

      const batch = queue.splice(0, queue.length).join("\n\n")
      appendToOutput(output, batch, targets)
    },
  }
}
