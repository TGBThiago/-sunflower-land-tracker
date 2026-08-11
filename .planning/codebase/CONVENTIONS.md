# Coding Conventions

**Analysis Date:** 2026-06-16

## Languages

- **JavaScript** (ES6+) — all application logic in a single `script.js` (503 lines)
- **CSS3** — dark theme with custom properties, in `style.css` (477 lines)
- **HTML5** — semantic markup with no framework, in `index.html` (148 lines)

No TypeScript, no transpilers, no build tools.

## Naming Patterns

**Files:**
- kebab-case: `script.js`, `style.css`, `index.html`

**Functions:**
- camelCase verb phrases: `carregarDados()`, `salvarRegistro()`, `atualizarTaxas()`, `exportarCSV()`
- Event handlers describe intent: `salvarRegistro`, `fecharModal`, `limparTudo`
- Prefix `atualizar` for UI update functions: `atualizarDisplayGema()`, `atualizarSaque()`, `atualizarCards()`
- Prefix `calcular` for computed values: `calcularEntradas()`

**Variables:**
- camelCase: `dados`, `taxas`, `lucroAcumulado`, `flowerEfetivo`
- Descriptive, Portuguese (pt-BR): `dados` (data), `taxas` (rates), `saque` (withdrawal)
- Boolean/counter variables follow same pattern with no prefix

**Constants:**
- UPPER_SNAKE_CASE for localStorage keys: `STORAGE_KEY`, `RATES_KEY`
- These are at module scope, line 1-2 of `script.js`

**DOM Element Refs:**
- Named after element ID or semantic role: `tbody`, `emptyMsg`, `modalOverlay`, `toast`
- Collected at module scope via `document.getElementById()`

**HTML IDs:**
- camelCase: `btnAdd`, `modalOverlay`, `taxaGold`, `fieldData` — consistent with JS variable names

**CSS Classes:**
- kebab-case with semantic grouping:
  - `.btn-*` for buttons: `.btn-add`, `.btn-csv`, `.btn-save`, `.btn-load`, `.btn-clear`
  - `.card-*` for card variations: `.card-patrimonio`, `.card-dolar`, `.card-lucro`
  - `.taxa-*` for rate inputs: `.taxa-bar`, `.taxa-item`, `.taxa-label`
  - `.saque-*` for withdrawal section: `.saque-card`, `.saque-input`, `.saque-value`
  - `.chart-*` for charts: `.chart-card`, `.charts-section`

**CSS Custom Properties:**
- `--two-letter-words`: `--bg`, `--text`, `--gold`, `--loss`, `--profit`, `--radius`, `--shadow`
- Descriptive compound: `--surface2`, `--flower-light`, `--radius-sm`, `--gold-dim`

## Code Style

**Formatting:**
- No autoformatter detected (no `.prettierrc`, no `.editorconfig`)
- 2-space indentation throughout
- Semicolons always present — terminated at every statement
- Single quotes for strings: `'sl_tracker_dados'`, `'Nenhum dado para exportar.'`
- Template literals used for string interpolation: `` `= $${dolar.toFixed(2)}` ``, `` `+${lucroFlowerStr}` ``

**Linting:**
- No linter detected (no `.eslintrc`, `eslint.config.*`, `biome.json`)
- No lint scripts defined

## Import Organization

**External Dependency:**
- Chart.js loaded via CDN in `index.html` line 145:
  ```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  ```
- Chart is a global (`Chart` constructor used directly in `script.js`)

**Internal:**
- `script.js` loaded after Chart.js in `index.html` line 146: `<script src="script.js"></script>`
- `style.css` loaded in `<head>` via `<link>` in `index.html` line 7
- No ES modules, no imports/exports — globals-only architecture

## Error Handling

**Patterns:**

1. **JSON.parse safety** — try/catch with fallback to empty state:
   ```javascript
   // script.js:54-60
   try {
     dados = JSON.parse(raw);
   } catch {
     dados = [];
   }
   ```
   Used for both `localStorage.getItem` reads (`carregarDados`, `carregarTaxas`) and `FileReader` JSON parsing (`carregarBackup`).

2. **Empty catch blocks** — catches with no handler body:
   ```javascript
   // script.js:72
   } catch {}
   ```
   This silently swallows parse errors. **Consider logging or user feedback.**

3. **Guard clauses** for early returns:
   ```javascript
   // script.js:242-247
   if (processados.length === 0) {
     emptyMsg.style.display = 'block';
     atualizarCards(null);
     atualizarGraficos([]);
     return;
   }
   ```

4. **confirm() dialogs** for destructive actions:
   ```javascript
   // script.js:187 — single confirm
   // script.js:195-197 — double confirm for "clear all"
   ```

5. **Toast notifications** for user feedback:
   ```javascript
   // script.js:498-502
   function mostrarToast(msg) { ... }
   ```
   Used for: success messages, validation errors, file read errors, empty-state warnings.

6. **Input validation** in form submission (`script.js:166-169`):
   ```javascript
   if (!data || gold < 0 || diamante < 0 || flower < 0 || saque < 0) {
     mostrarToast('Preencha todos os campos corretamente.');
     return;
   }
   ```

7. **Null/undefined checks** on DOM elements and optional properties:
   ```javascript
   if (spanTaxaGema) { ... }  // script.js:106
   d.obs || ''                // script.js:133
   ultimo.diamante || 0       // script.js:131
   ```

## Logging

**Framework:** None — no `console.log`, `console.warn`, or `console.error` calls detected anywhere in the codebase.

**User feedback only:**
- `mostrarToast(msg)` for visible UI notifications — the sole feedback mechanism
- No debug logging, no error reporting, no analytics

## Comments

**When to Comment:**
- Near-zero documentation comments in the codebase
- Only structural comments appear in CSS (e.g., section dividers implied by class organization)
- No JSDoc/TSDoc annotations anywhere
- No inline explanations of logic or formulas

**Recommendation:** Add JSDoc blocks for public functions, especially `calcularEntradas()` which contains core profit computation logic.

## Function Design

**Size:**
- Small to medium functions: 3–50 lines
- `renderizar()` is the largest at ~50 lines (includes inline HTML template strings)
- `calcularEntradas()` at 32 lines handles all core computation

**Parameters:**
- 0–2 parameters per function
- Index or data object passed for edit/delete operations
- Default: no default parameter values used

**Return Values:**
- `calcularEntradas()` returns a mapped array (pure-like, reads from closure `dados` and `taxas`)
- Most functions are void — they mutate state and update the DOM
- `formatarData()` returns a formatted string

## Module Design

**Exports:**
- No exports — zero module system usage
- All functions and variables are globals on `window`
- Functions referenced in `onclick` HTML attributes: `abrirModal(${i})`, `excluirRegistro(${i})`
- Event listeners wired via `addEventListener` in module-level code

**Barrel Files:**
- Not applicable (single-file architecture)

## State Management

**Pattern: Module-level mutable state**
```javascript
let dados = [];                           // script.js:25
let taxas = { ... };                      // script.js:26
let chartEvolucao = null;                 // script.js:27
let chartLucro = null;                    // script.js:28
```
- `dados` — array of daily records, persisted to `localStorage`
- `taxas` — exchange rates config object, persisted to `localStorage`
- Chart instances — managed as module-level refs for cleanup on re-render

**Persistence:** Two `localStorage` keys:
- `sl_tracker_dados` — JSON array of daily entries
- `sl_tracker_taxas` — JSON object of rate configs

**Data Shape (each `dados` entry):**
```javascript
{
  data: "2026-06-15",        // ISO date string
  gold: 3000,                // number
  diamante: 748,             // number (optional, defaults to 0)
  flower: 160,               // number
  saque: 200,                // number (optional, defaults to 0)
  obs: "texto"               // string (optional)
}
```

## DOM Manipulation Patterns

- `document.getElementById()` for all element references — collected once at module scope
- `innerHTML` for table rows and chart section creation — inline HTML template strings
- `document.createElement()` + `appendChild()` for table rows
- `classList.add()`/`classList.remove()` for toggling visibility (`ativo` class)
- CSS transitions/animations controlled by class toggles

## HTML Conventions

- `lang="pt-BR"` — Brazilian Portuguese locale
- Semantic elements: `<header>`, `<section>`, `<table>`, `<form>`
- `autocomplete="off"` on the modal form
- `type="number"` with `step="any" min="0"` for numeric inputs
- CDN-loaded Chart.js at version `4.4.0`

## CSS Conventions

- CSS custom properties (`:root` vars) for all colors, spacing, radius — consistent theming
- Dark theme by default (no light toggle)
- `box-sizing: border-box` global reset
- Responsive via `@media (max-width: 768px)`
- Hover/active/focus states for all interactive elements
- Transitions: `transition: all 0.2s` and `transition: transform 0.2s` patterns
- Animations: `@keyframes fadeIn`, `@keyframes slideUp` for modal overlay

---

*Convention analysis: 2026-06-16*
