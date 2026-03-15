import { tool } from "@opencode-ai/plugin"
import { executeCommand, isAlive } from "../session/commands"
import { withMutex } from "../session/mutex"
import type { SessionState } from "../session/state"

const UPLOAD_TIMEOUT = 120_000

export function createUploadTool(state: SessionState) {
  return tool({
    description:
      "Upload a local file to the remote host through the active SSH session. " +
      "Uses base64 encoding to transfer the file content over the existing connection. " +
      "Requires ssh_connect to have been called first.",
    args: {
      localPath: tool.schema.string().describe("Absolute path to the local file to upload"),
      remotePath: tool.schema.string().describe("Destination path on the remote host"),
    },
    async execute(args) {
      if (!isAlive(state)) {
        return "No active SSH session. Use ssh_connect to establish a connection first."
      }

      const file = Bun.file(args.localPath)
      const exists = await file.exists()
      if (!exists) {
        return `Local file not found: ${args.localPath}`
      }

      const bytes = await file.arrayBuffer()
      const base64 = Buffer.from(bytes).toString("base64")

      // Split into chunks to avoid shell line-length limits
      const chunkSize = 4096
      const chunks: string[] = []
      for (let i = 0; i < base64.length; i += chunkSize) {
        chunks.push(base64.slice(i, i + chunkSize))
      }

      return withMutex(state, async () => {
        // Write base64 chunks to a temp file, then decode
        const tmpFile = `/tmp/.oc_upload_${Date.now()}`
        const initResult = await executeCommand(state, `> ${tmpFile}`, UPLOAD_TIMEOUT)
        if (initResult.includes("[exit code:")) {
          return `Failed to create temp file on remote: ${initResult}`
        }

        for (const chunk of chunks) {
          const result = await executeCommand(
            state,
            `printf '%s' '${chunk}' >> ${tmpFile}`,
            UPLOAD_TIMEOUT,
          )
          if (result.includes("[exit code:")) {
            await executeCommand(state, `rm -f ${tmpFile}`, UPLOAD_TIMEOUT)
            return `Failed to write chunk to remote: ${result}`
          }
        }

        // Decode and move to final destination
        const decodeCmd = `base64 -d ${tmpFile} > '${args.remotePath}' && rm -f ${tmpFile}`
        const decodeResult = await executeCommand(state, decodeCmd, UPLOAD_TIMEOUT)
        if (decodeResult.includes("[exit code:")) {
          await executeCommand(state, `rm -f ${tmpFile}`, UPLOAD_TIMEOUT)
          return `Failed to decode file on remote: ${decodeResult}`
        }

        const sizeBytes = bytes.byteLength
        return `Uploaded ${args.localPath} to ${state.host}:${args.remotePath} (${sizeBytes} bytes)`
      })
    },
  })
}
