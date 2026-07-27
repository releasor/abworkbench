# Docker Deployment Path

Guided deployment when a `Dockerfile` or `docker-compose.yml` is detected, or the user requests Docker deployment.

## Detect and Configure

1. Read `Dockerfile` — extract base image, exposed ports, build steps.
2. Read `docker-compose.yml` if present — extract services, volumes, environment, ports.
3. Identify image name: from compose project name or repo directory name.
4. Identify port mappings: from `EXPOSE`, `ports:` in compose, or ask the user.

## Build and Deploy

1. Build: `docker build -t <project>:<releaseId> .` or `docker compose build`.
2. Check for running containers with the same name: `docker ps -a --filter name=<project>`.
3. If a previous container exists:
   - For blue/green on a server with Nginx: start new container on different port, health check, switch upstream.
   - For single-container setup: stop old, start new — warn about brief downtime.
4. Start: `docker run -d --name <project>-<releaseId> -p <port>:<port> <project>:<releaseId>` or `docker compose up -d`.
5. Health check the new container.
6. Write deploy-history event.

## Operations

| Command | Docker CLI |
|---------|-----------|
| status | `docker ps --filter name=<project>` |
| logs | `docker logs <container-name> --tail 100` |
| restart | `docker restart <container-name>` |
| rollback | `docker stop <new-container> && docker start <old-container>` |
| cleanup | `docker image prune -a --filter "label=project=<project>"` |
