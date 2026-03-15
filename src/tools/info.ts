import { tool } from "@opencode-ai/plugin"
import { isAlive } from "../session/commands"
import type { SessionState } from "../session/state"

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function createInfoTool(state: SessionState) {
  return tool({
    description:
      "Get information about the current SSH session. " +
      "Returns the connected host, session duration, and whether the session is alive. " +
      "Use this to check connection status before running commands.",
    args: {},
    async execute() {
      if (!isAlive(state) || !state.host) {
        return "No active SSH session."
      }

      const duration = state.connectedAt
        ? formatDuration(Date.now() - state.connectedAt)
        : "unknown"
      const queueLength = state.commandQueue.length
      const busy = state.running ? "yes" : "no"

      return [
        `Host: ${state.host}`,
        `Connected: ${duration}`,
        `Busy: ${busy}`,
        queueLength > 0 ? `Queued commands: ${queueLength}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    },
  })
}
