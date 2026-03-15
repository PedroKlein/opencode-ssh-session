---
name: ssh-remote-dev
description: Best practices for remote development and server management over SSH using the opencode-ssh-session plugin
license: MIT
metadata:
  audience: developers
  workflow: remote-development
---

## What I do

Provide guidance on effective remote development patterns using the SSH session plugin tools. I help you work efficiently with remote servers while avoiding common pitfalls.

## Available tools

- `ssh_connect` — Open a persistent connection to a remote host
- `ssh` — Run commands on the active session (shell state persists between calls)
- `ssh_disconnect` — Close the session and free resources
- `ssh_info` — Check connection status, uptime, and queue state
- `ssh_upload` — Transfer a local file to the remote host
- `ssh_download` — Transfer a remote file to the local machine

## When to use me

Load this skill when you need to:
- Work with remote servers (deploying, debugging, monitoring)
- Transfer files between local and remote machines
- Manage remote services or processes
- Set up or configure remote environments

## Connection management

- Always check with `ssh_info` before assuming a session exists
- Connect once and reuse — the session preserves `cd`, exported variables, and shell state
- Disconnect when done to avoid orphaned SSH processes
- If a command times out or the connection drops, reconnect with `ssh_connect`

## Command execution rules

- **Never run interactive commands**: `vim`, `nano`, `top`, `htop`, `less`, `more`, `man`, `ssh` (nested)
- **Use non-interactive alternatives**: `cat` instead of `less`, `ps aux` instead of `top`, `sed`/`awk` instead of `vim`
- **Long-running commands**: use the `timeout` parameter or background with `nohup cmd &`
- **Multiple commands**: chain with `&&` or `;` in a single `ssh` call to reduce round trips
- **Error handling**: check exit codes — non-zero codes are reported in the output

## File transfer patterns

**Small files (< 1MB):** Use `ssh_upload` / `ssh_download` — they use base64 over the existing connection.

**Creating files on remote:** For small content, pipe through `ssh`:
```
echo 'content' > /path/to/file
```

**Reading remote files:** Use `ssh` with `cat`:
```
cat /path/to/file
```

**Large files (> 1MB):** The base64 encoding adds ~33% overhead. For very large files, suggest the user use `scp` or `rsync` directly outside of OpenCode.

## Deployment workflow

1. `ssh_info` — verify connection or `ssh_connect` if needed
2. `ssh` — navigate to project dir and pull latest code
3. `ssh` — install dependencies and build
4. `ssh` — restart services (`systemctl restart`, `pm2 restart`, etc.)
5. `ssh` — verify service is running (`curl localhost:PORT`, `systemctl status`)
6. `ssh_disconnect` — clean up when done

## Debugging remote services

1. Check service status: `systemctl status <service>`
2. View recent logs: `journalctl -u <service> -n 50 --no-pager`
3. Check ports: `ss -tlnp` or `netstat -tlnp`
4. Check resources: `df -h`, `free -m`, `ps aux --sort=-%mem | head`
5. Check connectivity: `curl -v localhost:<port>`

## Common pitfalls to avoid

- Do not run `sudo` commands that require a password prompt — they will hang
- Do not start background processes without `nohup` — they die when the session closes
- Do not assume the remote OS or package manager — check with `uname -a` and `which apt yum dnf brew` first
- Do not pipe large binary output through the session — it may corrupt or timeout
