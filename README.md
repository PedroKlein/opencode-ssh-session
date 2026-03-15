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

The plugin registers three tools:

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

## How It Works

The plugin spawns a single `ssh` child process per session and communicates with it via stdin/stdout using unique markers to delimit command output. This avoids reconnection overhead and preserves shell state between commands.

- Commands are non-interactive only (no `vim`, `top`, etc.)
- A mutex ensures only one command runs at a time
- The session is automatically cleaned up on disconnect

## Requirements

- OpenCode with plugin support (`@opencode-ai/plugin >= 1.0.0`)
- `ssh` available on the host machine's `PATH`

## License

MIT
