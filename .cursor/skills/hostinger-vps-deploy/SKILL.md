---
name: hostinger-vps-deploy
description: >-
  Deploy the Receipts app from the local working copy to the Hostinger VPS
  (receipts.mottoeducation.com) over SSH. Use only after the user says commit
  and deploy, together with zeabur-local-deploy. Application code only.
---

# Hostinger VPS deploy

Run this only after the user says **commit and deploy**, the commit is already on GitHub, and the Zeabur deploy has been started. Upload application code only.

## Target

| Item | Value |
|------|--------|
| SSH | `ssh -i %USERPROFILE%\.ssh\id_ed25519_hostinger -o BatchMode=yes root@187.77.159.20` |
| App directory | `/root/receipts` |
| Compose file | `docker-compose.hostinger.yml` |
| Container | `receipts-app` |
| Public URL | `https://receipts.mottoeducation.com` |

Do not print passwords. Do not edit `/root/motto/Caddyfile`, DNS, or any other container.

## PowerShell

From `c:\Motto Education\Receipts Application`. Run these separately. Strip CR before sending the remote script so `bash` does not see `\r`.

```powershell
tar --exclude=node_modules --exclude=.next --exclude=.git --exclude=Receipts --exclude=data --exclude=.env.local --exclude=.google-drive-token.json --exclude=*.traineddata -cf "$env:TEMP\receipts-src.tar" .
scp -i "$env:USERPROFILE\.ssh\id_ed25519_hostinger" -o BatchMode=yes "$env:TEMP\receipts-src.tar" root@187.77.159.20:/root/receipts-src.tar
```

Remote script (pass on stdin to `bash -s`):

```bash
set -euo pipefail
rm -rf /tmp/receipts-extract
mkdir -p /tmp/receipts-extract /root/receipts/data /root/receipts/Receipts
tar -xf /root/receipts-src.tar -C /tmp/receipts-extract
find /root/receipts -mindepth 1 -maxdepth 1 ! -name data ! -name Receipts -exec rm -rf {} +
cp -a /tmp/receipts-extract/. /root/receipts/
chown -R 1001:1001 /root/receipts/data /root/receipts/Receipts
cd /root/receipts
docker compose -f docker-compose.hostinger.yml up -d --build
docker compose -f docker-compose.hostinger.yml ps
```

## After deploy

Confirm `https://receipts.mottoeducation.com`, `https://booking.mottoeducation.com`, and `https://investment.mottoeducation.com` each return HTTP 200. Open the receipts site and confirm the changed page.
