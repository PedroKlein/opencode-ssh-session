import { sendMarkerCommand, waitForMarker } from "./commands"
import { startReader } from "./reader"
import type { SessionState } from "./state"
import { createState } from "./state"

/**
 * Spawn an SSH process and perform the initial handshake.
 */
export async function spawnSSH(
  state: SessionState,
  host: string,
  options?: string,
): Promise<string> {
  const sshArgs = ["ssh", "-T", "-o", "ServerAliveInterval=60", "-o", "ServerAliveCountMax=3"]

  if (options) {
    const extra = options.trim().split(/\s+/)
    sshArgs.push(...extra)
  }

  sshArgs.push(host, "bash", "-l")

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
    await waitForMarker(state, handshakeId, 30000)
  } catch (err) {
    try {
      state.proc.kill()
    } catch {
      // ignore kill errors
    }
    const errorMsg = err instanceof Error ? err.message : String(err)
    state.proc = null
    state.host = null
    throw new Error(`Failed to establish SSH session to ${host}: ${errorMsg}`)
  }

  return `Connected to ${host}. Shell state will persist between commands.`
}

/**
 * Kill the SSH process and reset all state.
 */
export function killSSH(state: SessionState): string {
  const prevHost = state.host
  if (state.proc) {
    try {
      state.proc.kill()
    } catch {
      // ignore kill errors
    }
  }
  Object.assign(state, createState())
  return prevHost ? `Disconnected from ${prevHost}.` : "No active SSH session."
}
