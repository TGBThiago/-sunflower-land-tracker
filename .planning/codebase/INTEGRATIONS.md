# External Integrations

**Analysis Date:** 2026-06-16

## APIs & External Services

**CDN / Asset Hosting:**
- **jsdelivr** - Used to load Chart.js 4.4.0
  - URL: `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`
  - Pinned to exact version 4.4.0 (no semver range)
  - Loaded synchronously in `<head>` before `script.js`

**External APIs:**
- None detected. The app makes no HTTP requests to any external API.
- No REST, GraphQL, WebSocket, or RPC calls. All data is local.

## Data Storage

**Databases:**
- **Browser localStorage** (client-side only)
  - Connection: Implicit via `window.localStorage` API
  - Client: Native Web Storage API
  - Data stores:
    - `sl_tracker_dados` — Array of daily records (JSON-serialized)
    - `sl_tracker_taxas` — Settings object with conversion rates (JSON-serialized)
  - Limitations: ~5MB per origin, synchronous API, string-only values

**File Storage:**
- Local filesystem only (for user-triggered exports/imports)
  - **CSV Export**: Generates and downloads a CSV file with UTF-8 BOM
    - Naming pattern: `sunflower-land-{YYYY-MM-DD}.csv`
    - Trigger: "Exportar CSV" button
  - **JSON Backup Export**: Generates and downloads a full backup JSON
    - Naming pattern: `sunflower-backup-{YYYY-MM-DD}.json`
    - Contains: `{ dados, taxas, exportadoEm }`
    - Trigger: "Salvar Backup" button
  - **JSON Backup Import**: Reads a previously exported JSON backup
    - Trigger: "Carregar Backup" button → file picker → `FileReader.readAsText()`

**Caching:**
- None. No Service Worker, no Cache API, no IndexedDB usage.

## Authentication & Identity

**Auth Provider:**
- None. No authentication system. No user accounts, no sessions, no API keys.
- All data is local to the browser and not synced to any server.

## Monitoring & Observability

**Error Tracking:**
- None. No Sentry, no error logging service.
- Error handling is limited to `try/catch` blocks around localStorage `JSON.parse()` calls.

**Logs:**
- None. No structured logging framework. No `console.log` calls found in production code.

## CI/CD & Deployment

**Hosting:**
- Not detected. The project is a set of static files with no deployment configuration.
- Compatible with any static hosting (GitHub Pages, Netlify, Vercel, Cloudflare Pages, S3, etc.) but none configured.

**CI Pipeline:**
- None detected. No CI configuration files (no `.github/workflows/`, no `.gitlab-ci.yml`, no `Jenkinsfile`).

## Environment Configuration

**Required env vars:**
- None. The application has zero environment variable dependencies.

**Secrets location:**
- Not applicable. No secrets, no API keys, no tokens in the codebase.

## Webhooks & Callbacks

**Incoming:**
- None. No webhook endpoints. No server-side component exists.

**Outgoing:**
- None. No webhook calls. The app does not make any HTTP requests.

---

## Data Flow Summary

```
User Input (HTML Form)
  → JavaScript (script.js)
    → localStorage (persistence)
    → DOM Rendering (table + cards)
    → Chart.js (canvas charts)
  → User-Initiated Export
    → Blob → Download (CSV / JSON)
User-Initiated Import
  → FileReader → JSON.parse → localStorage → Rerender
```

All data flows are local. No data leaves the browser unless the user manually downloads a file.

---

*Integration audit: 2026-06-16*
