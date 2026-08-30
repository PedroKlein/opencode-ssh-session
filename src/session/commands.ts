import { MARKER_PREFIX, MARKER_SUFFIX } from "./marker"
import { checkBuffer } from "./reader"
import type { SessionState } from "./state"

/**
 * Write a command to the SSH process stdin, followed by an echo marker for output detection.
 */
export function sendMarkerCommand(state: SessionState, command: string, id: string): void {
  const stdin = state.proc?.stdin as { write(data: string): number; flush(): void }
  const payload =
    `${command} 2>&1\n` + `__oc_ec=$?; echo "${MARKER_PREFIX}${id}_\${__oc_ec}${MARKER_SUFFIX}"\n`
  stdin.write(payload)
  stdin.flush()
}

/**
 * Wait for a marker to appear in the buffer, with a timeout.
 */
export async function waitForMarker(
  state: SessionState,
  id: string,
  timeout: number,
  signal?: AbortSignal,
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    let settled = false
    let timer: ReturnType<typeof setTimeout>

    const cleanup = () => {
      clearTimeout(timer)
      signal?.removeEventListener("abort", onAbort)
      if (state.currentMarkerId !== id) return
      state.pendingResolve = null
      state.pendingReject = null
      state.currentMarkerId = ""
    }
    const complete =
      <T>(callback: (value: T) => void) =>
      (value: T) => {
        if (settled) return
        settled = true
        cleanup()
        callback(value)
      }
    const onAbort = () => {
      const reason = signal?.reason
      complete(reject)(reason instanceof Error ? reason : new Error("SSH operation aborted."))
    }

    state.currentMarkerId = id
    state.pendingResolve = complete(resolve)
    state.pendingReject = complete(reject)
    timer = setTimeout(() => {
      if (state.currentMarkerId === id) {
        state.pendingReject?.(new Error(`Command timed out after ${timeout}ms`))
      }
    }, timeout)
    signal?.addEventListener("abort", onAbort, { once: true })

    if (signal?.aborted) {
      onAbort()
      return
    }
    checkBuffer(state)
  })
}

/**
 * Execute a command on the active SSH session and return its output.
 */
export async function executeCommand(
  state: SessionState,
  command: string,
  timeout: number,
  signal?: AbortSignal,
): Promise<string> {
  if (!isAlive(state)) {
    return "No active SSH session. Use ssh_connect to establish a connection first."
  }
  if (signal?.aborted) {
    throw signal.reason instanceof Error ? signal.reason : new Error("SSH operation aborted.")
  }

  const id = Math.random().toString(36).substring(2, 10)
  sendMarkerCommand(state, command, id)

  const result = await waitForMarker(state, id, timeout, signal)

  if (result.exitCode !== 0) {
    return `${result.output}\n[exit code: ${result.exitCode}]`
  }
  return result.output
}

/**
 * Check if the SSH process is alive.
 */
export function isAlive(state: SessionState | undefined): boolean {
  return state?.proc != null && !state.readerDone
}
