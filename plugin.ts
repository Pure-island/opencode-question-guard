import { readFile } from "node:fs/promises"
import { basename } from "node:path"
import type { Hooks, Plugin } from "@opencode-ai/plugin"

type RuntimeReminderConfig = {
  enabled?: boolean
  disableForWorkspacePrefixes?: string[]
  systemReminder?: string | string[]
  toolInjection?: {
    question?: {
      enabled?: boolean
      appendToQuestion?: string | string[]
    }
  }
}

type SystemTransformOutput = {
  system?: string[]
}

type QuestionItem = {
  question?: unknown
}

type QuestionToolInput = {
  questions?: QuestionItem[]
}

const DEFAULT_REMINDER = [
  "[Runtime Reminder]",
  "Use the question tool for user-facing questions and follow-up prompts.",
  "Do not ask user-facing questions in plain text.",
].join("\n")

const DEFAULT_CONFIG: RuntimeReminderConfig = {
  enabled: true,
  disableForWorkspacePrefixes: ["Auto"],
  systemReminder: DEFAULT_REMINDER,
  toolInjection: {
    question: {
      enabled: true,
      appendToQuestion: DEFAULT_REMINDER,
    },
  },
}

const toText = (value: string | string[] | undefined) => {
  if (!value) return ""
  return Array.isArray(value) ? value.join("\n") : value
}

const pickWorkspacePath = (directory?: string, worktree?: string) => {
  const candidates = [directory, worktree]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim())
    .filter((value) => value !== "/" && value !== "\\")

  if (candidates.length === 0) return ""

  return candidates.sort((a, b) => b.length - a.length)[0]
}

const mergeConfig = (loaded: RuntimeReminderConfig | null): RuntimeReminderConfig => {
  if (!loaded) return DEFAULT_CONFIG

  return {
    enabled: loaded.enabled ?? DEFAULT_CONFIG.enabled,
    disableForWorkspacePrefixes: loaded.disableForWorkspacePrefixes ?? DEFAULT_CONFIG.disableForWorkspacePrefixes,
    systemReminder: loaded.systemReminder ?? DEFAULT_CONFIG.systemReminder,
    toolInjection: {
      question: {
        ...(DEFAULT_CONFIG.toolInjection?.question ?? {}),
        ...(loaded.toolInjection?.question ?? {}),
      },
    },
  }
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

export const RuntimeQuestionReminderPlugin: Plugin = async (pluginInput) => {
  const config = await loadConfig()
  const workspacePath = pickWorkspacePath(pluginInput.directory, pluginInput.worktree)
  const workspaceName = basename(workspacePath)
  const disabledPrefixes = config.disableForWorkspacePrefixes ?? []
  const disabledByWorkspace = disabledPrefixes.some((prefix) => workspaceName.startsWith(prefix))
  const pluginEnabled = config.enabled !== false && !disabledByWorkspace
  const systemReminder = toText(config.systemReminder).trim()
  const questionInjectionEnabled = config.toolInjection?.question?.enabled !== false
  const questionAppendText = toText(config.toolInjection?.question?.appendToQuestion).trim()

  return {
    "experimental.chat.system.transform": async (_input: unknown, output: SystemTransformOutput) => {
      if (!pluginEnabled) return
      if (!systemReminder) return

      if (!Array.isArray(output.system)) {
        output.system = []
      }

      output.system.push(systemReminder)
    },

    "tool.execute.before": async (
      input: { tool?: unknown },
      output: { args?: { questions?: QuestionItem[] } },
    ) => {
      if (!pluginEnabled) return

      const toolName = input?.tool
      if (toolName !== "question") return
      if (!questionInjectionEnabled) return
      if (!questionAppendText) return

      const questions = output?.args?.questions
      if (!Array.isArray(questions)) return

      for (const item of questions) {
        if (typeof item?.question !== "string") continue
        if (item.question.endsWith(questionAppendText)) continue
        item.question = `${item.question}\n\n${questionAppendText}`
      }
    },
  } as Hooks
}

export default RuntimeQuestionReminderPlugin
