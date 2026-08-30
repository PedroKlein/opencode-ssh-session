import { describe, expect, test } from "bun:test"
import SSHSession, { SSHSession as namedSSHSession } from "../src/index"

describe("package exports", () => {
  test("exports the SSH session plugin", () => {
    expect(SSHSession).toBe(namedSSHSession)
    expect(typeof SSHSession).toBe("function")
  })
})
