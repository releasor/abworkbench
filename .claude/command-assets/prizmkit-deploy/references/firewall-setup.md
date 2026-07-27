# Firewall Setup (UFW)

Read this file when the user wants AI-assisted firewall configuration during bootstrap.

## Flow

1. After core tools are installed, ask the user:
   > "是否需要帮你配置防火墙（ufw）？只开放必要的端口，提高服务器安全性。"

2. If user declines: skip, record to deploy config.

3. If user agrees, ask which additional ports to open (beyond SSH/HTTP/HTTPS):
   > "默认只开放 SSH(22)、HTTP(80)、HTTPS(443)。蓝绿部署预览端口（3101/3102）要不要也开放？如果需要其他端口（如数据库远程管理），可以一起列出来。"

4. Collect ports, then ask:
   > "防火墙规则已整理好。是我直接上去改，还是你自己来？"
   > - **A. 你帮我改** — AI 执行 ufw 命令
   > - **B. 我自己改** — 输出规则清单，用户手工执行

## Planned rules (output before executing)

```
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp       # SSH
ufw allow 80/tcp       # HTTP
ufw allow 443/tcp      # HTTPS
ufw allow 3101/tcp     # blue preview (user-approved)
ufw allow 3102/tcp     # green preview (user-approved)
ufw --force enable
```

## Rules for automatic execution

- Check `ufw status` first — if rules already exist, append only missing rules, don't overwrite.
- Never `ufw reset` unless explicitly asked, because it wipes custom rules the user may have configured manually.
- Record a `"security-baseline"` event in deploy history with the rule list, so future sessions can detect existing configuration.
