import type { Plugin } from "@opencode-ai/plugin"
import { createBashGuard } from "./hooks/bash-guard"
import { createSessionEvents } from "./hooks/session-events"
import { createState } from "./session/state"
import { createConnectTool } from "./tools/connect"
import { createDisconnectTool } from "./tools/disconnect"
import { createDownloadTool } from "./tools/download"
import { createExecuteTool } from "./tools/execute"
import { createInfoTool } from "./tools/info"
import { createUploadTool } from "./tools/upload"

export const SSHSession: Plugin = async () => {
  const state = createState()

  return {
    tool: {
      ssh_connect: createConnectTool(state),
      ssh: createExecuteTool(state),
      ssh_disconnect: createDisconnectTool(state),
      ssh_info: createInfoTool(state),
      ssh_upload: createUploadTool(state),
      ssh_download: createDownloadTool(state),
    },
    event: createSessionEvents(state),
    "tool.execute.before": createBashGuard(state),
  }
}

export default SSHSession
