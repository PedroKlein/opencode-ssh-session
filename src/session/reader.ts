import { markerRegex } from "./marker"
import type { SessionState } from "./state"

/**
 * Check the buffer for a completed command marker and resolve any pending promise.
 */
export function checkBuffer(state: SessionState): void {
  if (!state.currentMarkerId || !state.pendingResolve) return

  const pattern = markerRegex(state.currentMarkerId)
  const match = state.buffer.match(pattern)
  if (match) {
    const markerIndex = state.buffer.indexOf(match[0])
    const output = state.buffer.substring(0, markerIndex)
    state.buffer = state.buffer.substring(markerIndex + match[0].length)

    const exitCode = parseInt(match[1], 10)
    const resolve = state.pendingResolve
    state.pendingResolve = null
    state.pendingReject = null
    state.currentMarkerId = ""
    resolve({ output: output.trim(), exitCode })
  }
}

/**
 * Start a background reader that consumes stdout and feeds the buffer.
 */
export async function startReader(
  state: SessionState,
  stream: ReadableStream<Uint8Array>,
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      state.buffer += decoder.decode(value, { stream: true })
      checkBuffer(state)
    }
  } catch {
    // stream closed or errored
  } finally {
    state.readerDone = true
    if (state.pendingReject) {
      const reject = state.pendingReject
      state.pendingResolve = null
      state.pendingReject = null
      state.currentMarkerId = ""
      reject(new Error("SSH connection dropped while waiting for command output."))
    }
  }
}
