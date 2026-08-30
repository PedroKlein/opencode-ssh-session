import { killSSH } from "./connection"
import { createState, type SessionState } from "./state"

export interface SessionManager {
  get(sessionID: string): SessionState
  peek(sessionID: string): SessionState | undefined
  remove(sessionID: string): string
  replace(sessionID: string): SessionState
  dispose(): void
}

export function createSessionManager(): SessionManager {
  const sessions = new Map<string, SessionState>()

  function remove(sessionID: string): string {
    const state = sessions.get(sessionID)
    if (!state) return "No active SSH session."
    sessions.delete(sessionID)
    return killSSH(state)
  }

  return {
    get(sessionID) {
      let state = sessions.get(sessionID)
      if (!state) {
        state = createState()
        sessions.set(sessionID, state)
      }
      return state
    },
    peek(sessionID) {
      return sessions.get(sessionID)
    },
    remove,
    replace(sessionID) {
      remove(sessionID)
      const state = createState()
      sessions.set(sessionID, state)
      return state
    },
    dispose() {
      for (const sessionID of sessions.keys()) remove(sessionID)
    },
  }
}
