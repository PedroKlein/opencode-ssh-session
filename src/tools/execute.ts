import { tool } from "@opencode-ai/plugin"
import { executeCommand, isAlive } from "../session/commands"
import type { SessionManager } from "../session/manager"
import { withMutex } from "../session/mutex"

const DEFAULT_TIMEOUT = 120_000

export function createExecuteTool(sessions: SessionManager) {
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
    async execute(args, context) {
      const state = sessions.peek(context.sessionID)
      if (!state || !isAlive(state)) {
        return "No active SSH session. Use ssh_connect to establish a connection first."
      }

      await context.ask({
        permission: "bash",
        patterns: [args.command],
        always: [args.command],
        metadata: { host: state.host },
      })

      try {
        return await withMutex(state, () =>
          executeCommand(state, args.command, args.timeout ?? DEFAULT_TIMEOUT, context.abort),
        )
      } catch (error) {
        sessions.remove(context.sessionID)
        throw error
      }
    },
  })
}
