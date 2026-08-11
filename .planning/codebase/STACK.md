# Technology Stack

**Analysis Date:** 2026-06-16

## Languages

**Primary:**
- JavaScript (ES6+) - All application logic in `script.js` (503 lines)
- HTML5 - Document structure in `index.html` (148 lines)
- CSS3 - Styling in `style.css` (477 lines) with CSS custom properties (`:root` variables) and modern layout (CSS Grid, Flexbox)

**Secondary:**
- None detected. No TypeScript, no preprocessors (SASS/LESS), no templating languages.

## Runtime

**Environment:**
- Browser-only (client-side SPA, no server runtime)

**Package Manager:**
- None detected. No `package.json`, `node_modules`, or lockfile present.
- All dependencies loaded via CDN `<script>` tags.

## Frameworks

**Core:**
- **Vanilla JavaScript** - No frontend framework (no React, Vue, Angular, Svelte, etc.)
- All DOM manipulation uses `document.getElementById()`, `document.createElement()`, and `element.innerHTML` directly.

**Testing:**
- None detected. No test framework, no test files.

**Build/Dev:**
- None detected. No build step, no bundler, no transpiler. Files served as-is from the filesystem.
- No linting or formatting tools configured.

## Key Dependencies

**Critical:**
- **Chart.js 4.4.0** (CDN) - Powers both charts in the app:
  - Line chart for "Evolução do Patrimônio" (asset evolution)
  - Bar chart for "Lucro / Prejuízo Diário" (daily profit/loss)
  - Loaded from `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`

**Infrastructure:**
- **Browser localStorage** - Primary data persistence mechanism:
  - Key `sl_tracker_dados`: Stores daily records array as JSON
  - Key `sl_tracker_taxas`: Stores conversion rates and settings as JSON
- **Blob API** - Used for file export (CSV and JSON backup downloads)
  - `URL.createObjectURL()` / `URL.revokeObjectURL()` pattern for triggering downloads
- **FileReader API** - Used for loading JSON backup files from disk
- **BOM (\uFEFF)** - UTF-8 BOM prefix added to CSV exports for Excel compatibility

## Configuration

**Environment:**
- No environment configuration files (no `.env`, no `config.js`).
- All configuration is runtime-based via HTML input fields in the "taxas" (rates) bar:
  - Gold-to-Flower conversion rate
  - Gem batch size and price (for diamond → Flower rate)
  - USD exchange rate for Flower token

**Build:**
- No build configuration files.

## Platform Requirements

**Development:**
- Any modern web browser (Chrome, Firefox, Edge, Safari)
- A local HTTP server is recommended but not strictly required (CORS and localStorage work on `file://` in most browsers)
- No Node.js, no npm, no build tools required

**Production:**
- Any static web host (GitHub Pages, Netlify, Vercel, S3, etc.)
- No server-side processing required
- No database setup needed

---

*Stack analysis: 2026-06-16*
