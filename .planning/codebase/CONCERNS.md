# Codebase Concerns

**Analysis Date:** 2026-06-16

## Tech Debt

### Single monolithic script with no modularization
- **Issue:** All 503 lines of application logic live in a single `script.js` file — no separation between data access, calculation, rendering, UI event binding, or chart management. There is no module system (no ES modules, no bundler).
- **Files:** `script.js`
- **Impact:** Any change risks breaking unrelated features. Testing individual units is impossible without extraction. Onboarding requires understanding the entire file.
- **Fix approach:** Split into at least `storage.js` (localStorage read/write), `calculations.js` (profit/loss math), `renderer.js` (table/chart DOM manipulation), and `ui.js` (event binding, modal, toast). Each module should be a separate `.js` file loaded via ES module `<script type="module">` or bundled.

### InnerHTML used for all DOM construction — no sanitization
- **Issue:** `renderizar()` builds table rows and chart sections via template literals assigned to `innerHTML`. The `obs` field from user data is interpolated directly without any escaping, creating an XSS vector.
- **Files:** `script.js` lines 259–276 (`tr.innerHTML = \`...\``), line 325 (`section.innerHTML = \`...\``)
- **Impact:** If a malicious `obs` value is imported via backup file or manually entered, it can execute arbitrary JavaScript in the context of the application.
- **Fix approach:** Use `document.createElement()` + `textContent` for user-supplied values, or sanitize with `textContent` assignment into wrapper elements. Never interpolate user data directly into `innerHTML`.

### Empty catch blocks swallowing errors
- **Issue:** Three `catch` blocks in `script.js` (lines 57–58, 72, 490–491) are empty or near-empty. JSON parse failures in localStorage reads and backup file loading are silently ignored, causing the app to fall back to empty state without user feedback.
- **Files:** `script.js` lines 57–58 (`catch { dados = []; }`), line 72 (`catch {}`), lines 490–491 (`catch { mostrarToast('Erro ao ler o arquivo.'); }`)
- **Impact:** Corrupted localStorage data silently resets all records. Invalid backup files show a bare "Erro ao ler o arquivo" toast with no diagnostic info — the actual error is lost.
- **Fix approach:** Log the error object to console (`console.error`) in every catch block, at minimum.

### Global mutable state with no encapsulation
- **Issue:** `dados` (line 25), `taxas` (line 26), `chartEvolucao` (line 27), and `chartLucro` (line 28) are module-level globals. Any function can mutate them directly. No getters/setters or validation layer exists.
- **Files:** `script.js` lines 25–28
- **Impact:** Hard to trace who mutated state when a bug occurs. Impossible to add validation or side-effect hooks (e.g., auto-save on mutation) without rewriting all assignments.
- **Fix approach:** Encapsulate `dados` and `taxas` behind a data store object with `get()`, `set()`, `subscribe()` methods. Use a simple state management pattern.

### Duplicated default rate values
- **Issue:** Default conversion rates (`conversao: 2`, `diamanteTaxa: 0.077063`, `valorDolar: 0.50`, `qtdGemas: 2800`, `precoLote: 215.77`) exist in both `script.js` line 26 (the `taxas` literal) and in the HTML `value` attributes in `index.html` lines 42–63. They can drift apart.
- **Files:** `index.html` lines 42, 47, 52, 62; `script.js` line 26
- **Impact:** If defaults are updated in one place but not the other, the app may show inconsistent behavior on clean first load.
- **Fix approach:** Define defaults once in JavaScript and set the HTML `value` attributes dynamically from JS on first load, or use a single source of truth.

### `renderizar()` full-rebuild on every state change
- **Issue:** Every call to `renderizar()` destroys and recreates the entire table body (`tbody.innerHTML = ''`), recalculates all entries via `calcularEntradas()`, and destroys/recreates both Chart.js instances — even for single-row edits.
- **Files:** `script.js` lines 238–282, 307–389
- **Impact:** Performance degrades linearly with number of rows. Chart transitions are lost (animated re-creation instead of `.data.update()`). Unnecessary DOM reflows.
- **Fix approach:** Update only affected rows via DOM manipulation. Use Chart.js `update()` method instead of `destroy()` + `new Chart()`.

### Chart.js loaded from CDN with no fallback
- **Issue:** Chart.js v4.4.0 is loaded via `<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/...">` in `index.html` line 145 with no local fallback or SRI hash.
- **Files:** `index.html` line 145
- **Impact:** If the CDN is down or the URL changes, charts silently break (no graceful degradation). No subresource integrity means an injected CDN script would be trusted.
- **Fix approach:** Add `integrity` attribute with SRI hash, or bundle chart.js locally, or use `Chart` reference check + fallback message.

### `salvarTaxas()` called on every keystroke
- **Issue:** `atualizarTaxas()` (line 93) and `atualizarSaque()` (line 111) both call `salvarTaxas()`, which writes to `localStorage`. These are bound to `input` events (line 34–37, 50), so every keystroke in the tax rates fields or withdrawal field triggers a synchronous localStorage write.
- **Files:** `script.js` lines 34–37, 50, 93–103, 111–117
- **Impact:** Performance overhead from repeated serialization. Wears out localStorage (limited writes). Potential race if tab is closed mid-write.
- **Fix approach:** Debounce with `setTimeout` or save only on blur/change, not on every input event.

## Known Bugs

### Convoluted fallback logic in `carregarTaxas()` line 82
- **Symptoms:** The expression `taxas.precoLote || (taxas.diamanteTaxa * (taxas.qtdGemas || 2800)).toFixed(2) || 215.77` mixes potential `null`/`undefined` with numeric `.toFixed(2)` which returns a string. If `taxas.diamanteTaxa` is `0` (valid), the product is `0`, then `.toFixed(2)` returns `"0.00"` which is truthy, so the display gets `"0.00"` as a string rather than `215.77`. This produces a misleading default.
- **Files:** `script.js` line 82
- **Trigger:** Load with `qtdGemas > 0` but `diamanteTaxa = 0` and no `precoLote` in stored rates.
- **Workaround:** Manually type a value into the "custa" field.
- **Fix approach:** Separate the fallback logic into clear conditional steps, not chained `||` operators.

### Re-entrancy between `atualizarSaque()` and `salvarTaxas()`
- **Symptoms:** `atualizarSaque()` calls `salvarTaxas()` (line 116). `salvarTaxas()` does not call `atualizarSaque()`. However, `atualizarTaxas()` calls both `salvarTaxas()` (line 99) and `atualizarSaque()` (line 101). The chain is: `input event → atualizarTaxas() → salvarTaxas() + atualizarSaque() → salvarTaxas()` — two `salvarTaxas()` calls per event. While not harmful (no infinite loop), it's wasteful.
- **Files:** `script.js` lines 99, 101, 116
- **Trigger:** Every keystroke in the Gold, Gem lot, or Dollar fields.
- **Fix approach:** Remove the `salvarTaxas()` call from `atualizarTaxas()` and have callers call `salvarTaxas()` once after all updates.

### Negative number bypass via HTML5 `min="0"`
- **Symptoms:** HTML inputs have `min="0"` but this is only enforced by the browser on submit (or not at all for `type="number"` in some browsers). The JavaScript validation at `script.js` line 166 checks for `< 0` after `parseFloat` but any non-numeric text (e.g., `"abc"`) passes `parseFloat` as `NaN`, which is not `< 0`, so invalid data can be stored.
- **Files:** `script.js` lines 160–163, 166–169; `index.html` lines 42, 47, 52, 62, 76, 117, 121, 125, 129
- **Trigger:** Entering text like `"abc"` in numeric fields.
- **Workaround:** Manually correct the entry.
- **Fix approach:** Use `isNaN()` check alongside the comparison in `script.js` line 166: `if (!data || isNaN(gold) || gold < 0 || ...)`.

### First-row profit always shows as zero
- **Symptoms:** In `calcularEntradas()`, the first entry (`i === 0`) always receives `lucroFlower = 0` and `lucroDolar = 0` because there is no prior row to compare against. This is semantically misleading — the first day's delta from zero is not displayed.
- **Files:** `script.js` lines 214–216
- **Trigger:** Viewing the first row of data.
- **Fix approach:** Treat day-before-first as zero baseline: calculate `lucroFlower = totalFlowerEfetivo - 0` for `i === 0` using the same formula structure.

## Security Considerations

### XSS via backup restore and `obs` field
- **Risk:** The `obs` field is rendered via `innerHTML` without sanitization in `renderizar()` line 271 (`<td>${p.obs || '-'}</td>`). An attacker can craft a JSON backup file containing `"obs": "<img src=x onerror=alert(1)>"` that executes when loaded.
- **Files:** `script.js` lines 259–271, 474–484
- **Current mitigation:** None. The `obs` field is only user-entered (no shared/public input), but the backup load mechanism means any external `.json` file can inject code.
- **Recommendations:** Replace `innerHTML` with `document.createElement('td')` + `textContent` for the `obs` column. Validate backup file schema on import using a typed parser.

### No subresource integrity on Chart.js CDN
- **Risk:** `index.html` line 145 loads Chart.js without an `integrity` attribute. If the CDN is compromised, the loaded script has full access to the page DOM, localStorage, and user data.
- **Files:** `index.html` line 145
- **Current mitigation:** HTTPS URL mitigates MITM, but CDN compromise is still a risk.
- **Recommendations:** Add `integrity` attribute with the correct SRI hash for the exact version, or bundle Chart.js locally.

## Performance Bottlenecks

### Full table and chart rebuild on every data change
- **Problem:** Every mutation (add, edit, delete row, change tax rate, clear all) calls `renderizar()` which destroys and rebuilds the entire `<tbody>` and both Chart.js instances. With 100+ rows this causes noticeable UI lag and flicker.
- **Files:** `script.js` lines 238–282, 307–389
- **Cause:** No granular DOM diffing. The entire table is rebuilt from `calcularEntradas()` output regardless of what changed.
- **Improvement path:** Track dirty state. For row mutations, update only affected rows via `row.replaceChildren(...)`. For chart, use `chart.data.labels = ...; chart.update()` instead of destroy+recreate.

### `calcularEntradas()` recalculates all rows on every render
- **Problem:** Every render iterates all entries to recompute gold→flower conversions, diamond→flower, totals, and deltas — even when only one row changed.
- **Files:** `script.js` lines 204–236
- **Cause:** No memoization or cached intermediate results. The `dados` array is treated as the only source of truth.
- **Improvement path:** Compute deltas incrementally. When a new row is appended, only compute its delta against the previous row. When a rate changes, recompute all (but only once, not per render).

### Chart destroy+recreate instead of in-place update
- **Problem:** Each render calls `chartEvolucao.destroy()` and `chartLucro.destroy()`, then `new Chart(...)` for each. This loses chart animation transitions and creates unnecessary GC pressure.
- **Files:** `script.js` lines 312–313, 338–388
- **Cause:** Unknown Chart.js `update()` API or convenience.
- **Improvement path:** Use `chartEvolucao.data.labels = newLabels; chartEvolucao.data.datasets[0].data = newData; chartEvolucao.update();`. Only recreate if chart type changes.

## Fragile Areas

### Sequential index arithmetic in profit calculation
- **Files:** `script.js` lines 216–225
- **Why fragile:** `calcularEntradas()` assumes `dados[i-1]` always exists for `i > 0`. If the `dados` array is sorted, filtered, or manipulated out of order, the index-based comparison becomes incorrect. If rows are reordered (not currently possible in UI, but future-proofing), deltas break entirely.
- **Safe modification:** Use date-based ordering explicitly. Sort `dados` by date before calculation. If adding drag-to-reorder, profit calculations must reference the chronologically previous entry, not the array predecessor.

### localStorage as sole persistence with no export reminder
- **Files:** `script.js` lines 53, 64, 68, 90
- **Why fragile:** All data is in browser localStorage. Clearing browser data, using private/incognito mode, or switching devices loses everything. There is no periodic auto-backup or prompt to export.
- **Safe modification:** Add an auto-backup reminder (e.g., show a toast "Há 7 dias sem backup" if last backup date is old). Consider using `navigator.storage.persist()` to prevent storage clearing.

### Backup restore with no schema validation
- **Files:** `script.js` lines 460–496
- **Why fragile:** `carregarBackup()` only checks `!backup.dados || !Array.isArray(backup.dados)`. It does not validate individual record fields (e.g., `data` must be a valid date string, `gold` must be a number). Malformed backups silently propagate corrupt data.
- **Safe modification:** Add a `validateEntry(entry)` function that checks field types, ranges, and required keys before accepting backup data. Reject and report specific invalid entries.

## Scaling Limits

### localStorage capacity ceiling
- **Current capacity:** localStorage is typically capped at ~5MB per origin. With ~270 bytes per daily record (JSON-serialized), that's ~18,500 entries before overflow. With taxes and backup metadata, reduce to ~15,000.
- **Limit:** Throwing `QuotaExceededError` on `localStorage.setItem()` when full.
- **Scaling path:** Add overflow detection: catch `QuotaExceededError` and show a warning to export/archive old data. Alternatively, migrate to IndexedDB which offers larger limits and better querying.

### DOM table performance with many rows
- **Current capacity:** 100 rows renders acceptably on modern hardware. At 500+ rows, full-table rebuild causes multi-second pauses.
- **Limit:** Browser tab becomes unresponsive on slower devices.
- **Scaling path:** Implement pagination (e.g., 50 rows per page) or virtual scrolling. Only render rows in the current viewport.

## Dependencies at Risk

### Chart.js v4.4.0 (CDN)
- **Risk:** Single external dependency loaded from CDN with no fallback, no integrity hash, and no version pin beyond the URL path. If `cdn.jsdelivr.net` goes down or the library has a breaking change (even a patch bump could alter behavior), the app breaks.
- **Impact:** Charts empty, `new Chart(...)` throws ReferenceError, page is still usable but charts are gone.
- **Migration plan:** Download the UMD bundle to a local `vendor/` directory and reference it, or add SRI integrity attribute. Use `<script>` with a fallback that loads from a secondary CDN.

## Missing Critical Features

### No input validation on backup restore
- **Problem:** `carregarBackup()` blindly accepts any JSON with a `dados` array. It does not validate per-record fields, types, or required keys. Corrupt or malicious backup files can populate the app with invalid data (negative gold, non-date strings, missing fields).
- **Files:** `script.js` lines 460–496
- **Blocks:** Reliable data exchange between users. Manual backup integrity verification is impossible.
- **Priority:** High

### No data versioning or migration path
- **Problem:** The backup JSON has no `version` field. If the data schema changes in the future (e.g., adding a new currency field), old backups become unreadable or produce incorrect calculations with no migration.
- **Files:** `script.js` line 444 (`const backup = { dados, taxas, exportadoEm }`)
- **Blocks:** Future schema evolution without data loss.
- **Priority:** Medium

### No undo/redo capability
- **Problem:** Deleting a row or clearing all data is irreversible after the `confirm()` dialog. There is no undo mechanism.
- **Files:** `script.js` line 189 (`dados.splice(index, 1)`), lines 195–202 (`dados = []`)
- **Blocks:** User error recovery. Single mistaken click (after confirm) loses data permanently.
- **Priority:** Low (mitigated by double confirm on clear-all)

## Test Coverage Gaps

### Entire codebase is untested
- **What's not tested:** All 503 lines of `script.js` — data calculations, rendering logic, backup/restore, localStorage operations, event handling.
- **Files:** `script.js`
- **Risk:** Any change risks regression with no safety net. The profit calculation logic (`calcularEntradas()`) is the core business logic and is completely untested.
- **Priority:** High

### No unit tests for calculation engine
- **What's not tested:** `calcularEntradas()` function (lines 204–236) — the entire profit/loss computation. Edge cases: first row, zero rates, negative values, missing fields, large numbers.
- **Files:** `script.js` lines 204–236
- **Risk:** Arithmetic bugs would go unnoticed until a user manually cross-checks values.
- **Priority:** High

### No integration tests for backup/restore
- **What's not tested:** `salvarBackup()` + `carregarBackup()` round-trip. Edge cases: empty data, missing taxas, corrupted JSON file, very large files, files with unexpected fields.
- **Files:** `script.js` lines 438–496
- **Risk:** Backup corruption could cause permanent data loss.
- **Priority:** Medium

---

*Concerns audit: 2026-06-16*
