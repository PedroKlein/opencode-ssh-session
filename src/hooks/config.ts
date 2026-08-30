import type { Config } from "@opencode-ai/plugin"

export async function configurePermissions(config: Config): Promise<void> {
  if (!config.permission) config.permission = {}
  const permissions = config.permission as Record<string, unknown>
  permissions.ssh_connect ??= "ask"
}
