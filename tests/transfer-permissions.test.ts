import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { ToolContext } from "@opencode-ai/plugin"
import SSHSession from "../src/index"
import { type FakeSSH, installFakeSSH, toolContext } from "./helpers"

let fakeSSH: FakeSSH
let directory: string

beforeAll(async () => {
  fakeSSH = await installFakeSSH()
  directory = await mkdtemp(join(tmpdir(), "opencode-ssh-transfer-"))
})

afterAll(async () => {
  await fakeSSH.cleanup()
  await rm(directory, { recursive: true, force: true })
})

function transferContext(sessionID: string, ask: ToolContext["ask"]): ToolContext {
  return {
    ...toolContext(sessionID),
    directory,
    worktree: directory,
    ask,
  }
}

describe("file transfer permissions", () => {
  test("rejected upload performs no remote writes", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const source = join(directory, "missing-source.txt")
    const destination = join(directory, "remote.txt")
    const connected = transferContext("upload-denied", async () => {})
    await plugin.tool.ssh_connect.execute({ host: "upload-host" }, connected)
    const before = await fakeSSH.commands()
    const denied = transferContext("upload-denied", async () => {
      throw new Error("permission denied")
    })

    await expect(
      plugin.tool.ssh_upload.execute({ localPath: source, remotePath: destination }, denied),
    ).rejects.toThrow("permission denied")
    expect(await fakeSSH.commands()).toEqual(before)
    expect(await Bun.file(destination).exists()).toBe(false)
    await plugin.dispose?.()
  })

  test("requests upload permissions before transferring bytes", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const source = join(directory, "allowed-source.bin")
    const destination = join(directory, "allowed-remote.bin")
    await writeFile(source, new Uint8Array([0, 1, 2, 255]))
    const calls: Parameters<ToolContext["ask"]>[0][] = []
    const context = transferContext("upload-allowed", async (input) => calls.push(input))
    await plugin.tool.ssh_connect.execute({ host: "upload-allowed-host" }, context)
    calls.length = 0

    await plugin.tool.ssh_upload.execute({ localPath: source, remotePath: destination }, context)

    expect(calls).toEqual([
      {
        permission: "read",
        patterns: [source],
        always: [source],
        metadata: { path: source },
      },
      {
        permission: "edit",
        patterns: [`upload-allowed-host:${destination}`],
        always: [`upload-allowed-host:${destination}`],
        metadata: { host: "upload-allowed-host", path: destination },
      },
    ])
    expect(new Uint8Array(await readFile(destination))).toEqual(new Uint8Array([0, 1, 2, 255]))
    await plugin.dispose?.()
  })

  test("rejected download does not write the local destination", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const source = join(directory, "download-remote.txt")
    const destination = join(directory, "download-local.txt")
    await writeFile(source, "remote content")
    const calls: Parameters<ToolContext["ask"]>[0][] = []
    const context = transferContext("download-denied", async (input) => {
      calls.push(input)
      if (input.permission === "edit") throw new Error("permission denied")
    })
    await plugin.tool.ssh_connect.execute({ host: "download-host" }, context)
    calls.length = 0
    const before = await fakeSSH.commands()

    await expect(
      plugin.tool.ssh_download.execute({ remotePath: source, localPath: destination }, context),
    ).rejects.toThrow("permission denied")
    expect(calls).toEqual([
      {
        permission: "read",
        patterns: [`download-host:${source}`],
        always: [`download-host:${source}`],
        metadata: { host: "download-host", path: source },
      },
      {
        permission: "edit",
        patterns: [destination],
        always: [destination],
        metadata: { path: destination },
      },
    ])
    expect(await fakeSSH.commands()).toEqual(before)
    expect(await Bun.file(destination).exists()).toBe(false)
    await plugin.dispose?.()
  })

  test("requests external-directory access without sibling-prefix bypasses", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const worktree = join(directory, "worktree")
    const sibling = join(directory, "worktree-other")
    await mkdir(worktree, { recursive: true })
    await mkdir(sibling, { recursive: true })
    const source = join(sibling, "source.txt")
    const destination = join(directory, "external-remote.txt")
    await writeFile(source, "external")
    const calls: Parameters<ToolContext["ask"]>[0][] = []
    const context = {
      ...transferContext("external-upload", async (input) => calls.push(input)),
      directory: worktree,
      worktree,
    }
    await plugin.tool.ssh_connect.execute({ host: "external-host" }, context)
    calls.length = 0

    await plugin.tool.ssh_upload.execute({ localPath: source, remotePath: destination }, context)

    expect(calls.map((call) => call.permission)).toEqual(["external_directory", "read", "edit"])

    calls.length = 0
    const parentSource = join(directory, "parent-source.txt")
    await writeFile(parentSource, "parent")
    await plugin.tool.ssh_upload.execute(
      { localPath: parentSource, remotePath: join(directory, "parent-remote.txt") },
      context,
    )
    expect(calls.map((call) => call.permission)).toEqual(["external_directory", "read", "edit"])
    await plugin.dispose?.()
  })

  test("round-trips binary data after permissions are granted", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const source = join(directory, "roundtrip-source.bin")
    const remote = join(directory, "roundtrip-remote.bin")
    const destination = join(directory, "roundtrip-destination.bin")
    const bytes = new Uint8Array([0, 10, 13, 39, 127, 255])
    await writeFile(source, bytes)
    const context = transferContext("roundtrip", async () => {})
    await plugin.tool.ssh_connect.execute({ host: "roundtrip-host" }, context)

    await plugin.tool.ssh_upload.execute({ localPath: source, remotePath: remote }, context)
    await plugin.tool.ssh_download.execute({ remotePath: remote, localPath: destination }, context)

    expect(new Uint8Array(await readFile(destination))).toEqual(bytes)
    await plugin.dispose?.()
  })
})
