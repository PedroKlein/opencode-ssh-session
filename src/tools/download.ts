import { tool } from "@opencode-ai/plugin"
import { executeCommand, isAlive } from "../session/commands"
import type { SessionManager } from "../session/manager"
import { withMutex } from "../session/mutex"
import { shellQuote } from "../session/shell"
import { authorizeTransfer } from "./permissions"

const DOWNLOAD_TIMEOUT = 120_000

export function createDownloadTool(sessions: SessionManager) {
  return tool({
    description:
      "Download a file from the remote host to the local machine through the active SSH session. " +
      "Uses base64 encoding to transfer the file content over the existing connection. " +
      "Requires ssh_connect to have been called first.",
    args: {
      remotePath: tool.schema.string().describe("Path to the file on the remote host"),
      localPath: tool.schema.string().describe("Destination path on the local machine"),
    },
    async execute(args, context) {
      const state = sessions.get(context.sessionID)
      if (!isAlive(state) || !state.host) {
        return "No active SSH session. Use ssh_connect to establish a connection first."
      }

      const localPath = await authorizeTransfer(context, {
        host: state.host,
        localPath: args.localPath,
        localPermission: "edit",
        remotePath: args.remotePath,
        remotePermission: "read",
      })

      return withMutex(state, async () => {
        // Check remote file exists
        const remotePath = shellQuote(args.remotePath)
        const checkResult = await executeCommand(
          state,
          `test -f ${remotePath} && echo "EXISTS" || echo "NOT_FOUND"`,
          DOWNLOAD_TIMEOUT,
        )
        if (checkResult.trim() === "NOT_FOUND") {
          return `Remote file not found: ${args.remotePath}`
        }

        // Base64-encode on remote and capture output
        const b64Result = await executeCommand(state, `base64 < ${remotePath}`, DOWNLOAD_TIMEOUT)
        if (b64Result.includes("[exit code:")) {
          return `Failed to read remote file: ${b64Result}`
        }

        // Decode and write locally
        const cleaned = b64Result.replace(/\s/g, "")
        const bytes = Buffer.from(cleaned, "base64")

        await Bun.write(localPath, bytes)

        return `Downloaded ${state.host}:${args.remotePath} to ${args.localPath} (${bytes.byteLength} bytes)`
      })
    },
  })
}
