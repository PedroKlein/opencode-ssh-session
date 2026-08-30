import { tool } from "@opencode-ai/plugin"
import type { SessionManager } from "../session/manager"

export function createDisconnectTool(sessions: SessionManager) {
  return tool({
    description:
      "Close the active persistent SSH session. " +
      "Shell state is lost. You can reconnect later with ssh_connect.",
    args: {},
    async execute(_args, context) {
      return sessions.remove(context.sessionID)
    },
  })
}
