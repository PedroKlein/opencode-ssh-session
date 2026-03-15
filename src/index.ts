import type { Plugin } from "@opencode-ai/plugin"
import { createState } from "./session/state"
import { createConnectTool } from "./tools/connect"
import { createDisconnectTool } from "./tools/disconnect"
import { createExecuteTool } from "./tools/execute"

export const SSHSession: Plugin = async () => {
  const state = createState()

  return {
    tool: {
      ssh_connect: createConnectTool(state),
      ssh: createExecuteTool(state),
      ssh_disconnect: createDisconnectTool(state),
    },
  }
}

export default SSHSession
