# CLAUDE.md

## Process management

Always stop any dev server / background process you start in this repo before ending a turn or
starting another one. On this Windows + Git Bash setup, `kill <PID>` with the PID Bash reports
from `&`/background jobs does **not** reliably kill the real `node.exe` — Git Bash's MSYS PID and
the Windows PID differ. Use the `WINPID` column from `ps aux` and `taskkill //PID <WINPID> //F`
(or `Stop-Process -Id <id> -Force` in PowerShell) to actually kill it.

A leftover `node dist/main.js` or `nest start --watch` process causes two symptoms if a new one is
started on top of it:
- `EADDRINUSE: address already in use 0.0.0.0:3000` — the old process is still bound to the port.
- `Cannot find module './app.module'` from `dist/main.js` — `nest-cli.json` has
  `deleteOutDir: true`, so a watch-mode rebuild wipes `dist/` mid-run; a second process reading
  `dist/main.js` at that moment hits a half-written build.

Only one instance of the API should be running locally at a time.
