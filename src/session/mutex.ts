import type { SessionState } from "./state"

/**
 * Ensure only one command runs at a time on the SSH session.
 * Additional calls are queued and executed in order.
 */
export async function withMutex<T>(state: SessionState, fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = async () => {
      state.running = true
      try {
        resolve(await fn())
      } catch (e) {
        reject(e)
      } finally {
        state.running = false
        const next = state.commandQueue.shift()
        if (next) next()
      }
    }

    if (state.running) {
      state.commandQueue.push(run)
    } else {
      run()
    }
  })
}
