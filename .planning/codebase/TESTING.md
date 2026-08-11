# Testing Patterns

**Analysis Date:** 2026-06-16

## Test Framework

**Current State:** No test framework detected.

- No `jest.config.*`, `vitest.config.*`, `karma.conf.*`, or any test config file
- No `*.test.*` or `*.spec.*` files found anywhere in the codebase
- No `package.json` — no test scripts, no dev dependencies
- No test directory (no `__tests__/`, `test/`, `spec/`)
- Zero tests exist for any component

**Run Commands:** None defined. The project has no test runner.

## Recommended Test Setup

Since this is a vanilla HTML/CSS/JS project with no build system, the recommended approach is:

**Option A — Vitest (in-browser compatible):**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^3.0.0",
    "@vitest/runner": "^3.0.0",
    "happy-dom": "^16.0.0"
  }
}
```

**Option B — Node Assert (no framework, minimal):**
A lightweight Node.js script that `require`s or copies the logic into a test harness, using Node's built-in `node:assert` or `node:test` module (available Node 18+).

**Option C — Browser-based (Jasmine or Mocha):**
Load `script.js` in a headless browser with a test runner HTML page.

## Test File Organization (Recommended)

```
sunflower-land-tracker-backup/
├── tests/
│   ├── unit/
│   │   ├── calcularEntradas.test.js    # Core computation logic
│   │   ├── formatarData.test.js        # Date formatting
│   │   └── atualizarTaxas.test.js      # Rate calculations
│   ├── integration/
│   │   ├── localStorage.test.js        # Load/save round-trip
│   │   └── renderizar.test.js          # DOM rendering
│   └── fixtures/
│       ├── sample-dados.json           # Test data
│       └── sample-backup.json          # Backup format
```

**Naming:** `*.test.js` — co-located or in `tests/` directory.

## Test Structure (Recommended)

Use `describe`/`it` blocks with Vitest:

```javascript
// tests/unit/calcularEntradas.test.js
import { describe, it, expect, beforeEach } from 'vitest';

describe('calcularEntradas', () => {
  beforeEach(() => {
    // Reset state
    dados = [];
    taxas = { conversao: 2, diamanteTaxa: 0.077063, valorDolar: 0.50, qtdGemas: 2800, precoLote: 215.77 };
  });

  it('returns empty array when dados is empty', () => {
    const result = calcularEntradas();
    expect(result).toEqual([]);
  });

  it('calculates gold to flower conversion correctly', () => {
    dados.push({ data: '2026-06-15', gold: 3000, diamante: 0, flower: 100, saque: 0, obs: '' });
    const result = calcularEntradas();
    expect(result[0].goldFlower).toBe(6); // (3000/1000) * 2
  });
});
```

## Mocking (Recommended)

**Framework:** `vitest` built-in mocks or `vi.fn()`.

**Patterns:**

1. **localStorage mock** — since all persistence goes through localStorage:
```javascript
import { vi, beforeEach } from 'vitest';

beforeEach(() => {
  const store = {};
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(key => store[key] ?? null);
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key, value) => { store[key] = value; });
  vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => { store = {}; });
});
```

2. **Chart.js mock** — since Chart.js is a global dependency:
```javascript
vi.stubGlobal('Chart', vi.fn().mockImplementation(() => ({
  destroy: vi.fn()
})));
```

3. **DOM mock** — using happy-dom or jsdom:
```javascript
import 'happy-dom'; // or jsdom globally
```

**What to Mock:**
- `localStorage` get/set — all tests touching data persistence
- `Chart` constructor — chart rendering tests
- `URL.createObjectURL` and `URL.revokeObjectURL` — CSV/backup export tests
- `document.createElement('a')` and `.click()` — download trigger tests
- `window.confirm` — destructive action tests

**What NOT to Mock:**
- Core computation functions (`calcularEntradas`, formatarData, taxas calculations)
- Date formatting logic

## Fixtures and Factories (Recommended)

**Test Data Pattern:**

```javascript
// tests/fixtures/sample-dados.js
export const MOCK_DADOS = [
  { data: '2026-06-10', gold: 1000, diamante: 500, flower: 50, saque: 0, obs: 'Primeiro dia' },
  { data: '2026-06-11', gold: 2000, diamante: 600, flower: 80, saque: 20, obs: '' },
];

export const MOCK_TAXAS = {
  conversao: 2,
  diamanteTaxa: 0.077063,
  valorDolar: 0.50,
  qtdGemas: 2800,
  precoLote: 215.77,
};

export const MOCK_BACKUP = {
  dados: MOCK_DADOS,
  taxas: MOCK_TAXAS,
  exportadoEm: '2026-06-16T00:00:00.000Z',
};
```

**Factory function pattern for variable test data:**

```javascript
export function criarRegistro(overrides = {}) {
  return {
    data: '2026-06-15',
    gold: 3000,
    diamante: 0,
    flower: 100,
    saque: 0,
    obs: '',
    ...overrides,
  };
}
```

**Location:** `tests/fixtures/` directory.

## Coverage (Recommended)

**Requirements:** Aim for minimum 80% on all metrics for the `calcularEntradas()` function and data persistence layer.

**Key areas to cover:**
- `calcularEntradas()` — all branches (first row vs subsequent, zero/negative values, various rates)
- `carregarDados()` / `salvarDados()` — localStorage round-trip
- `carregarTaxas()` / `salvarTaxas()` — rates persistence, fallback logic
- `formatarData()` — valid, empty, malformed input
- `exportarCSV()` — CSV generation with edge cases (empty data, special characters in obs)
- `salvarBackup()` / `carregarBackup()` — file round-trip, invalid JSON handling
- `salvarRegistro()` — validation, edit vs create, data shape
- `atualizarTaxas()` — computation of diamondTaxa from qtdGemas and precoLote

**View Coverage with Vitest:**
```bash
npx vitest run --coverage
```

## Test Types (Recommended)

### Unit Tests (Priority: High)

**Scope:** Pure logic functions that don't touch DOM:
- `calcularEntradas()` — core profit computation, most complex function
- `formatarData()` — date string transformation
- `atualizarTaxas()` — rate computation from inputs

### Integration Tests (Priority: Medium)

**Scope:** Functions that bridge logic and storage/DOM:
- `carregarDados()` + `salvarDados()` — localStorage persist/restore
- `carregarTaxas()` — fallback logic when no saved rates exist but dados has values
- `renderizar()` — table generation from dados array
- `abrirModal(index)` — form population for edit mode

### E2E Tests (Priority: Low)

**Approach:** Playwright or Cypress testing against `index.html` served locally.
- User flow: Add day → verify it appears in table → export CSV → verify file download
- User flow: Edit existing record → verify updated values
- User flow: Backup → clear → restore → verify data integrity

Not currently implemented.

## Common Patterns (Recommended)

### Async Testing

The project is entirely synchronous except for `FileReader` in `carregarBackup()`. For async testing:

```javascript
it('loads a backup file', async () => {
  const blob = new Blob([JSON.stringify(MOCK_BACKUP)], { type: 'application/json' });
  const file = new File([blob], 'backup.json');
  const event = { target: { files: [file] } };

  // fileInput listener calls carregarBackup which uses FileReader
  // Wrap in a promise that resolves when FileReader fires onload
  await new Promise(resolve => {
    // ... trigger event, resolve on next tick
    setTimeout(resolve, 10);
  });

  expect(dados).toEqual(MOCK_DADOS);
});
```

### Error Testing

```javascript
it('handles corrupted localStorage gracefully', () => {
  Storage.prototype.getItem.mockReturnValue('not valid json');
  carregarDados();
  expect(dados).toEqual([]);
});

it('validates form fields before saving', () => {
  // Simulate empty date
  document.getElementById('fieldData').value = '';
  document.getElementById('fieldGold').value = '-1';
  const event = new Event('submit');
  modalForm.dispatchEvent(event);
  // Toast should show, dados should not change
  expect(toast.textContent).toContain('Preencha todos');
});
```

### State Reset Pattern

```javascript
beforeEach(() => {
  // Reset all module-level state between tests
  dados = [];
  taxas = { conversao: 2, diamanteTaxa: 0.077063, valorDolar: 0.50, qtdGemas: 2800, precoLote: 215.77 };
  chartEvolucao = null;
  chartLucro = null;
  localStorage.clear();
});
```

## Current Risks Due to No Tests

| Risk | Component | Impact |
|------|-----------|--------|
| Computation errors | `calcularEntradas()` | Wrong profit/loss numbers displayed |
| Edge case crashes | `carregarTaxas()` fallback | App fails to load with partial data |
| Regression | All functions | Manual testing required after every change |
| Data corruption | `carregarBackup()` | Invalid backup file could corrupt state |
| CSV output errors | `exportarCSV()` | Wrong numbers exported, silent failure |

**Highest priority for test coverage:** `calcularEntradas()` — it's the core computation with 9 distinct calculation paths, branching on index === 0 vs i > 0, and multiple formula dependencies.

---

*Testing analysis: 2026-06-16*
