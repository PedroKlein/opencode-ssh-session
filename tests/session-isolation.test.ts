import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import SSHSession from "../src/index"
import { type FakeSSH, installFakeSSH, toolContext } from "./helpers"

let fakeSSH: FakeSSH

beforeAll(async () => {
  fakeSSH = await installFakeSSH()
})

afterAll(async () => {
  await fakeSSH.cleanup()
})

describe("session isolation", () => {
  test("keeps connections independent across OpenCode sessions", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const tools = plugin.tool
    const first = toolContext("session-a")
    const second = toolContext("session-b")

    await tools.ssh_connect.execute({ host: "host-a" }, first)
    await tools.ssh_connect.execute({ host: "host-b" }, second)

    expect(await tools.ssh_info.execute({}, first)).toContain("Host: host-a")
    expect(await tools.ssh_info.execute({}, second)).toContain("Host: host-b")
    expect(await tools.ssh.execute({ command: "printf host-a" }, first)).toBe("host-a")
    expect(await tools.ssh.execute({ command: "printf host-b" }, second)).toBe("host-b")

    await tools.ssh_disconnect.execute({}, first)
    expect(await tools.ssh.execute({ command: "printf host-b" }, second)).toBe("host-b")
    await plugin.dispose?.()
  })

  test("cleans only the session named by lifecycle events", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool || !plugin.event) throw new Error("SSH plugin hooks were not registered")
    const first = toolContext("event-session-a")
    const second = toolContext("event-session-b")

    await plugin.tool.ssh_connect.execute({ host: "event-host-a" }, first)
    await plugin.tool.ssh_connect.execute({ host: "event-host-b" }, second)
    await plugin.event({
      event: {
        type: "session.error",
        properties: { sessionID: first.sessionID },
      } as never,
    })

    expect(await plugin.tool.ssh_info.execute({}, first)).toBe("No active SSH session.")
    expect(await plugin.tool.ssh.execute({ command: "printf alive" }, second)).toBe("alive")
    await Bun.sleep(25)
    expect(await fakeSSH.exits()).toContain("event-host-a")
    expect(await fakeSSH.exits()).not.toContain("event-host-b")
    await plugin.dispose?.()
  })

  test("cleans deleted sessions and all connections on plugin disposal", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool || !plugin.event || !plugin.dispose) {
      throw new Error("SSH plugin lifecycle hooks were not registered")
    }
    const deleted = toolContext("deleted-session")
    const remaining = toolContext("remaining-session")

    await plugin.tool.ssh_connect.execute({ host: "deleted-host" }, deleted)
    await plugin.tool.ssh_connect.execute({ host: "remaining-host" }, remaining)
    await plugin.event({
      event: {
        type: "session.deleted",
        properties: { info: { id: deleted.sessionID } },
      } as never,
    })

    expect(await plugin.tool.ssh_info.execute({}, deleted)).toBe("No active SSH session.")
    expect(await plugin.tool.ssh.execute({ command: "printf alive" }, remaining)).toBe("alive")

    await plugin.dispose()
    expect(await plugin.tool.ssh_info.execute({}, remaining)).toBe("No active SSH session.")
    await Bun.sleep(25)
    expect(await fakeSSH.exits()).toEqual(
      expect.arrayContaining(["deleted-host", "remaining-host"]),
    )
  })

  test("reports bash guard state for the calling session", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool || !plugin["tool.execute.before"]) {
      throw new Error("SSH plugin tool hooks were not registered")
    }
    const connected = toolContext("guard-connected")
    const disconnected = toolContext("guard-disconnected")
    await plugin.tool.ssh_connect.execute({ host: "guard-host" }, connected)

    const connectedOutput = { args: { command: "ssh example" } }
    await plugin["tool.execute.before"](
      { tool: "bash", sessionID: connected.sessionID, callID: "connected-call" },
      connectedOutput,
    )
    const disconnectedOutput = { args: { command: "ssh example" } }
    await plugin["tool.execute.before"](
      { tool: "bash", sessionID: disconnected.sessionID, callID: "disconnected-call" },
      disconnectedOutput,
    )

    expect(connectedOutput.args.command).toContain("active SSH session")
    expect(disconnectedOutput.args.command).toContain("Use `ssh_connect`")
    await plugin.dispose?.()
  })
})
