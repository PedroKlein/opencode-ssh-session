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
): Promise<{ output: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    state.currentMarkerId = id
    state.pendingResolve = resolve
    state.pendingReject = reject

    // check immediately in case it's already in the buffer
    checkBuffer(state)

    const timer = setTimeout(() => {
      if (state.currentMarkerId === id) {
        state.pendingResolve = null
        state.pendingReject = null
        state.currentMarkerId = ""
        reject(new Error(`Command timed out after ${timeout}ms`))
      }
    }, timeout)

    // wrap the original resolve/reject to clear the timer
    const origResolve = state.pendingResolve
    state.pendingResolve = (result) => {
      clearTimeout(timer)
      origResolve?.(result)
    }
    const origReject = state.pendingReject
    state.pendingReject = (err) => {
      clearTimeout(timer)
      origReject?.(err)
    }
  })
}

/**
 * Execute a command on the active SSH session and return its output.
 */
export async function executeCommand(
  state: SessionState,
  command: string,
  timeout: number,
): Promise<string> {
  if (!isAlive(state)) {
    return "No active SSH session. Use ssh_connect to establish a connection first."
  }

  const id = Math.random().toString(36).substring(2, 10)
  sendMarkerCommand(state, command, id)

  const result = await waitForMarker(state, id, timeout)

  if (result.exitCode !== 0) {
    return `${result.output}\n[exit code: ${result.exitCode}]`
  }
  return result.output
}

/**
 * Check if the SSH process is alive.
 */
export function isAlive(state: SessionState): boolean {
  return state.proc !== null && !state.readerDone
}
