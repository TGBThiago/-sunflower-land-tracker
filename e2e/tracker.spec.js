const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const INDEX = `file:///${path.resolve(__dirname, '..', 'index.html').replace(/\\/g, '/')}`;

async function addDay(page, overrides = {}) {
  const fields = {
    data: '2026-06-16',
    gold: '1000',
    diamante: '0',
    flower: '0',
    saque: '0',
    obs: '',
    ...overrides,
  };

  await page.click('#btnAdd');
  await page.waitForSelector('#modalOverlay.ativo');

  await page.fill('#fieldData', fields.data);
  await page.fill('#fieldGold', String(fields.gold));
  await page.fill('#fieldDiamante', String(fields.diamante));
  await page.fill('#fieldFlower', String(fields.flower));
  await page.fill('#fieldSaque', String(fields.saque));
  await page.fill('#fieldObs', fields.obs);

  await page.click('#btnSalvar');
  await expect(page.locator('#modalOverlay')).not.toHaveClass(/ativo/);
}

test.describe('Sunflower Land Tracker', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__test_skip_firestore = true;
      window.__test_skip_auth = true;
    });
    await page.goto(INDEX);
    await page.waitForLoadState('load');
    await page.locator('#loadingMsg').waitFor({ state: 'hidden', timeout: 15000 });
    await page.waitForTimeout(2000);
  });

  test('deve carregar com título e estado vazio', async ({ page }) => {
    await expect(page.locator('.container h1')).toContainText('Sunflower Land');
    await expect(page.locator('#emptyMsg')).toBeVisible();
    await expect(page.locator('#tbody tr')).toHaveCount(0);
    await expect(page.locator('#cardPatrimonio')).toHaveText('0 Flower');
    await expect(page.locator('#cardDolar')).toHaveText('$0.00');
    await expect(page.locator('#cardLucro')).toHaveText('0 Flower');
    await expect(page.locator('#cardMedia')).toHaveText('0 Flower');
    await expect(page.locator('#cardEstimativa')).toHaveText('$0.00');
  });

  test('deve abrir e fechar modal corretamente', async ({ page }) => {
    await page.click('#btnAdd');
    await expect(page.locator('#modalOverlay')).toHaveClass(/ativo/);
    await expect(page.locator('#modalTitle')).toHaveText('Adicionar Dia');

    await page.click('#btnCancelar');
    await expect(page.locator('#modalOverlay')).not.toHaveClass(/ativo/);

    await page.click('#btnAdd');
    await expect(page.locator('#modalOverlay')).toHaveClass(/ativo/);

    await page.click('#btnCancelar');
    await expect(page.locator('#modalOverlay')).not.toHaveClass(/ativo/);
  });

  test('deve adicionar um registro e atualizar a tabela', async ({ page }) => {
    await addDay(page, { data: '2026-06-01', gold: 5000, diamante: 100, flower: 200 });

    await expect(page.locator('#emptyMsg')).not.toBeVisible();
    await expect(page.locator('#tbody tr')).toHaveCount(1);
    await expect(page.locator('#tbody tr td:nth-child(1)')).toHaveText('01/06/2026');
    await expect(page.locator('#tbody tr td:nth-child(2)')).toHaveText('5000.00');
    await expect(page.locator('#tbody tr td:nth-child(3)')).toHaveText('100.00');
    await expect(page.locator('#tbody tr td:nth-child(4)')).toHaveText('200.00');
  });

  test('deve calcular patrimônio e lucro corretamente', async ({ page }) => {
    await addDay(page, { data: '2026-06-01', gold: 3000, diamante: 50, flower: 100 });
    await addDay(page, { data: '2026-06-02', gold: 5000, diamante: 80, flower: 250 });

    const patrimonio = await page.locator('#tbody tr:nth-child(1) td:nth-child(8)').textContent();
    expect(parseFloat(patrimonio)).toBeGreaterThan(0);

    const lucro = await page.locator('#tbody tr:nth-child(2) td:nth-child(10)').textContent();
    expect(lucro).toContain('+');

    await expect(page.locator('#cardPatrimonio')).not.toHaveText('0 Flower');
    await expect(page.locator('#cardLucro')).not.toHaveText('0 Flower');
  });

  test('deve editar um registro existente', async ({ page }) => {
    await addDay(page, { data: '2026-06-01', gold: 3000, diamante: 50, flower: 100 });

    await page.click('.btn-edit');
    await expect(page.locator('#modalTitle')).toHaveText('Editar Dia');
    await expect(page.locator('#modalOverlay')).toHaveClass(/ativo/);

    await page.fill('#fieldGold', '9999');
    await page.click('#btnSalvar');
    await expect(page.locator('#modalOverlay')).not.toHaveClass(/ativo/);

    const cells = page.locator('#tbody tr td');
    await expect(cells.nth(1)).toHaveText('9999.00');
  });

  test('deve excluir um registro', async ({ page }) => {
    await addDay(page, { data: '2026-06-01', gold: 3000, diamante: 50, flower: 100 });
    await expect(page.locator('#tbody tr')).toHaveCount(1);

    page.once('dialog', d => d.accept());
    await page.click('.btn-del');
    await expect(page.locator('#tbody tr')).toHaveCount(0);
    await expect(page.locator('#emptyMsg')).toBeVisible();
  });

  test('deve recalcular com alteração nas taxas', async ({ page }) => {
    await page.fill('#taxaGold', '5');
    await page.waitForTimeout(200);
    await addDay(page, { data: '2026-06-01', gold: 1000, diamante: 0, flower: 0 });

    const goldFlower = await page.locator('#tbody tr td:nth-child(6)').textContent();
    expect(goldFlower).toBe('5.00');
  });

  test('deve calcular saque em dólar', async ({ page }) => {
    await page.fill('#taxaDolar', '0.50');
    await page.fill('#saqueFlower', '100');
    await page.waitForTimeout(200);

    await expect(page.locator('#saqueDolar')).toHaveText('= $50.00');
  });

  test('deve exportar CSV com dados', async ({ page }) => {
    await addDay(page, { data: '2026-06-01', gold: 3000, diamante: 50, flower: 100 });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#btnExport'),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });

  test('deve salvar e carregar backup', async ({ page }) => {
    await addDay(page, { data: '2026-06-01', gold: 3000, diamante: 50, flower: 100 });
    await page.fill('#taxaGold', '3');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#btnSave'),
    ]);

    const backupPath = await download.path();
    expect(fs.existsSync(backupPath)).toBeTruthy();

    await page.reload();
    await page.waitForLoadState('load');
    await page.locator('#loadingMsg').waitFor({ state: 'hidden', timeout: 10000 });
    await expect(page.locator('#tbody tr')).toHaveCount(0);

    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#btnLoad'),
    ]);
    await fileChooser.setFiles(backupPath);
    await page.waitForTimeout(500);

    await expect(page.locator('#tbody tr')).toHaveCount(1);
    await expect(page.locator('#tbody tr td:nth-child(2)')).toHaveText('3000.00');
  });

  test('deve limpar tudo com dupla confirmação', async ({ page }) => {
    await addDay(page, { data: '2026-06-01', gold: 3000, diamante: 50, flower: 100 });
    await expect(page.locator('#tbody tr')).toHaveCount(1);

    page.on('dialog', d => d.accept());
    await page.click('#btnClear');
    await page.waitForTimeout(200);

    await expect(page.locator('#tbody tr')).toHaveCount(0);
    await expect(page.locator('#emptyMsg')).toBeVisible();
  });

  test('deve gerar gráficos após adicionar registros', async ({ page }) => {
    await addDay(page, { data: '2026-06-01', gold: 3000, diamante: 50, flower: 100 });
    await addDay(page, { data: '2026-06-02', gold: 5000, diamante: 80, flower: 250 });
    await page.waitForTimeout(500);

    const charts = page.locator('.charts-section canvas');
    await expect(charts).toHaveCount(2);
  });

  test('deve exibir o painel da Farm com ID 72837 e auto save', async ({ page }) => {
    await expect(page.locator('.farm-panel')).toBeVisible();
    await expect(page.locator('.farm-panel-header h2')).toContainText('72837');
    await expect(page.locator('#farmId')).toHaveText('72837');
    await expect(page.locator('#btnSalvarAgora')).toBeVisible();
    await expect(page.locator('#farmAutosave')).toContainText('Auto save ativo');
    await expect(page.locator('#farmStatus')).toBeVisible();
  });

  test('modal de edição não fecha ao clicar fora', async ({ page }) => {
    await addDay(page, { data: '2026-06-01', gold: 1000, diamante: 0, flower: 0 });
    await page.click('#tbody tr .btn-edit');
    await expect(page.locator('#modalOverlay')).toHaveClass(/ativo/);
    await expect(page.locator('#modalTitle')).toHaveText('Editar Dia');
    await page.click('.modal-overlay', { position: { x: 5, y: 5 } });
    await expect(page.locator('#modalOverlay')).toHaveClass(/ativo/);
    await page.click('#btnCancelar');
    await expect(page.locator('#modalOverlay')).not.toHaveClass(/ativo/);
  });
});

test.describe('Auth', () => {
  test('deve mostrar tela de login quando não autenticado', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForLoadState('load');
    await expect(page.locator('#authScreen')).toBeVisible();
    await expect(page.locator('.container')).toBeHidden();
  });
});
