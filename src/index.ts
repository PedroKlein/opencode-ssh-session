import type { Plugin } from "@opencode-ai/plugin"
import { createBashGuard } from "./hooks/bash-guard"
import { configurePermissions } from "./hooks/config"
import { createSessionEvents } from "./hooks/session-events"
import { createSessionManager } from "./session/manager"
import { createConnectTool } from "./tools/connect"
import { createDisconnectTool } from "./tools/disconnect"
import { createDownloadTool } from "./tools/download"
import { createExecuteTool } from "./tools/execute"
import { createInfoTool } from "./tools/info"
import { createUploadTool } from "./tools/upload"

export const SSHSession: Plugin = async () => {
  const sessions = createSessionManager()

  return {
    tool: {
      ssh_connect: createConnectTool(sessions),
      ssh: createExecuteTool(sessions),
      ssh_disconnect: createDisconnectTool(sessions),
      ssh_info: createInfoTool(sessions),
      ssh_upload: createUploadTool(sessions),
      ssh_download: createDownloadTool(sessions),
    },
    event: createSessionEvents(sessions),
    config: configurePermissions,
    "tool.execute.before": createBashGuard(sessions),
    async dispose() {
      sessions.dispose()
    },
  }
}

export default SSHSession
