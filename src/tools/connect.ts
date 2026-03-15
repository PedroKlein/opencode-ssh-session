import { tool } from "@opencode-ai/plugin"
import { isAlive } from "../session/commands"
import { killSSH, spawnSSH } from "../session/connection"
import { withMutex } from "../session/mutex"
import type { SessionState } from "../session/state"

export function createConnectTool(state: SessionState) {
  return tool({
    description:
      "Open a persistent SSH session to a remote host. " +
      "Once connected, use the `ssh` tool to run commands — " +
      "shell state (cd, env vars, etc.) persists between calls. " +
      "Use `ssh_disconnect` to close the session when done.",
    args: {
      host: tool.schema
        .string()
        .describe("SSH host to connect to (e.g. 'user@server', 'myalias', 'user@192.168.1.10')"),
      options: tool.schema
        .string()
        .optional()
        .describe("Extra SSH flags (e.g. '-p 2222', '-i ~/.ssh/mykey')"),
    },
    async execute(args) {
      if (isAlive(state) && state.host === args.host) {
        return `Already connected to ${args.host}.`
      }

      if (isAlive(state) && state.host !== args.host) {
        killSSH(state)
      }

      return withMutex(state, () => spawnSSH(state, args.host, args.options))
    },
  })
}
