import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import type { ToolContext } from "@opencode-ai/plugin"
import SSHSession from "../src/index"
import { type FakeSSH, installFakeSSH, toolContext } from "./helpers"

let fakeSSH: FakeSSH

beforeAll(async () => {
  fakeSSH = await installFakeSSH()
})

afterAll(async () => {
  await fakeSSH.cleanup()
})

function withPermission(sessionID: string, ask: ToolContext["ask"]): ToolContext {
  return { ...toolContext(sessionID), ask }
}

describe("remote command permissions", () => {
  test("does not execute a command rejected by the native bash permission", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const allowed = toolContext("permission-denied")
    await plugin.tool.ssh_connect.execute({ host: "permission-host" }, allowed)
    const before = await fakeSSH.commands()
    const denied = withPermission("permission-denied", async () => {
      throw new Error("permission denied")
    })

    await expect(
      plugin.tool.ssh.execute({ command: "printf should-not-run" }, denied),
    ).rejects.toThrow("permission denied")
    expect(await fakeSSH.commands()).toEqual(before)
    expect(await plugin.tool.ssh_info.execute({}, allowed)).toContain("Host: permission-host")
    await plugin.dispose?.()
  })

  test("asks with the exact command and host before allowed execution", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const calls: Parameters<ToolContext["ask"]>[0][] = []
    const context = withPermission("permission-allowed", async (input) => {
      calls.push(input)
    })
    await plugin.tool.ssh_connect.execute({ host: "allowed-host" }, context)
    calls.length = 0

    const output = await plugin.tool.ssh.execute({ command: "printf allowed" }, context)

    expect(output).toBe("allowed")
    expect(calls).toEqual([
      {
        permission: "bash",
        patterns: ["printf allowed"],
        always: ["printf allowed"],
        metadata: { host: "allowed-host" },
      },
    ])
    expect((await fakeSSH.commands()).at(-1)).toBe("allowed-host\tprintf allowed")
    await plugin.dispose?.()
  })

  test("does not ask when there is no active connection", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    let asks = 0
    const context = withPermission("permission-disconnected", async () => {
      asks++
    })

    expect(await plugin.tool.ssh.execute({ command: "printf ignored" }, context)).toBe(
      "No active SSH session. Use ssh_connect to establish a connection first.",
    )
    expect(asks).toBe(0)
    await plugin.dispose?.()
  })
})
