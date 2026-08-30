import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import SSHSession from "../src/index"
import { type FakeSSH, installFakeSSH, toolContext } from "./helpers"

let fakeSSH: FakeSSH
let directory: string

beforeAll(async () => {
  fakeSSH = await installFakeSSH()
  directory = await mkdtemp(join(tmpdir(), "opencode-ssh-paths-"))
})

afterAll(async () => {
  await fakeSSH.cleanup()
  await rm(directory, { recursive: true, force: true })
})

describe("remote transfer paths", () => {
  test("treats a quote and shell separator as literal filename characters", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const context = {
      ...toolContext("quoted-upload"),
      directory,
      worktree: directory,
    }
    const source = join(directory, "quoted-source.txt")
    const sentinelName = `.ssh-injected-${crypto.randomUUID()}`
    const sentinel = join(process.cwd(), sentinelName)
    const remotePath = join(directory, `literal'; touch '${sentinelName}`)
    await writeFile(source, "literal content")

    try {
      await plugin.tool.ssh_connect.execute({ host: "quoted-host" }, context)
      await plugin.tool.ssh_upload.execute({ localPath: source, remotePath }, context)

      expect(await Bun.file(sentinel).exists()).toBe(false)
      expect(await readFile(remotePath, "utf8")).toBe("literal content")
    } finally {
      await plugin.dispose?.()
      await rm(sentinel, { force: true })
    }
  })

  test("preserves adversarial filenames during upload and download", async () => {
    const plugin = await SSHSession({} as never)
    if (!plugin.tool) throw new Error("SSH tools were not registered")
    const context = {
      ...toolContext("adversarial-paths"),
      directory,
      worktree: directory,
    }
    const source = join(directory, "adversarial-source.txt")
    const sentinelName = `.ssh-substitution-${crypto.randomUUID()}`
    const sentinel = join(process.cwd(), sentinelName)
    const names = [
      "space file",
      "quote'file",
      `$(touch ${sentinelName})`,
      "semi;colon",
      "line\nbreak",
    ]
    await writeFile(source, "adversarial content")

    try {
      await plugin.tool.ssh_connect.execute({ host: "adversarial-host" }, context)
      for (const [index, name] of names.entries()) {
        const remotePath = join(directory, name)
        const localPath = join(directory, `download-${index}.txt`)

        await plugin.tool.ssh_upload.execute({ localPath: source, remotePath }, context)
        await plugin.tool.ssh_download.execute({ remotePath, localPath }, context)

        expect(await readFile(remotePath, "utf8")).toBe("adversarial content")
        expect(await readFile(localPath, "utf8")).toBe("adversarial content")
      }
      expect(await Bun.file(sentinel).exists()).toBe(false)
    } finally {
      await plugin.dispose?.()
      await rm(sentinel, { force: true })
    }
  })
})
