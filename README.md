# opencode-ssh-session

An [OpenCode](https://opencode.ai) plugin that provides persistent SSH session tools. Connect to a remote host once, then run multiple commands with shell state (working directory, environment variables, etc.) preserved between calls.

## Installation

Add the plugin to your OpenCode configuration (`opencode.json`):

```json
{
  "plugin": ["opencode-ssh-session"]
}
```

OpenCode will automatically install the package via Bun at startup.

## Permissions

The plugin uses OpenCode's native permission system before connecting, running remote commands, or transferring files. Connection approval defaults to `ask`; an explicit user setting overrides that default.

```json
{
  "permission": {
    "ssh_connect": {
      "*": "ask",
      "dev-*": "allow",
      "production": "deny"
    },
    "bash": {
      "*": "ask",
      "git status": "allow",
      "git diff *": "allow"
    },
    "read": "allow",
    "edit": "ask",
    "external_directory": "ask"
  }
}
```

Permission mapping:

| Operation | Permission | Resource |
| --------- | ---------- | -------- |
| Connect | `ssh_connect` | SSH host |
| Run a command | `bash` | Exact remote command |
| Upload | `read`, then `edit` | Resolved local source, then `host:remotePath` |
| Download | `read`, then `edit` | `host:remotePath`, then resolved local destination |
| Access outside the worktree | `external_directory` | Resolved local path |

Rejecting a permission prevents the associated SSH or filesystem operation. Remote commands use the same `bash` rules as local shell commands, including agent-specific rules.

## Host verification

`ssh_connect` runs OpenSSH non-interactively. After connection approval, OpenSSH uses `StrictHostKeyChecking=accept-new`: first-time host keys are added to the user's normal known-hosts database, while changed host keys are rejected. The plugin does not bypass changed-key warnings.

Password, passphrase, keyboard-interactive, and other terminal prompts are not supported. Configure key-based authentication or an SSH agent before connecting. Connection errors include OpenSSH's stderr output.

## Tools

The plugin registers six tools:

### `ssh_connect`

Open a persistent SSH session to a remote host.

| Parameter | Type   | Required | Description                                              |
| --------- | ------ | -------- | -------------------------------------------------------- |
| `host`    | string | yes      | SSH host (e.g. `user@server`, `myalias`, `192.168.1.10`) |
| `options` | string | no       | Extra SSH flags (e.g. `-p 2222`, `-i ~/.ssh/mykey`)      |

### `ssh`

Execute a command on the active SSH session. Shell state persists across calls.

| Parameter | Type   | Required | Description                                    |
| --------- | ------ | -------- | ---------------------------------------------- |
| `command` | string | yes      | Shell command to run on the remote host         |
| `timeout` | number | no       | Timeout in milliseconds (default: 120000 = 2m) |

### `ssh_disconnect`

Close the active SSH session. Shell state is lost. You can reconnect later with `ssh_connect`.

No parameters.

### `ssh_info`

Get the connected host, session duration, and command status for the current SSH session.

No parameters.

### `ssh_upload`

Upload a local file to the remote host through the active SSH session using base64 encoding.

| Parameter    | Type   | Required | Description                           |
| ------------ | ------ | -------- | ------------------------------------- |
| `localPath`  | string | yes      | Absolute path to the local file       |
| `remotePath` | string | yes      | Destination path on the remote host   |

### `ssh_download`

Download a file from the remote host to the local machine through the active SSH session.

| Parameter    | Type   | Required | Description                           |
| ------------ | ------ | -------- | ------------------------------------- |
| `remotePath` | string | yes      | Path to the file on the remote host   |
| `localPath`  | string | yes      | Destination path on the local machine |

## Hooks

The plugin automatically registers hooks that improve the SSH experience:

### Bash guard (`tool.execute.before`)

Detects when the AI tries to run `ssh`, `scp`, `sftp`, or `rsync` through the built-in `bash` tool and injects a reminder to use the SSH session tools instead.

### Session cleanup (`event`)

Automatically cleans up orphaned SSH processes when an OpenCode session errors out.

## Commands & Skills

The plugin ships example commands and a skill in the `examples/` directory. Copy them to your OpenCode config to use them.

### Commands

Copy to `.opencode/commands/` (project) or `~/.config/opencode/commands/` (global):

| Command        | File                              | Description                              |
| -------------- | --------------------------------- | ---------------------------------------- |
| `/ssh <host>`  | `examples/commands/ssh.md`        | Quick connect to a host                  |
| `/ssh-status`  | `examples/commands/ssh-status.md` | Check connection status with diagnostics |

### Skill

Copy to `.opencode/skills/` (project) or `~/.config/opencode/skills/` (global):

| Skill            | Directory                              | Description                                  |
| ---------------- | -------------------------------------- | -------------------------------------------- |
| `ssh-remote-dev` | `examples/skills/ssh-remote-dev/`      | Remote development best practices for the AI |

The skill teaches the AI patterns for deployments, debugging remote services, file transfers, and common pitfalls to avoid.

## How It Works

The plugin spawns at most one `ssh` child process for each OpenCode session and communicates with it through stdin/stdout using unique markers to delimit command output. This avoids reconnection overhead and preserves shell state between commands.

- Commands are non-interactive only (no `vim`, `top`, password prompts, etc.)
- Commands within a session execute one at a time
- Aborting or timing out `ssh_connect` or `ssh` closes that session's SSH connection
- File transfers use base64 encoding over the existing connection
- Remote paths are shell-quoted before transfer commands run
- Session deletion, errors, and plugin shutdown clean up their associated SSH processes

## Requirements

- OpenCode with plugin support (`@opencode-ai/plugin >= 1.18.25`)
- `ssh` available on the host machine's `PATH`

## License

MIT
