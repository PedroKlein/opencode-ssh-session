import { isAlive } from "../session/commands"
import type { SessionState } from "../session/state"

/**
 * Patterns that suggest the user/AI is trying to run SSH-related operations
 * through the built-in bash tool instead of the plugin's SSH tools.
 */
const SSH_PATTERNS = [/^\s*ssh\s+/, /^\s*scp\s+/, /^\s*sftp\s+/, /^\s*rsync\s+.*:/]

/**
 * Create a `tool.execute.before` hook that detects when the AI uses bash
 * for SSH-like operations and prepends a reminder to use the SSH tools.
 */
export function createBashGuard(state: SessionState) {
  return async (
    input: { tool: string; sessionID: string; callID: string },
    output: { args: Record<string, unknown> },
  ) => {
    if (input.tool !== "bash") return

    const command = typeof output.args.command === "string" ? output.args.command : ""
    if (!command) return

    const isSSHCommand = SSH_PATTERNS.some((p) => p.test(command))
    if (!isSSHCommand) return

    const connected = isAlive(state)
    const hint = connected
      ? "NOTE: You have an active SSH session. Use the `ssh` tool to run commands on the remote host instead of spawning a new ssh process via bash."
      : "NOTE: Use `ssh_connect` to establish a persistent SSH session, then `ssh` to run commands. This preserves shell state between calls and avoids reconnection overhead."

    // Prepend the hint as a comment so it shows up in tool output
    output.args.command = `echo '${hint}' >&2; ${command}`
  }
}
