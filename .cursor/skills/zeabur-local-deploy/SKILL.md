---
name: zeabur-local-deploy
description: >-
  Deploy the Receipts app from the local working copy to Zeabur using the
  Zeabur CLI. Use only after the user says commit and deploy, together with
  hostinger-vps-deploy. Application code only.
---

# Zeabur local deploy

Run this only after the user says **commit and deploy** and that commit is already on GitHub `origin/master`. Then also follow `.cursor/skills/hostinger-vps-deploy/SKILL.md`. On PowerShell, set `$env:NODE_OPTIONS='--use-system-ca'` before `npx zeabur`.

## Target

| Item | Value |
|------|--------|
| Project ID | `6a5f92b2536b84a1337c9fd5` |
| Service ID (`receipts`) | `6a5f9361536b84a1337ca01d` |
| Environment ID | `6a5f92b2b0b7a4abeb4e6d6d` |
| Public URL | `https://receipts.zeabur.app` |

## PowerShell

From `c:\Motto Education\Receipts Application`:

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npx zeabur@latest deploy --project-id 6a5f92b2536b84a1337c9fd5 --service-id 6a5f9361536b84a1337ca01d --environment-id 6a5f92b2b0b7a4abeb4e6d6d -i=false
```

Do not chain this with `&&`.

## After deploy

Zeabur may keep building after the CLI returns. Open `https://receipts.zeabur.app` and confirm the changed page before reporting it live. If the CLI reports an auth failure, run `npx zeabur@latest auth login` and stop.
