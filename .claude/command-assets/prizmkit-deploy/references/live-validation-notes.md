# Implementation Notes from Live Validation

These findings from the first PrizmKit deployment (PrizmIdeas) guide edge-case handling. Read when troubleshooting bootstrap or deploy issues.

1. **Detect port conflicts before installing Nginx.** Check what's on port 80/443 and ask before stopping anything, because overwriting an existing web server without confirmation can break unrelated services.

2. **Verify npm separately from node.** Minimal Node installs may not bundle npm. Run `which npm` after installing Node, because `node --version` succeeding doesn't guarantee npm is available.

3. **Fix locale on bare Ubuntu.** Run `locale-gen en_US.UTF-8` early to avoid perl warnings in apt. This is safe to run unconditionally even if locale is already configured.

4. **Deploy key workflow is inherently interactive.** Generate key → wait for user to add to GitHub → verify. Headless mode cannot complete this because it requires the user to paste the key into GitHub's UI.

5. **`pm2 startup` needs explicit PATH.** Always use `env PATH=$PATH:/usr/bin pm2 startup ...`, because the pm2 binary may not be on root's default PATH.

6. **Persist deploy metadata on server.** Write `activeColor`, `activePort`, `lastReleaseId`, `lastDeployTimestamp` to `shared/deploy-metadata.json`, because subsequent deploys and rollbacks depend on knowing the current active slot.

7. **Detect first deployment.** If no `current` symlink and no PM2 process for the app, skip rollback safety checks and use blue (3101) as initial color.

8. **Build-time env vars.** Copy `.env.production` before `npm run build`, not after. `NEXT_PUBLIC_*` vars are baked at build time and won't be picked up if the .env is added later.

9. **Node.js version flexibility.** Default to v22 LTS if v25 is unavailable. Most frameworks tolerate a minor version diff, and v22 has broader package compatibility.
