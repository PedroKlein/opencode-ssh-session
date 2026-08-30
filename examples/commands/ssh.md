---
description: Connect to a remote host via SSH
---

Connect to the SSH host `$ARGUMENTS` using the `ssh_connect` tool. Once connected, report the connection status from `ssh_info`.

If no host is provided, ask which host to connect to. If connection permission is rejected or host verification fails, report the error and stop. Do not retry through the built-in shell.
