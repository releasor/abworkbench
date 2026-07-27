# Deployment Mode Details

Read this file when the user needs a detailed comparison of deployment modes during mode selection. SKILL.md contains the routing logic; this file has the full descriptions.

## Mode A — Direct Upload

1. Local build on the user's machine.
2. SCP built output + `node_modules` + `.env.production` to server.
3. PM2 start → health check → Nginx switch.
4. After success: offer to upgrade to CI/CD.
5. Bypasses: deploy key, git clone on server, server-side build.

Best for: first-time deployment, getting something live fast, low-spec servers.

## Mode B1 — CI/CD Push

1. Generate `.github/workflows/deploy.yml`: checkout → install → build → SCP tarball → SSH restart.
2. Add GitHub Secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `SSH_PORT`.
3. First deploy triggered by push to configured branch.
4. Server only needs Node.js runtime + PM2 — no git, no build tools needed.
5. GitHub Actions runner handles the heavy lifting.

Best for: low-spec servers, heavy build processes, projects with large dependencies.

## Mode B2 — CI/CD Pull

1. Configure deploy key on server → add to GitHub.
2. Generate `.github/workflows/deploy.yml`: triggers SSH command on server.
3. Server-side deploy script: `git pull` → install → build → PM2 restart → health check.
4. Server needs full build toolchain (Node.js, npm, git).
5. Simpler workflow file, heavier server load.

Best for: simple setup, servers with sufficient CPU/RAM, projects where build is fast.

## Comparison

| 对比 | Push 模式 | Pull 模式 |
|------|----------|----------|
| 构建位置 | GitHub Actions runner | 服务器本地 |
| 服务器压力 | 低（只运行应用） | 高（编译+运行） |
| 配置复杂度 | 中（需 SCP 传产物） | 低（只需 SSH 触发脚本） |
| 适合场景 | 服务器配置低、编译重 | 部署简单优先、服务器性能充裕 |
| Deploy Key 需要 | 不需要 | 需要 |
| 产物传输 | SCP tarball | git pull（仅增量） |

## Common ground between all modes

- Same PM2 + Nginx blue/green strategy.
- Same health check and traffic switch procedure.
- Same ops commands (status/logs/restart/rollback).
