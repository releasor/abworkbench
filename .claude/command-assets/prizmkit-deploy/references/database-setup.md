# Database Setup

Read this file when Discovery detected a database driver and the user wants AI-assisted database installation on the server.

## Entry condition

During Discovery Step 1 (Project Detection), database drivers were already scanned. If a driver was detected, ask after bootstrap tools are installed:

> "检测到项目使用了 <PostgreSQL/MySQL/Redis>，需要帮你在服务器上安装配置吗？"
> - **需要** → 继续数据库安装
> - **不需要** → 跳过，记录到 deploy.md，标注"数据库需用户自行配置"

## PostgreSQL setup

```
apt-get install -y postgresql postgresql-contrib
sudo -u postgres psql -c "CREATE DATABASE <project>;"
sudo -u postgres psql -c "CREATE USER <project> WITH PASSWORD '<random-password>';"
sudo -u postgres psql -c "GRANT ALL ON DATABASE <project> TO <project>;"
```

- Generate a secure random password (32 chars, alphanumeric + symbols).
- Write the connection string to `.prizmkit/deploy/secrets.local.json`: `DATABASE_URL=postgresql://<project>:<password>@localhost:5432/<project>`.
- In deploy.md, write: "PostgreSQL 已安装，连接信息已记录到 `.prizmkit/deploy/secrets.local.json`（不提交到 git）".

## MySQL setup (future)

Similar flow. Not implemented in first version — if project uses MySQL, direct user to documentation fallback.

## Redis setup

```
apt-get install -y redis-server
redis-cli CONFIG SET requirepass "<random-password>"
redis-cli CONFIG REWRITE
```

- Bind to localhost only (modify `/etc/redis/redis.conf` if needed).
- Write `REDIS_URL=redis://:<password>@localhost:6379` to `.prizmkit/deploy/secrets.local.json`.

## Security notes

- Never write database passwords to deploy.md, because deploy.md may be committed to git and passwords would leak.
- Passwords stored in `.prizmkit/deploy/secrets.local.json` (gitignored).
- Default: database binds to localhost, no external access, because most indie projects only need local connections.
- Record a `"database-setup"` event in deploy history (presence metadata only, no passwords).
