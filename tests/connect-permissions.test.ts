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

function connectContext(sessionID: string, ask: ToolContext["ask"]): ToolContext {
  return { ...toolContext(sessionID), ask }
}

describe("SSH connection permissions", () => {
  test("defaults ssh_connect to ask without overriding user policy", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.config) throw new Error("SSH config hook was not registered")
    const defaults = {} as { permission?: Record<string, unknown> }
    const allowed = { permission: { ssh_connect: "allow" } }
    const denied = { permission: { ssh_connect: "deny" } }

    await plugin.config(defaults as never)
    await plugin.config(allowed as never)
    await plugin.config(denied as never)

    expect(defaults.permission?.ssh_connect).toBe("ask")
    expect(allowed.permission.ssh_connect).toBe("allow")
    expect(denied.permission.ssh_connect).toBe("deny")
  })

  test("rejected connection approval does not spawn SSH", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const before = await fakeSSH.spawns()
    const context = connectContext("connect-denied", async () => {
      throw new Error("connection denied")
    })

    await expect(plugin.tool.ssh_connect.execute({ host: "denied-host" }, context)).rejects.toThrow(
      "connection denied",
    )
    expect(await fakeSSH.spawns()).toEqual(before)
    await plugin.dispose?.()
  })

  test("requests host-specific approval before connecting", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const calls: Parameters<ToolContext["ask"]>[0][] = []
    const context = connectContext("connect-allowed", async (input) => calls.push(input))

    await plugin.tool.ssh_connect.execute(
      {
        host: "allowed-connect-host",
        options: "-o StrictHostKeyChecking=no -o BatchMode=no",
      },
      context,
    )

    expect(calls).toEqual([
      {
        permission: "ssh_connect",
        patterns: ["allowed-connect-host"],
        always: ["allowed-connect-host"],
        metadata: { host: "allowed-connect-host" },
      },
    ])
    expect(await fakeSSH.spawns()).toContain("allowed-connect-host")
    expect((await fakeSSH.arguments()).at(-1)).toEqual([
      "-T",
      "-o",
      "BatchMode=yes",
      "-o",
      "StrictHostKeyChecking=accept-new",
      "-o",
      "ServerAliveInterval=60",
      "-o",
      "ServerAliveCountMax=3",
      "-o",
      "StrictHostKeyChecking=no",
      "-o",
      "BatchMode=no",
      "allowed-connect-host",
      "bash",
      "-l",
    ])
    await plugin.dispose?.()
  })
})
