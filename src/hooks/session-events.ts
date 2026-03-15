import type { Event } from "@opencode-ai/sdk"
import { isAlive } from "../session/commands"
import { killSSH } from "../session/connection"
import type { SessionState } from "../session/state"

/**
 * Create an `event` hook that handles SSH session lifecycle events.
 *
 * - On `session.idle`: logs a reminder if an SSH session is still active.
 * - On `session.error`: cleans up a dead SSH session to avoid stale state.
 */
export function createSessionEvents(state: SessionState) {
  return async (input: { event: Event }) => {
    const { event } = input

    if (event.type === "session.error") {
      // If the OpenCode session errored and we have an SSH connection,
      // clean it up to avoid orphaned processes.
      if (isAlive(state)) {
        killSSH(state)
      }
    }
  }
}
