import { sendMarkerCommand, waitForMarker } from "./commands"
import { startReader } from "./reader"
import type { SessionState } from "./state"

/**
 * Spawn an SSH process and perform the initial handshake.
 */
export async function spawnSSH(
  state: SessionState,
  host: string,
  options?: string,
  signal?: AbortSignal,
): Promise<string> {
  const sshArgs = ["ssh", "-T", "-o", "ServerAliveInterval=60", "-o", "ServerAliveCountMax=3"]

  if (options) {
    const extra = options.trim().split(/\s+/)
    sshArgs.push(...extra)
  }

  sshArgs.push(host, "bash", "-l")

  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error("SSH operation aborted.")
  }

  state.proc = Bun.spawn(sshArgs, {
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  })
  state.host = host
  state.buffer = ""
  state.readerDone = false

  // start background reader
  startReader(state, state.proc.stdout as ReadableStream<Uint8Array>)

  // initial handshake: consume any MOTD/banner
  const handshakeId = Math.random().toString(36).substring(2, 10)
  sendMarkerCommand(state, "true", handshakeId)

  try {
    await waitForMarker(state, handshakeId, 30000, signal)
    state.connectedAt = Date.now()
  } catch (err) {
    killSSH(state)
    const errorMsg = err instanceof Error ? err.message : String(err)
    throw new Error(`Failed to establish SSH session to ${host}: ${errorMsg}`)
  }

  return `Connected to ${host}. Shell state will persist between commands.`
}

/**
 * Kill the SSH process and reset all state.
 */
export function killSSH(state: SessionState): string {
  const prevHost = state.host

  state.pendingReject?.(new Error("SSH connection closed."))
  if (state.proc) {
    try {
      state.proc.kill()
    } catch {
      // ignore kill errors
    }
  }

  state.proc = null
  state.host = null
  state.connectedAt = null
  state.buffer = ""
  state.readerDone = true
  state.pendingResolve = null
  state.pendingReject = null
  state.currentMarkerId = ""
  return prevHost ? `Disconnected from ${prevHost}.` : "No active SSH session."
}
