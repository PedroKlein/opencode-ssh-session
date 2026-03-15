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

Get information about the current SSH session — connected host, duration, and whether a command is running.

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

The plugin spawns a single `ssh` child process per session and communicates with it via stdin/stdout using unique markers to delimit command output. This avoids reconnection overhead and preserves shell state between commands.

- Commands are non-interactive only (no `vim`, `top`, etc.)
- A mutex ensures only one command runs at a time
- File transfers use base64 encoding over the existing connection
- The session is automatically cleaned up on disconnect or error

## Requirements

- OpenCode with plugin support (`@opencode-ai/plugin >= 1.0.0`)
- `ssh` available on the host machine's `PATH`

## License

MIT
