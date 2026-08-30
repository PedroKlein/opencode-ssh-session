import { markerRegex } from "./marker"
import type { SessionState } from "./state"

export function checkBuffer(state: SessionState): void {
  if (!state.currentMarkerId || !state.pendingResolve) return

  const pattern = markerRegex(state.currentMarkerId)
  const match = state.buffer.match(pattern)
  if (match) {
    const markerIndex = state.buffer.indexOf(match[0])
    const output = state.buffer.substring(0, markerIndex)
    state.buffer = state.buffer.substring(markerIndex + match[0].length)
    const exitCode = parseInt(match[1], 10)
    state.pendingResolve({ output: output.trim(), exitCode })
  }
}

export async function startErrorReader(
  state: SessionState,
  stream: ReadableStream<Uint8Array>,
): Promise<void> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      state.stderr = (state.stderr + decoder.decode(value, { stream: true })).slice(-65_536)
    }
  } catch {
    // stream closed or errored
  }
}

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
    state.pendingReject?.(new Error("SSH connection dropped while waiting for command output."))
  }
}
