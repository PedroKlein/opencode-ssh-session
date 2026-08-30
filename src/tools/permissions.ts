import { isAbsolute, relative, resolve, sep } from "node:path"
import type { ToolContext } from "@opencode-ai/plugin"

type Permission = "read" | "edit"

interface TransferPermissions {
  host: string
  localPath: string
  localPermission: Permission
  remotePath: string
  remotePermission: Permission
}

export async function authorizeTransfer(
  context: ToolContext,
  input: TransferPermissions,
): Promise<string> {
  const localPath = resolve(context.directory, input.localPath)
  const worktreeRelativePath = relative(context.worktree, localPath)
  const outsideWorktree =
    worktreeRelativePath === ".." ||
    worktreeRelativePath.startsWith(`..${sep}`) ||
    isAbsolute(worktreeRelativePath)

  const askLocal = async () => {
    if (outsideWorktree) {
      await context.ask({
        permission: "external_directory",
        patterns: [localPath],
        always: [localPath],
        metadata: { path: localPath },
      })
    }

    await context.ask({
      permission: input.localPermission,
      patterns: [localPath],
      always: [localPath],
      metadata: { path: localPath },
    })
  }

  const remoteResource = `${input.host}:${input.remotePath}`
  const askRemote = () =>
    context.ask({
      permission: input.remotePermission,
      patterns: [remoteResource],
      always: [remoteResource],
      metadata: { host: input.host, path: input.remotePath },
    })

  if (input.localPermission === "read") {
    await askLocal()
    await askRemote()
  } else {
    await askRemote()
    await askLocal()
  }

  return localPath
}
