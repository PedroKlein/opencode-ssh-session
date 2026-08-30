import type { Event } from "@opencode-ai/sdk"
import type { SessionManager } from "../session/manager"

export function createSessionEvents(sessions: SessionManager) {
  return async (input: { event: Event }) => {
    const { event } = input

    if (event.type === "session.deleted") {
      sessions.remove(event.properties.info.id)
      return
    }

    if (event.type === "session.error" && event.properties.sessionID) {
      sessions.remove(event.properties.sessionID)
    }
  }
}
