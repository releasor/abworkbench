# CI/CD Workflow Templates

Read this file when `deployStrategy` is `ci-cd-push` or `ci-cd-pull`.

## Shared Configuration

**Secrets** (add to GitHub repository Settings → Secrets and variables → Actions):
- `SSH_HOST` — server IP/hostname
- `SSH_USER` — runtime user (e.g., `deploy`)
- `SSH_KEY` — SSH private key
- `SSH_PORT` — SSH port (default 22)

**Shared trigger:**
```yaml
on:
  push:
    branches: [<branch>]
    paths-ignore:
      - '.prizmkit/**'
      - 'docs/**'
```

---

## Push Mode Workflow (`ci-cd-push`)

Build happens on GitHub Actions runner. Only built artifacts are transferred to the server.

```yaml
name: Deploy to Production (Push)

on:
  push:
    branches: [<branch>]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install & Build
        run: |
          npm ci
          npm run build

      - name: Package & Transfer
        run: |
          RELEASE_ID=$(date +%Y%m%d)-$(git rev-parse --short HEAD)
          tar czf deploy-$RELEASE_ID.tar.gz \
            <build-output-dir>/ node_modules/ package.json package-lock.json
          scp -P ${{ secrets.SSH_PORT }} deploy-$RELEASE_ID.tar.gz \
            ${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:/var/www/<project>/releases/

      - name: Deploy on Server
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          port: ${{ secrets.SSH_PORT }}
          script: |
            cd /var/www/<project>
            RELEASE_ID=$(date +%Y%m%d)-$(git rev-parse --short HEAD)
            mkdir -p releases/$RELEASE_ID
            tar xzf releases/deploy-$RELEASE_ID.tar.gz -C releases/$RELEASE_ID
            rm releases/deploy-$RELEASE_ID.tar.gz
            # PM2 start, health check, Nginx switch (same as manual flow)
```

**Key difference from Pull:** the runner checks out code, installs, builds, and only transmits the result. The server doesn't need Git or build tools — just Node.js runtime and PM2.

---

## Pull Mode Workflow (`ci-cd-pull`)

GitHub Actions runner only triggers the server. The server does all the work.

```yaml
name: Deploy to Production (Pull)

on:
  push:
    branches: [<branch>]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Server Deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SSH_HOST }}
          username: ${{ secrets.SSH_USER }}
          key: ${{ secrets.SSH_KEY }}
          port: ${{ secrets.SSH_PORT }}
          script: |
            cd /var/www/<project>
            RELEASE_ID=$(date +%Y%m%d)-$(git rev-parse --short HEAD)
            mkdir -p releases/$RELEASE_ID
            git clone <repoUrl> --branch <branch> releases/$RELEASE_ID
            cd releases/$RELEASE_ID
            npm ci
            cp ../shared/.env.production .
            npm run build
            # PM2 start, health check, Nginx switch
```

**Key difference from Push:** the workflow is simpler (one step: SSH + run script), but the server needs Git, full build toolchain, and must be able to reach the repo.

After generating the workflow, verify: the first `git push` to the configured branch will trigger the first deployment. Monitor the GitHub Actions run and report results.
