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

describe("SSH connection failures", () => {
  test("returns SSH stderr without waiting for the handshake timeout", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const context = toolContext("stderr-session")
    const startedAt = performance.now()

    await expect(plugin.tool.ssh_connect.execute({ host: "stderr-host" }, context)).rejects.toThrow(
      "Permission denied (publickey).",
    )
    expect(performance.now() - startedAt).toBeLessThan(1_000)
  })

  test("surfaces changed host keys as connection failures", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const context = toolContext("changed-key-session")

    await expect(
      plugin.tool.ssh_connect.execute({ host: "changed-key-host" }, context),
    ).rejects.toThrow("REMOTE HOST IDENTIFICATION HAS CHANGED!")
  })
})
