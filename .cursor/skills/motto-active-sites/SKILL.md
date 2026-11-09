---
name: motto-active-sites
description: >-
  Keeps every active Motto hostname on the shared Hostinger Caddy proxy.
  Use when adding a site, editing or copying a Caddyfile, or changing
  receipts.mottoeducation.com, investment.mottoeducation.com,
  booking.mottoeducation.com, or dev.mottoeducation.com. Do not remove an
  existing site when a new site is added.
---

# Active Motto sites

`/root/motto/Caddyfile` on `root@187.77.159.20` is the live proxy, mounted into `motto-caddy-1`. [Caddyfile](Caddyfile) in this skill is the saved copy. These hostnames stay active. Adding a site does not remove any of them.

| Hostname | Upstream |
|---|---|
| booking.mottoeducation.com | `app:3000` |
| dev.mottoeducation.com | `app-dev:3000` |
| investment.mottoeducation.com | `hsi-realtime-api:8080` |
| receipts.mottoeducation.com | `receipts-app:3000`, HTTP timeouts 5m |

## Add a site

1. Read the live `/root/motto/Caddyfile` and this skill's `Caddyfile`.
2. Write one file that contains every hostname from both, plus the new site. Keep each existing upstream and timeout. A hostname stays even when it belongs to another app.
3. Remove a hostname only when the user names that hostname and explicitly says to remove it.
4. Write that same file to all of these paths:
   - `/root/motto/Caddyfile`
   - `Caddyfile` beside this `SKILL.md`
   - `C:\Users\tiger_ylttsc4\.cursor\skills\motto-active-sites\`
   - `C:\Motto Education\Receipts Application\.cursor\skills\motto-active-sites\`
   - `C:\Motto Education\Booking System\.cursor\skills\motto-active-sites\`
   - `C:\Motto Education\Booking System\deploy\hostinger\Caddyfile`
5. Update the table in every copy of this `SKILL.md` so it matches the file.
6. Validate, then reload. Do not restart Caddy, and do not change DNS, Postgres, or other containers.

```bash
docker exec motto-caddy-1 caddy validate --config /etc/caddy/Caddyfile
docker exec motto-caddy-1 caddy reload --config /etc/caddy/Caddyfile
```

7. GET each hostname and confirm HTTP 200. On PowerShell use `curl.exe`.

SSH: `ssh -i %USERPROFILE%\.ssh\id_ed25519_hostinger -o BatchMode=yes root@187.77.159.20`. Strip CR from a remote script before `bash -s`. Do not print passwords.

Copy `deploy/hostinger/Caddyfile` onto the server only when it already contains every hostname in the saved `Caddyfile`.
