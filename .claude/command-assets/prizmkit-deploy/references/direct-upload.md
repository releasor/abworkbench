# Direct Upload Deployment

Read this file when `deployStrategy` is `"direct-upload"`. The AI handles the build locally and transfers built artifacts to the server. No Git operations on the server.

## Build phase (local)

1. Run `<buildCommand>` locally (e.g., `npm run build`) in the project root.
2. Identify the build output directory: `.next/` for Next.js, `dist/` for Vite, `build/` for CRA.
3. Prepare a deployment tarball containing: build output + `node_modules/` + `package.json` + `package-lock.json` + any runtime config files.

## Transfer phase (SCP)

```
scp -P <port> deploy-<releaseId>.tar.gz <runtimeUser>@<host>:/var/www/<project>/releases/
ssh <runtimeUser>@<host> "cd /var/www/<project>/releases && mkdir <releaseId> && tar xzf deploy-<releaseId>.tar.gz -C <releaseId>"
```

## Server-side setup

1. Copy `.env.production` from `shared/` into the release directory (or SCP it alongside the tarball if first deploy).
2. No `npm install` needed — `node_modules` was transferred directly.
3. Start PM2 on the inactive port. Health checks and traffic switch follow the standard flow (Groups 3-5 in SKILL.md).

## Why transfer node_modules

Direct upload is optimized for "fast first deploy." Re-running `npm ci` on a low-spec server can be slow. Transferring pre-built artifacts means the server only needs to run the app.
