# DNS Setup Guidance

Read this file when the user has a domain for their project but DNS is not yet pointing to the server.

## Step 1 — Check DNS resolution

```
dig +short <domain> A
```

If it resolves to the server IP: DNS is already configured, proceed to SSL (`references/ssl-setup.md`).
If not: continue below.

## Step 2 — DNS setup guidance

```
域名 <example.com> 还未指向服务器 <服务器IP>。

请在 DNS 服务商（如阿里云、Cloudflare、Namecheap）添加以下记录：

  Type:  A
  Name:  @
  Value: <服务器IP>
  TTL:   600

如果要同时支持 www 子域名：
  Type:  A
  Name:  www
  Value: <服务器IP>

配置完成后回复"好了"，我继续检查并配 SSL 证书。
```

## Step 3 — Verify after user confirmation

- Re-run `dig +short <domain> A` to confirm resolution.
- If still not resolved: warn about DNS propagation delay (can take up to 48 hours, usually 5-30 minutes). Offer to wait or continue without SSL for now.
- Once confirmed: proceed to SSL (`references/ssl-setup.md`).

## Edge case — IP-only deployment

If user has no domain: skip DNS + SSL sections. Generate a note in deploy.md: "项目通过 IP 访问，未配置域名和 HTTPS。建议购买域名后运行 `/prizmkit-deploy setup-ssl`。"
