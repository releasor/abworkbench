# SSL/HTTPS Configuration (Let's Encrypt + Certbot)

Read this file when DNS is confirmed pointing to the server and SSL needs to be configured.

## Step 1 — Detect cloud vendor

```
# Try metadata endpoints to detect cloud vendor
curl -s --connect-timeout 2 http://100.100.100.200/latest/meta-data/ && echo "ALIBABA"
curl -s --connect-timeout 2 http://metadata.tencentyun.com/latest/meta-data/ && echo "TENCENT"
curl -s --connect-timeout 2 http://169.254.169.254/latest/meta-data/ && echo "AWS/GCP/AZURE"
```
Also check `/etc/hostname` for vendor patterns.

## Step 2 — Choose SSL strategy

- **Cloud vendor detected** → ask user:
  > "检测到服务器运行在 <云厂商>。用哪种 SSL 方案？"
  > - **A. Let's Encrypt 免费证书（推荐）** — 一行命令永久自动续期，最省心
  > - **B. <云厂商> 自有证书** — 需手动下载配置，1年有效期需手动续期
  >
  > 选 A 我直接帮你搞定；选 B 你需要在云控制台下载证书后告诉我路径。
- **No cloud vendor / unknown** → use certbot directly, no choice needed.

## Step 3 — Certbot install & certificate request

```
# Install certbot (idempotent)
which certbot || apt-get install -y certbot python3-certbot-nginx

# Request certificate
certbot --nginx -d <domain> -d www.<domain> --non-interactive --agree-tos --email <user-email>
```

**Collect from user before running:**
- Email address (Let's Encrypt expiry notifications)
- Confirm domain list (e.g., `example.com, www.example.com`)

## Step 4 — Verify auto-renewal

```
systemctl status certbot.timer
certbot renew --dry-run
```
If timer is inactive, enable it: `systemctl enable --now certbot.timer`.

## Step 5 — Record

- Write SSL configuration summary to deploy.md: certificate paths, auto-renewal status, expiry date.
- Record a `"ssl-setup"` event in deploy history.

## Edge cases

- **DNS not yet propagated** → certbot challenge fails. Tell user to wait and retry: `/prizmkit-deploy setup-ssl`.
- **Existing certificate found** → check expiry date (`certbot certificates`). If expiring within 30 days, warn. Otherwise skip.
- **Port 80/443 occupied by non-Nginx process** → report and ask how to resolve before proceeding.
