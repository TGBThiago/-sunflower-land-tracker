<!-- refreshed: 2026-06-16 -->
# Architecture

**Analysis Date:** 2026-06-16

## System Overview

```text
┌────────────────────────────────────────────────────────────────┐
│                     UI Layer (index.html)                       │
├─────────────┬───────────────┬──────────────┬───────────────────┤
│   Cards     │  Taxas Bar    │   Actions    │   Table/Wrapper   │
│   (5 cards) │  (5 rates)    │  (6 btns)    │   (13 columns)    │
└──────┬──────┴──────┬────────┴──────┬───────┴────────┬──────────┘
       │             │               │                │
       ▼             ▼               ▼                ▼
┌────────────────────────────────────────────────────────────────┐
│                 Presentation Layer (style.css)                  │
│   CSS custom properties  ·  Flexbox/Grid layout  ·  Animations │
│   Dark theme  ·  Responsive breakpoints          ·  Modal/Toast │
└────────────────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────────────────┐
│                  Application Logic (script.js)                  │
│   DOM binding  ·  State management  ·  Calculations  ·  Charts │
│   Export/Import ·  Toast notifications                         │
└──────┬───────────────────────┬───────────────────┬─────────────┘
       │                       │                   │
       ▼                       ▼                   ▼
┌──────────────┐    ┌──────────────────┐   ┌────────────────────┐
│  localStorage │    │  File System     │   │  Chart.js CDN      │
│  (persistence)│    │  (CSV/JSON I/O)  │   │  (visualization)   │
└──────────────┘    └──────────────────┘   └────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Page Structure | Defines DOM sections, modal form, toast element | `index.html` |
| Visual Styling | Dark theme, grid layout, responsive breakpoints, animations | `style.css` |
| State & Logic | CRUD operations, calculations, persistence, export/import | `script.js` |

## Pattern Overview

**Overall:** Single-Page Application — procedural vanilla JavaScript with DOM-centric rendering.

**Key Characteristics:**
- **No frameworks or build tools** — pure HTML5/CSS3/ES6+ JavaScript (no imports, no modules, no bundler)
- **Module-level mutable state** — all application data lives in global `let` variables at the top of `script.js`
- **Imperative DOM rendering** — `renderizar()` rebuilds the entire `<tbody>` and chart DOM subtree on every state change
- **localStorage as primary persistence** — data survives page reloads via `JSON.stringify`/`JSON.parse`
- **Event-driven recalculations** — input events on rate fields trigger immediate recalculation and re-render
- **File-based backup cycle** — manual JSON backup (save/load) and CSV export; no auto-backup or cloud sync

## Layers

**UI Layer (HTML):**
- Purpose: Defines the document structure — summary cards, rate inputs, action buttons, data table, modal form, toast notification, and chart containers
- Location: `index.html` (148 lines)
- Contains: Semantic HTML5 sections (`<section class="cards">`, `<section class="taxas-bar">`, `<section class="actions">`, `<section class="table-wrapper">`), a modal overlay with form (`<div class="modal-overlay">`), and a toast notification (`<div class="toast">`)
- Depends on: `style.css` (via `<link>`) and `script.js` + Chart.js CDN (via `<script>`)
- Used by: Browser rendering engine

**Presentation Layer (CSS):**
- Purpose: Dark theme styling, responsive grid layout, component aesthetics, animations
- Location: `style.css` (477 lines)
- Contains: CSS custom properties (`:root`), flexbox/grid layouts, modal/toast transitions, responsive media query at 768px
- Depends on: None (standalone)
- Used by: `index.html`

**Application Logic Layer (JS):**
- Purpose: All application behavior — CRUD, calculations, persistence, export/import, chart rendering, toast notifications
- Location: `script.js` (503 lines)
- Contains: 17 functions, 4 module-level state variables, event binding, Chart.js integration, localStorage persistence
- Depends on: `index.html` DOM (via `getElementById`), Chart.js CDN (global `Chart` constructor), `localStorage` browser API, `Blob`/`URL.createObjectURL` for file downloads
- Used by: `index.html` (loaded at end of `<body>`)

## Data Flow

### Primary Request Path (Add/Edit Record)

1. User clicks "+ Adicionar Dia" → `btnAdd` click event fires `abrirModal()` (`script.js:39`)
2. Modal overlay displayed — form pre-filled with last record's values or today's date (`script.js:119-148`)
3. User fills form and clicks "Salvar" → `modalForm` submit event fires `salvarRegistro(e)` (`script.js:44`)
4. Form data extracted via `getElementById`, validated, wrapped in entry object (`script.js:156-185`)
5. Entry appended (or updated at index) in `dados[]` array, persisted via `salvarDados()` → `localStorage.setItem()` (`script.js:63-65`)
6. `renderizar()` called → `calcularEntradas()` processes all records with current rates (`script.js:204-236`)
7. `tbody.innerHTML` rebuilt row-by-row with computed values (`script.js:238-282`)
8. `atualizarCards()` updates 5 summary card DOM elements (`script.js:284-305`)
9. `atualizarGraficos()` destroys and recreates 2 Chart.js charts (`script.js:307-389`)

### Delete Record

1. User clicks "Excluir" row button → `excluirRegistro(index)` (`script.js:187-193`)
2. `confirm()` dialog shown; if accepted, `dados.splice(index, 1)`
3. `salvarDados()` persists to localStorage
4. `renderizar()` re-renders table, cards, and charts

### Rate Change Flow

1. User types in any `<input>` inside `.taxas-bar` → `atualizarTaxas()` (`script.js:93-103`)
2. All 5 rate values read from DOM, `taxas` object updated, persisted to localStorage via `salvarTaxas()`
3. Derived rate (gema/Flower) computed and displayed in readonly `<span>`
4. Saque USD value recalculated via `atualizarSaque()`
5. Full `renderizar()` called to refresh all computed columns

### CSV Export Flow

1. User clicks "Exportar CSV" → `exportarCSV()` (`script.js:391-430`)
2. `calcularEntradas()` re-computes all derived values
3. Header + data rows assembled, each cell wrapped in quotes with `"` escaping
4. UTF-8 BOM (`\uFEFF`) prepended for Excel compatibility
5. `Blob` created → temporary `<a>` link clicked → file downloaded as `sunflower-land-YYYY-MM-DD.csv`

### JSON Backup Load Flow

1. User clicks "Carregar Backup" → hidden `<input type="file">` triggered (`script.js:48`)
2. File selected → `carregarBackup(e)` reads file via `FileReader` (`script.js:460-496`)
3. JSON parsed, validated (`backup.dados` must be array), `dados` and `taxas` replaced
4. All input fields updated to match loaded taxas
5. `salvarDados()` + `salvarTaxas()` persist to localStorage
6. `renderizar()` refreshes all UI

**State Management:**
- **Module-level variables** in `script.js`: `dados` (array of raw entries), `taxas` (rates/settings object), `chartEvolucao` / `chartLucro` (Chart.js instance references for cleanup)
- **localStorage keys:** `sl_tracker_dados` (entry list), `sl_tracker_taxas` (rates/settings)
- **No state management library** — all state mutations are manual assignments followed by explicit `salvar*()` + `renderizar()` calls
- **Singleton pattern for charts** — previous chart instances destroyed before creating new ones to prevent memory leaks

## Key Abstractions

**Entry Object:**
- Purpose: Represents a single day's tracked data (raw user input)
- Shape: `{ data: string, gold: number, diamante: number, flower: number, saque: number, obs: string }`
- Location: Created inline in `salvarRegistro()` (`script.js:172`)
- Pattern: Plain object literal, pushed into `dados[]` or updated at index

**Computed Entry (Processed):**
- Purpose: Entry enriched with derived/converted values at render time
- Shape: `{ ...entry, conversao, diamanteTaxa, valorDolar, goldFlower, diamanteFlower, totalFlower, totalDolar, lucroFlower, lucroDolar }`
- Location: `calcularEntradas()` (`script.js:204-236`)
- Pattern: Derived on every render — never stored, always computed from `dados` + current `taxas`

**Rates Object:**
- Purpose: Conversion rates and settings that apply to all entries
- Shape: `{ conversao: number, diamanteTaxa: number, valorDolar: number, qtdGemas: number, precoLote: number, saqueFlower: number }`
- Location: Module-level `let taxas = {...}` (`script.js:26`)
- Pattern: Persisted independently in localStorage; loaded on page init; rates from last entry's snapshot used as fallback if no saved rates exist

## Entry Points

**Page Initialization:**
- Location: `script.js:30-32` (top-level execution)
- Triggers: Script loaded at end of `<body>` in `index.html:146`
- Responsibilities: `carregarDados()` restores `dados` from localStorage, `carregarTaxas()` restores rates and syncs DOM inputs, `renderizar()` builds initial UI

**User Interactions (6 event listeners in `script.js:34-50`):**
- `inputTaxaGold|QtdGemas|PrecoLote|Dolar.addEventListener('input', atualizarTaxas)` — rate change recalculation
- `btnAdd.addEventListener('click', () => abrirModal())` — open modal for new record
- `btnCancelar.addEventListener('click', fecharModal)` — close modal
- `modalOverlay.addEventListener('click', ...)` — close modal on overlay click
- `modalForm.addEventListener('submit', salvarRegistro)` — form submission (add/edit)
- `btnExport.addEventListener('click', exportarCSV)` — CSV download
- `btnClear.addEventListener('click', limparTudo)` — confirm and clear all data
- `btnSave.addEventListener('click', salvarBackup)` — JSON file download
- `btnLoad.addEventListener('click', () => fileInput.click())` — trigger file picker
- `fileInput.addEventListener('change', carregarBackup)` — handle selected backup file
- `saqueFlower.addEventListener('input', atualizarSaque)` — live withdrawal USD conversion

## Architectural Constraints

- **Single-threaded:** All operations run on the browser's main thread. Charts, file I/O, and JSON parsing can cause brief UI freezes on large datasets.
- **Global mutable state:** Four `let` variables at module scope in `script.js:25-28` (`dados`, `taxas`, `chartEvolucao`, `chartLucro`). Any function can mutate them, making reasoning about state changes harder as the codebase grows.
- **Full DOM rebuild on every change:** `renderizar()` sets `tbody.innerHTML = ''` and recreates all rows + charts. This is O(n) DOM operations per render — fine for small datasets, but does not scale efficiently.
- **No dependency injection:** DOM references are captured via `getElementById()` at module scope (`script.js:3-23`), creating implicit coupling between JS and HTML structure. Any change to an element's `id` requires updating both files.
- **No module system:** Everything lives in the global scope (`script.js`). Functions reference each other directly, and inline `onclick` handlers in rendered HTML (`script.js:273-274`) rely on global function visibility.

## Anti-Patterns

### Inline `onclick` in generated HTML

**What happens:** Row action buttons use `onclick="abrirModal(${i})"` and `onclick="excluirRegistro(${i})"` inside template literals (`script.js:273-274`).
**Why it's wrong:** Inline event handlers are eval'd from global scope, coupling the rendered HTML to global function names. This prevents proper encapsulation and makes it harder to change function signatures.
**Do this instead:** Use event delegation — attach a single click listener on `<tbody>` and determine the row index from the DOM (e.g., `data-index` attribute or `closest('tr')` position). See `modalOverlay` click delegation pattern at `script.js:41-43` for a good example.

### Full DOM rebuild on render

**What happens:** `renderizar()` clears `tbody.innerHTML` and rebuilds every `<tr>` from scratch on any data change (`script.js:238-282`).
**Why it's wrong:** Destroys and recreates all DOM nodes even when only one row changes. Loses internal state (e.g., input focus, scroll position). With large datasets, this causes noticeable jank.
**Do this instead:** Build only the changed row. Track a `lastRender` checksum or use document fragments for batch insertions of new rows only.

### Module-level DOM references

**What happens:** 22 `getElementById()` calls at module scope (`script.js:3-23`) capture DOM elements before the module is even fully initialized.
**Why it's wrong:** If an element ID changes, the reference silently becomes `null` and needs a JS change too. Creates tight HTML-JS coupling.
**Do this instead:** Use `querySelector` at usage time, or provide a thin initialization function that captures references after DOM ready.

## Error Handling

**Strategy:** Minimal — nullish defaults and try/catch around deserialization only.

**Patterns:**
- **parseFloat with fallback:** All numeric inputs use `parseFloat(x) || 0` to coerce invalid input to zero (`script.js:94-98`)
- **JSON parse try/catch:** `carregarDados()` (`script.js:52-61`) and `carregarTaxas()` (`script.js:67-87`) wrap `JSON.parse` in try/catch, falling back to empty array/default object on failure
- **File validation:** `carregarBackup()` checks `backup.dados` is an array before assigning (`script.js:469`); shows toast on invalid file
- **Guard clauses:** `exportarCSV()` and `salvarBackup()` abort with toast if `dados.length === 0` (`script.js:392-395`, `script.js:439-442`)
- **No structured error types:** All errors handled generically; no distinction between validation errors, storage errors, or file I/O errors

## Cross-Cutting Concerns

**Logging:** None — user-facing feedback is provided exclusively via toast notifications (`mostrarToast()`); no console logging or error reporting to external services.

**Validation:**
- Form validation in `salvarRegistro()` checks for empty date and negative values (`script.js:166-169`)
- All numeric input uses `step="any"`/`min="0"` HTML attributes for basic browser-level validation
- No cross-field validation (e.g., gold must be >= previous day's gold)

**Authentication:** None — this is a client-only SPA with no server, no user accounts, and no auth.

---

*Architecture analysis: 2026-06-16*
