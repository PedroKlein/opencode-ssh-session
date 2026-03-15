import { tool } from "@opencode-ai/plugin"
import { executeCommand } from "../session/commands"
import { withMutex } from "../session/mutex"
import type { SessionState } from "../session/state"

const DEFAULT_TIMEOUT = 120_000

export function createExecuteTool(state: SessionState) {
  return tool({
    description:
      "Execute a command on the active persistent SSH session. " +
      "Shell state (cd, exported variables, etc.) persists across calls. " +
      "Requires ssh_connect to have been called first. " +
      "Does NOT support interactive/TUI commands (vim, top, etc.).",
    args: {
      command: tool.schema.string().describe("Shell command to execute on the remote host"),
      timeout: tool.schema
        .number()
        .optional()
        .describe("Timeout in milliseconds (default: 120000 = 2 minutes)"),
    },
    async execute(args) {
      return withMutex(state, () =>
        executeCommand(state, args.command, args.timeout ?? DEFAULT_TIMEOUT),
      )
    },
  })
}
