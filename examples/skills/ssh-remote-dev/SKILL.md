---
name: ssh-remote-dev
description: >
  Operate persistent remote shells with the opencode-ssh-session tools. Use when connecting to an
  SSH host, running remote commands, transferring files, deploying, or diagnosing a denied, timed
  out, or dropped remote session. Triggers on: ssh_connect, ssh, ssh_info, ssh_upload, ssh_download,
  remote server, deployment, remote debugging. Do NOT use for local shell work or interactive
  terminal programs.
license: MIT
metadata:
  audience: developers
  workflow: remote-development
---

# SSH remote development

Treat each OpenCode session as owning one remote shell. Shell state persists only while that SSH
connection remains alive.

## Route the operation

| Need | Tool | Permission behavior |
| --- | --- | --- |
| Check connection state | `ssh_info` | No remote operation |
| Open or replace a connection | `ssh_connect` | Requests `ssh_connect` for the exact host |
| Run a remote command | `ssh` | Requests `bash` for the exact command |
| Send a local file | `ssh_upload` | Requests local `read`, then remote `edit` |
| Receive a remote file | `ssh_download` | Requests remote `read`, then local `edit` |
| End the connection | `ssh_disconnect` | Closes only the current OpenCode session's SSH process |

A local transfer path outside the worktree also requests `external_directory`.

## Before a remote operation

1. Call `ssh_info` when the current session's connection state is unknown.
2. Confirm that the active host is the intended target. Use `ssh_connect` to replace it when needed.
3. Decide whether later commands depend on `cd`, exported variables, or other shell state.
4. Use the transfer tools instead of embedding file contents or model-provided paths in shell
   commands.

Permission rejection is final for that attempt. Report it and stop. Do not retry the same operation
through another tool or a differently spelled command.

## Connection behavior

- First-time keys use OpenSSH `accept-new`. Changed host keys are rejected.
- Password, passphrase, keyboard-interactive, and TUI prompts are unavailable because SSH runs in
  batch mode without a terminal.
- An abort, command timeout, stream closure, or connection error closes the current SSH session.
  Reconnect before relying on prior shell state.
- Other OpenCode sessions keep their own independent connections.

## Command boundaries

Use one `ssh` call when commands must succeed as a unit or share immediate state:

```sh
cd /srv/app && git pull --ff-only && make build
```

Use separate calls when later work needs to inspect output before deciding what to do. Persistent
state means a successful `cd` or `export` remains active for the next call.

Non-zero exit codes appear in tool output. Diagnose the failure before retrying. Do not reconnect
unless the session itself was closed.

## Transfers

Use `ssh_upload` and `ssh_download` for bounded files. They preserve arbitrary remote filenames and
transfer bytes through base64 over the active connection.

Base64 adds about one third overhead. For large files, tell the user to run `scp` or `rsync` outside
OpenCode rather than sending a large payload through the model-driven session.

## Failure recovery

| Signal | Response |
| --- | --- |
| `No active SSH session` | Call `ssh_connect`, then retry only after approval |
| Permission denied by OpenCode | Stop and report the denied permission and resource |
| Authentication failure on connect | Ask the user to configure key-based auth or an SSH agent |
| Host identification changed | Stop; do not bypass host verification |
| Command timeout or dropped stream | Treat shell state as lost, reconnect, and re-establish required state |
| Non-zero command exit | Keep the connection and diagnose from the returned output |

## NEVER

- **NEVER bypass a denied plugin tool with built-in `bash`, nested `ssh`, `scp`, `sftp`, or
  `rsync`.** That substitutes a different execution path for a rejected permission decision.
- **NEVER run `vim`, `nano`, `top`, `less`, password-requiring `sudo`, or another interactive
  program.** The connection has no terminal and cannot answer prompts.
- **NEVER assume shell state survived an abort, timeout, or dropped stream.** Those failures close
  the persistent connection by design.
- **NEVER disable host-key checking to make a connection succeed.** First-time keys are already
  handled by `accept-new`; a changed key is a security failure requiring user investigation.
- **NEVER start a process that must outlive the session without explicit detachment and redirected
  output.** Closing SSH otherwise terminates or strands the process with unusable stdio.
