import { tool } from "@opencode-ai/plugin"
import { killSSH } from "../session/connection"
import type { SessionState } from "../session/state"

export function createDisconnectTool(state: SessionState) {
  return tool({
    description:
      "Close the active persistent SSH session. " +
      "Shell state is lost. You can reconnect later with ssh_connect.",
    args: {},
    async execute() {
      return killSSH(state)
    },
  })
}
