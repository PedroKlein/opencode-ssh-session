import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { ToolContext } from "@opencode-ai/plugin"

export function toolContext(sessionID: string): ToolContext {
  return {
    sessionID,
    messageID: `message-${sessionID}`,
    agent: "build",
    directory: process.cwd(),
    worktree: process.cwd(),
    abort: new AbortController().signal,
    metadata() {},
    async ask() {},
  }
}

export interface FakeSSH {
  cleanup(): Promise<void>
  exits(): Promise<string[]>
  spawns(): Promise<string[]>
}

export async function installFakeSSH(): Promise<FakeSSH> {
  const directory = await mkdtemp(join(tmpdir(), "opencode-ssh-test-"))
  const executable = join(directory, "ssh")
  const exitLog = join(directory, "exits")
  const spawnLog = join(directory, "spawns")

  await writeFile(
    executable,
    `#!/usr/bin/env python3
import re
import signal
import subprocess
import sys
import time

args = sys.argv[1:]
shell_index = len(args) - 2
host = args[shell_index - 1]

def terminate(_signum, _frame):
    with open(${JSON.stringify(exitLog)}, "a", encoding="utf-8") as log:
        log.write(host + "\\n")
    sys.exit(0)

signal.signal(signal.SIGTERM, terminate)
with open(${JSON.stringify(spawnLog)}, "a", encoding="utf-8") as log:
    log.write(host + "\\n")
command = ""
for line in sys.stdin:
    line = line.rstrip("\\n")
    marker = re.search(r"<<__OC_SSH_DONE__([a-z0-9]+)_", line)
    if marker:
        if command == "block" or (command == "true" and host == "slow-connect"):
            while True:
                time.sleep(1)
        if command == "close":
            sys.exit(0)
        result = subprocess.run(command, shell=True, text=True, capture_output=True)
        sys.stdout.write(result.stdout)
        sys.stdout.write(result.stderr)
        sys.stdout.write(f"<<__OC_SSH_DONE__{marker.group(1)}_{result.returncode}>>\\n")
        sys.stdout.flush()
        command = ""
    else:
        command = re.sub(r" 2>&1$", "", line)
`,
  )
  await chmod(executable, 0o755)
  const originalSpawn = Bun.spawn
  const spawn = ((command: Parameters<typeof Bun.spawn>[0], options?: unknown) => {
    if (Array.isArray(command) && command[0] === "ssh") {
      return originalSpawn([executable, ...command.slice(1)], options as never)
    }
    return originalSpawn(command as never, options as never)
  }) as typeof Bun.spawn
  const mutableBun = Bun as { spawn: typeof Bun.spawn }
  mutableBun.spawn = spawn

  return {
    async cleanup() {
      mutableBun.spawn = originalSpawn
      await rm(directory, { recursive: true, force: true })
    },
    async exits() {
      const contents = await readFile(exitLog, "utf8").catch(() => "")
      return contents.split("\n").filter(Boolean)
    },
    async spawns() {
      const contents = await readFile(spawnLog, "utf8").catch(() => "")
      return contents.split("\n").filter(Boolean)
    },
  }
}
