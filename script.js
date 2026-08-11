const tbody = document.getElementById('tbody');
const emptyMsg = document.getElementById('emptyMsg');
const loadingMsg = document.getElementById('loadingMsg');
const modalOverlay = document.getElementById('modalOverlay');
const modalForm = document.getElementById('modalForm');
const modalTitle = document.getElementById('modalTitle');
const editIndex = document.getElementById('editIndex');
const btnAdd = document.getElementById('btnAdd');
const btnExport = document.getElementById('btnExport');
const btnClear = document.getElementById('btnClear');
const btnCancelar = document.getElementById('btnCancelar');
const btnFecharModal = document.getElementById('btnFecharModal');
const toast = document.getElementById('toast');
const inputTaxaGold = document.getElementById('taxaGold');
const inputQtdGemas = document.getElementById('taxaQtdGemas');
const inputPrecoLote = document.getElementById('taxaPrecoLote');
const spanTaxaGema = document.getElementById('taxaGemaDisplay');
const inputTaxaDolar = document.getElementById('taxaDolar');
const btnSave = document.getElementById('btnSave');
const btnLoad = document.getElementById('btnLoad');
const fileInput = document.getElementById('fileInput');
const saqueFlower = document.getElementById('saqueFlower');
const saqueDolar = document.getElementById('saqueDolar');
const priceInfo = document.getElementById('priceInfo');
const btnAtualizarPreco = document.getElementById('btnAtualizarPreco');
const goldInfo = document.getElementById('goldInfo');
const btnAtualizarGold = document.getElementById('btnAtualizarGold');

const FARM_ID = '72837';
const FARM_API_SOURCE = 'SFL.World';
const FARM_PROXY_URL = 'https://sfl-farm-proxy.sfl-proxy.workers.dev';
const AUTOSAVE_HORARIOS_PADRAO = ['01:00', '07:00', '13:00', '19:00', '20:06', '20:33', '21:12'];
let AUTOSAVE_HORARIOS = [...AUTOSAVE_HORARIOS_PADRAO];
const TIMEZONE_SP = 'America/Sao_Paulo';
const SFL_SYNC_TIMEOUT_MS = 90000;
const SFL_SYNC_INTERVAL_MS = 1500;
const AUTOSAVE_CONFIRM_TIMEOUT_S = 30;

const farmIdEl = document.getElementById('farmId');
const farmGoldEl = document.getElementById('farmGold');
const farmDiamondsEl = document.getElementById('farmDiamonds');
const farmFlowerEl = document.getElementById('farmFlower');
const farmUpdatedEl = document.getElementById('farmUpdated');
const farmStatusEl = document.getElementById('farmStatus');
const farmErrorEl = document.getElementById('farmError');
const farmAutosaveEl = document.getElementById('farmAutosave');
const farmLogEl = document.getElementById('farmLog');
const btnSalvarAgora = document.getElementById('btnSalvarAgora');
const farmHorariosInput = document.getElementById('farmHorariosInput');
const btnSalvarHorarios = document.getElementById('btnSalvarHorarios');
const horariosStatusEl = document.getElementById('horariosStatus');

const farmConfirmOverlay = document.getElementById('farmConfirmOverlay');
const confirmDataEl = document.getElementById('confirmData');
const confirmHorarioEl = document.getElementById('confirmHorario');
const confirmGoldEl = document.getElementById('confirmGold');
const confirmDiamantesEl = document.getElementById('confirmDiamantes');
const confirmFlowerEl = document.getElementById('confirmFlower');
const confirmOrigemEl = document.getElementById('confirmOrigem');
const confirmCountdownEl = document.getElementById('confirmCountdown');
const btnConfirmarSalvar = document.getElementById('btnConfirmarSalvar');
const btnCancelarConfirmar = document.getElementById('btnCancelarConfirmar');

let farmAutosaveTimer = null;
let farmSalvando = false;

let dados = [];
let taxas = { conversao: 2, diamanteTaxa: 0.077063, valorDolar: 0.50, qtdGemas: 2800, precoLote: 215.77 };
let chartPreco = null;
let chartLucro = null;
let fsSaveTimer = null;
let localVersion = 0;
let precoHistorico = [];
let precoPeriodo = '7';

const MIGRATION_SECRET = 'SL-41dcc7bf5ed62791901e01b9';

iniciarApp();

function iniciarApp() {
  if (window.__test_skip_auth) {
    const c = document.querySelector('.container');
    if (c) c.style.display = 'block';
    const a = document.getElementById('authScreen');
    if (a) a.style.display = 'none';
    init();
    return;
  }
  if (typeof setupAuthFlow === 'function') {
    setupAuthFlow(init);
  } else {
    init();
  }
}

async function init() {
  mostrarCarregando(true);
  await executarMigracaoSeSolicitada();
  await carregarDoFirestore();
  mostrarCarregando(false);
  renderizar();
  iniciarSnapshot();
  iniciarAtualizacaoPreco();
  iniciarPainelFarm();
}

async function executarMigracaoSeSolicitada() {
  if (window.__test_skip_firestore || typeof db === 'undefined') return;
  try {
    const params = new URLSearchParams(location.search);
    if (params.get('migrar') !== MIGRATION_SECRET) return;
    const ref = await getTrackerRef();
    const meuDoc = await ref.get();
    if (meuDoc.exists && (meuDoc.data().dados || []).length > 0) return;
    const mainRef = db.collection(TRACKER_COLLECTION).doc('main');
    const mainDoc = await mainRef.get();
    if (!mainDoc.exists) return;
    await ref.set(mainDoc.data(), { merge: true });
    await mainRef.delete();
    params.delete('migrar');
    const qs = params.toString();
    const url = location.pathname + (qs ? '?' + qs : '') + location.hash;
    history.replaceState({}, '', url);
    mostrarToast('Dados migrados com sucesso!');
  } catch (err) {
    mostrarToast('Erro na migração: ' + err.message);
  }
}

function mostrarCarregando(visivel) {
  if (loadingMsg) loadingMsg.style.display = visivel ? 'block' : 'none';
}

function parseHorarios(str) {
  const partes = String(str || '').split(',').map(s => s.trim()).filter(Boolean);
  const validos = [];
  for (const p of partes) {
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(p)) validos.push(p);
  }
  return validos;
}

async function carregarConfigAutosave() {
  if (typeof db === 'undefined') return;
  try {
    const snap = await db.collection('config').doc('autosave').get();
    if (snap.exists) {
      const d = snap.data() || {};
      if (Array.isArray(d.horarios) && d.horarios.length) {
        AUTOSAVE_HORARIOS = [...d.horarios];
      }
    }
  } catch (err) {
    console.warn('config/autosave não lido:', err.message);
  }
}

async function salvarHorariosAutosave() {
  const novos = parseHorarios(farmHorariosInput.value);
  if (!novos.length) {
    setStatusHorarios('Informe ao menos um horário no formato HH:MM.', 'error');
    return;
  }
  try {
    await db.collection('config').doc('autosave').set({
      farmId: FARM_ID,
      horarios: novos,
    }, { merge: true });
    AUTOSAVE_HORARIOS = [...novos];
    setStatusHorarios('✔ Horários salvos: ' + novos.join(' · '), 'ok');
    agendarAutoSave();
  } catch (err) {
    setStatusHorarios('Erro ao salvar: ' + err.message, 'error');
  }
}

function setStatusHorarios(msg, tipo) {
  if (!horariosStatusEl) return;
  horariosStatusEl.textContent = msg;
  horariosStatusEl.className = 'farm-status';
  if (tipo) horariosStatusEl.classList.add(tipo);
}

function iniciarPainelFarm() {
  if (btnSalvarAgora) {
    btnSalvarAgora.addEventListener('click', () => salvarAgora({ auto: false }));
  }
  if (farmHorariosInput) farmHorariosInput.value = AUTOSAVE_HORARIOS.join(', ');
  if (btnSalvarHorarios) {
    btnSalvarHorarios.addEventListener('click', salvarHorariosAutosave);
  }
  carregarConfigAutosave().then(() => {
    if (farmHorariosInput) farmHorariosInput.value = AUTOSAVE_HORARIOS.join(', ');
    agendarAutoSave();
  });
  agendarAutoSave();
  carregarValoresAtuais();
  setInterval(refrescarPainelFarm, 15 * 60 * 1000);
}

async function carregarValoresAtuais() {
  setStatusFarm('Buscando dados da Farm...', 'loading');
  limparErroFarm();
  try {
    const dadosFarm = await buscarDadosFarm();
    atualizarPainelFarm(dadosFarm);
    logFluxo('[Prévia] Painel carregado sem SYNC — valores ainda não sincronizados. Use "SALVAR AGORA" para sincronizar.');
    setStatusFarm('Dados carregados (prévia sem SYNC)', 'ok');
  } catch (err) {
    console.error('[SFL.World] Erro ao carregar Farm ' + FARM_ID + ':', err);
    mostrarErroFarm('⚠ Não foi possível atualizar os dados da Farm ' + FARM_ID + '.');
    setStatusFarm('Sem conexão', 'error');
  }
}

async function refrescarPainelFarm() {
  try {
    const dadosFarm = await buscarDadosFarm();
    atualizarPainelFarm(dadosFarm);
    logFluxo('[Prévia] Painel atualizado sem SYNC (refresco automático).');
    setStatusFarm('Dados atualizados (prévia sem SYNC)', 'ok');
  } catch (err) {
    console.warn('[SFL.World] Refresh da Farm falhou:', err.message);
  }
}

async function buscarDadosFarm() {
  if (window.__test_skip_firestore) {
    throw new Error('Indisponível em modo de teste.');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(FARM_PROXY_URL + '?farmId=' + encodeURIComponent(FARM_ID), { signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
  clearTimeout(timeout);
  if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
  const data = await res.json();
  if (!validarDadosFarm(data)) {
    throw new Error('Dados inválidos retornados pela API.');
  }
  return data;
}

function validarDadosFarm(d) {
  if (!d || typeof d !== 'object') return false;
  const valores = [d.gold, d.diamonds, d.flower];
  if (valores.some(v => v === null || v === undefined || v === '')) return false;
  if (valores.some(v => typeof v !== 'number' || !isFinite(v) || v < 0)) return false;
  return true;
}

function logFluxo(msg) {
  const ts = new Date().toLocaleTimeString('pt-BR', { hour12: false });
  console.log('[' + ts + '] ' + msg);
  if (!farmLogEl) return;
  const div = document.createElement('div');
  div.textContent = ts + '  ' + msg;
  farmLogEl.appendChild(div);
  farmLogEl.scrollTop = farmLogEl.scrollHeight;
  while (farmLogEl.childNodes.length > 60) {
    farmLogEl.removeChild(farmLogEl.firstChild);
  }
}

function limparLogFluxo() {
  if (farmLogEl) farmLogEl.innerHTML = '';
}

function fetchComTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function dispararSyncFarm() {
  logFluxo('1/5 SFL World: conectando ao serviço da conta (lote ' + FARM_ID + ')...');
  let res;
  try {
    res = await fetchComTimeout(FARM_PROXY_URL + '/update/' + encodeURIComponent(FARM_ID), 20000);
  } catch (err) {
    throw new Error('Sem conexão com o SFL World para iniciar o SYNC.');
  }
  if (!res.ok) throw new Error('SFL World recusou o SYNC (HTTP ' + res.status + ').');
  const data = await res.json();
  if (!data || data.status !== 'OK') {
    throw new Error('SFL World não autorizou/confirmou o início do SYNC: ' + JSON.stringify(data));
  }
  logFluxo('2/5 SFL World: SYNC da conta iniciado pelo servidor — aguardando término real...');
  return data;
}

async function aguardarSyncCompleto() {
  const inicio = Date.now();
  let tentativa = 0;
  while (Date.now() - inicio < SFL_SYNC_TIMEOUT_MS) {
    tentativa++;
    let res;
    try {
      res = await fetchComTimeout(FARM_PROXY_URL + '/update/' + encodeURIComponent(FARM_ID) + '/check', 15000);
    } catch (err) {
      throw new Error('Falha ao verificar o status do SYNC no SFL World.');
    }
    if (!res.ok) throw new Error('Erro ao consultar o SYNC (HTTP ' + res.status + ').');
    const data = await res.json();
    if (data && data.status === 'OK') {
      logFluxo('3/5 SFL World: SYNC concluído com sucesso (' + Math.round((Date.now() - inicio) / 1000) + 's).');
      return data;
    }
    await new Promise(r => setTimeout(r, SFL_SYNC_INTERVAL_MS));
  }
  throw new Error('Tempo esgotado (' + Math.round(SFL_SYNC_TIMEOUT_MS / 1000) + 's) aguardando o SYNC do SFL World.');
}

async function buscarDadosFarmSync() {
  await dispararSyncFarm();
  await aguardarSyncCompleto();
  const dadosFarm = await buscarDadosFarm();
  if (!validarDadosFarm(dadosFarm)) {
    throw new Error('Dados obtidos após o SYNC são inválidos/incompletos.');
  }
  logFluxo('4/5 SFL World: dados atualizados obtidos após o SYNC (Gold, Diamonds, Flower).');
  return dadosFarm;
}

function atualizarPainelFarm(d) {
  farmIdEl.textContent = d.farmId || FARM_ID;
  farmGoldEl.textContent = formatarGold(d.gold);
  farmDiamondsEl.textContent = formatarDiamante(d.diamonds);
  farmFlowerEl.textContent = formatarFlower(d.flower);
  farmUpdatedEl.textContent = formatarDataHoraBR(d.fetchedAt || new Date().toISOString());
  limparErroFarm();
}

function formatarGold(v) {
  return Number(v).toFixed(2);
}

function formatarDiamante(v) {
  return String(Math.round(Number(v)));
}

function formatarFlower(v) {
  return Number(v).toFixed(4);
}

function formatarDataHoraBR(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: TIMEZONE_SP,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function obterDataHoraSP() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE_SP,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const pegar = (tipo) => {
    const p = partes.find(p => p.type === tipo);
    return p ? p.value : '';
  };
  let hora = pegar('hour');
  if (hora === '24') hora = '00';
  return {
    data: `${pegar('year')}-${pegar('month')}-${pegar('day')}`,
    horario: `${hora}:${pegar('minute')}`,
  };
}

function deslocamentoSPEmMinutos() {
  try {
    const partes = new Intl.DateTimeFormat('en-US', {
      timeZone: TIMEZONE_SP,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date());
    const nome = partes.find(p => p.type === 'timeZoneName');
    const m = nome && nome.value.match(/GMT([+-])(\d{2}):(\d{2})/);
    if (!m) return -180;
    const sinal = m[1] === '-' ? -1 : 1;
    return sinal * (parseInt(m[2], 10) * 60 + parseInt(m[3], 10));
  } catch (e) {
    return -180;
  }
}

function proximoHorarioAutoSave(agora) {
  for (const t of AUTOSAVE_HORARIOS) {
    if (t > agora.horario) return { data: agora.data, horario: t };
  }
  const amanha = new Date(agora.data + 'T00:00:00');
  amanha.setDate(amanha.getDate() + 1);
  const pad = n => String(n).padStart(2, '0');
  return {
    data: `${amanha.getFullYear()}-${pad(amanha.getMonth() + 1)}-${pad(amanha.getDate())}`,
    horario: AUTOSAVE_HORARIOS[0],
  };
}

function agendarAutoSave() {
  clearTimeout(farmAutosaveTimer);
  const agora = obterDataHoraSP();
  const proximo = proximoHorarioAutoSave(agora);

  const [ano, mes, dia] = proximo.data.split('-').map(Number);
  const [hh, mm] = proximo.horario.split(':').map(Number);
  const alvoUTC = Date.UTC(ano, mes - 1, dia, hh, mm, 0) - deslocamentoSPEmMinutos() * 60000;
  let diff = alvoUTC - Date.now();
  if (diff < 0) diff += 24 * 60 * 60 * 1000;

  if (farmAutosaveEl) {
    farmAutosaveEl.textContent =
      `⏱ Auto save ativo: ${AUTOSAVE_HORARIOS.join(' · ')} (${TIMEZONE_SP}) · próximo às ${proximo.horario} — ${formatarData(proximo.data)}`;
  }

  farmAutosaveTimer = setTimeout(async () => {
    try {
      await salvarAgora({ auto: true });
    } catch (err) {
      console.error('[Auto-save] Falha:', err);
    } finally {
      agendarAutoSave();
      logFluxo('Auto save executado — recarregando a página para atualizar os dados...');
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    }
  }, diff);
}

async function salvarAgora(opcoes) {
  if (farmSalvando) return;
  farmSalvando = true;
  const auto = !!(opcoes && opcoes.auto);
  limparErroFarm();
  limparLogFluxo();
  logFluxo('[INÍCIO] Fluxo de salvamento da Farm ' + FARM_ID + (auto ? ' (auto-save).' : '.'));
  setStatusFarm('SFL World: conectando e sincronizando...', 'loading');

  try {
    const dadosFarm = await buscarDadosFarmSync();
    atualizarPainelFarm(dadosFarm);

    const agoraSP = obterDataHoraSP();
    const chave = `${dadosFarm.farmId}|${agoraSP.data}|${agoraSP.horario}`;
    const jaExiste = dados.some(r =>
      r.farmId && `${r.farmId}|${r.data}|${r.horario}` === chave
    );

    if (jaExiste) {
      logFluxo('Registro já existente em ' + agoraSP.data + ' ' + agoraSP.horario + ' — nada salvo.');
      setStatusFarm('Registro já existente em ' + agoraSP.data + ' ' + agoraSP.horario + ' — nada duplicado.', 'ok');
      if (!auto) mostrarToast('Já existe um registro para ' + formatarData(agoraSP.data) + ' às ' + agoraSP.horario + '.');
      return;
    }

    const registro = {
      farmId: dadosFarm.farmId,
      data: agoraSP.data,
      horario: agoraSP.horario,
      gold: dadosFarm.gold,
      diamante: dadosFarm.diamonds,
      flower: dadosFarm.flower,
      saque: 0,
      obs: '',
      consultadoEm: dadosFarm.fetchedAt || new Date().toISOString(),
      origem: FARM_API_SOURCE,
    };

    logFluxo('5/5 SFL World: valores prontos para salvar. Solicitando confirmação...');
    const confirmado = await confirmarSalvamento(registro, auto);
    if (!confirmado) {
      logFluxo('[CANCELADO] Salvamento não confirmado — nenhum dado foi gravado.');
      setStatusFarm('Salvamento cancelado — nada foi salvo.', 'error');
      if (!auto) mostrarToast('Salvamento cancelado. Nada foi salvo.');
      return;
    }

    logFluxo('[SALVANDO] Gravando registro no Firestore...');
    dados.push(registro);
    const salvo = await salvarParaFirestore();
    if (!salvo) {
      dados.pop();
      throw new Error('Falha ao salvar no Firestore.');
    }

    renderizar();
    logFluxo('[CONCLUÍDO] Registro salvo: ' + formatarData(agoraSP.data) + ' ' + agoraSP.horario + ' (após SYNC SFL World).');
    setStatusFarm('✔ Salvo após SYNC em ' + formatarData(agoraSP.data) + ' às ' + agoraSP.horario, 'ok');
    if (!auto) {
      mostrarToast('💾 Farm salva: ' + formatarGold(registro.gold) + ' Gold · ' + formatarDiamante(registro.diamante) + ' Diamantes · ' + formatarFlower(registro.flower) + ' Flower');
    }
  } catch (err) {
    console.error('[SFL.World] Erro ao salvar Farm ' + FARM_ID + ':', err);
    logFluxo('[ERRO] ' + err.message + ' — processo interrompido, nada foi salvo.');
    mostrarErroFarm('⚠ Falha no fluxo SFL World → SYNC → salvar. Nenhum dado foi gravado.');
    setStatusFarm('Erro — nada salvo', 'error');
  } finally {
    farmSalvando = false;
  }
}

function confirmarSalvamento(registro, auto) {
  return new Promise(resolve => {
    if (auto) {
      logFluxo('[AUTO-SAVE] Salvamento automático aceito sem confirmação manual.');
      resolve(true);
      return;
    }

    confirmDataEl.textContent = formatarData(registro.data);
    confirmHorarioEl.textContent = registro.horario;
    confirmGoldEl.textContent = formatarGold(registro.gold);
    confirmDiamantesEl.textContent = formatarDiamante(registro.diamante);
    confirmFlowerEl.textContent = formatarFlower(registro.flower);
    confirmOrigemEl.textContent = registro.origem || FARM_API_SOURCE;

    let resolved = false;
    let intervalo = null;
    const concluir = (aceito) => {
      if (resolved) return;
      resolved = true;
      if (intervalo) clearInterval(intervalo);
      btnConfirmarSalvar.removeEventListener('click', aoConfirmar);
      btnCancelarConfirmar.removeEventListener('click', aoCancelar);
      farmConfirmOverlay.classList.remove('ativo');
      resolve(aceito);
    };
    const aoConfirmar = () => {
      logFluxo('[CONFIRMAÇÃO] Usuário confirmou o salvamento.');
      concluir(true);
    };
    const aoCancelar = () => {
      logFluxo('[CONFIRMAÇÃO] Usuário cancelou o salvamento.');
      concluir(false);
    };

    btnConfirmarSalvar.addEventListener('click', aoConfirmar);
    btnCancelarConfirmar.addEventListener('click', aoCancelar);
    farmConfirmOverlay.classList.add('ativo');

    if (auto) {
      let restante = AUTOSAVE_CONFIRM_TIMEOUT_S;
      confirmCountdownEl.style.display = 'block';
      confirmCountdownEl.textContent = 'Auto save: confirme em ' + restante + 's ou o salvamento será ignorado.';
      intervalo = setInterval(() => {
        restante--;
        if (restante <= 0) {
          confirmCountdownEl.textContent = 'Tempo esgotado — salvamento ignorado.';
          concluir(false);
          return;
        }
        confirmCountdownEl.textContent = 'Auto save: confirme em ' + restante + 's ou o salvamento será ignorado.';
      }, 1000);
    } else {
      confirmCountdownEl.style.display = 'none';
    }
  });
}

function setStatusFarm(msg, tipo) {
  if (!farmStatusEl) return;
  farmStatusEl.textContent = msg;
  farmStatusEl.className = 'farm-status';
  if (tipo) farmStatusEl.classList.add(tipo);
}

function mostrarErroFarm(msg) {
  if (!farmErrorEl) return;
  farmErrorEl.textContent = msg;
  farmErrorEl.style.display = 'block';
}

function limparErroFarm() {
  if (!farmErrorEl) return;
  farmErrorEl.style.display = 'none';
  farmErrorEl.textContent = '';
}

async function carregarDoFirestore() {
  if (window.__test_skip_firestore) {
    localVersion = 0;
    return;
  }
  if (typeof db === 'undefined' || typeof getTrackerRef !== 'function') {
    mostrarToast('Firebase não disponível. Recarregue a página.');
    return;
  }

  try {
    const ref = await getTrackerRef();
    const doc = await ref.get();

    if (doc.exists) {
      const data = doc.data();
      dados = data.dados || [];
      taxas = { ...taxas, ...(data.taxas || {}) };
      localVersion = data.version || 0;
      atualizarInputsTaxas();
    } else {
      await ref.set({
        dados: [],
        taxas,
        version: 1,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      localVersion = 1;
    }
  } catch (err) {
    mostrarToast('Erro ao carregar dados do Firestore: ' + err.message);
  }
}

function iniciarSnapshot() {
  if (window.__test_skip_firestore) return;
  if (typeof onTrackerSnapshot !== 'function') return;
  onTrackerSnapshot(data => {
    if (!data) return;
    const incomingVersion = data.version || 0;
    if (incomingVersion <= localVersion) return;
    dados = data.dados || [];
    localVersion = incomingVersion;
    if (data.taxas) {
      taxas = { ...taxas, ...data.taxas };
      atualizarInputsTaxas();
    }
    renderizar();
  });
}

async function salvarParaFirestore() {
  if (typeof db === 'undefined' || typeof getTrackerRef !== 'function') return false;
  try {
    localVersion++;
    const ref = await getTrackerRef();
    await ref.set({
      dados,
      taxas,
      version: localVersion,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return true;
  } catch (err) {
    localVersion--;
    mostrarToast('Erro ao salvar no Firestore: ' + err.message);
    return false;
  }
}

function agendarSaveFirestore() {
  clearTimeout(fsSaveTimer);
  fsSaveTimer = setTimeout(salvarParaFirestore, 500);
}

const COINGECKO_URL = 'https://api.coingecko.com/api/v3/simple/price?ids=flower-2&vs_currencies=usd';
function getCoingeckoHistoryUrl(dias) {
  return `https://api.coingecko.com/api/v3/coins/flower-2/market_chart?vs_currency=usd&days=${dias}`;
}
const SFL_PRICES_URL = 'https://noisy-union-8474.lucas-alexandre-95.workers.dev?url=https://sfl.world/api/v1/prices';
const RECURSOS_COINS = {
  Sunflower:0.02, Potato:0.14, Rhubarb:0.24, Pumpkin:0.4, Zucchini:0.4,
  Carrot:0.8, Yam:0.8, Cabbage:1.5, Broccoli:1.5, Soybean:2.3,
  Pepper:3, Beetroot:2.8, Cauliflower:4.25, Parsnip:6.5, Eggplant:8,
  Corn:9, Onion:10, Turnip:8, Radish:9.5, Wheat:7, Kale:10,
  Artichoke:12, Barley:12, Tomato:2, Lemon:6, Blueberry:12,
  Orange:18, Apple:25, Banana:25, Celestine:200, Lunara:500,
  Duskberry:1000, Grape:240, Rice:320, Olive:400
};
let precoInterval = null;

let ultimoPrecoValido = parseFloat(inputTaxaDolar?.value) || 0;
let precoFalhaToastEm = 0;

async function buscarPrecoFlower() {
  if (!priceInfo) return;
  priceInfo.className = 'price-info loading';
  priceInfo.textContent = 'buscando...';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(COINGECKO_URL, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const price = data['flower-2']?.usd;
    if (!price) throw new Error('Preço não encontrado');

    ultimoPrecoValido = price;
    localStorage.setItem('sfl_ultimo_preco', price);

    priceInfo.className = 'price-info';
    priceInfo.textContent = `$${price.toFixed(6)}`;

    const lastP = precoHistorico[precoHistorico.length - 1];
    if (!lastP || Date.now() - lastP.timestamp > 60000) {
      precoHistorico.push({ timestamp: Date.now(), price });
    }

    inputTaxaDolar.value = price;
    taxas.valorDolar = price;
    atualizarSaque();
    renderizar();
    agendarSaveFirestore();

    return price;
  } catch (err) {
    const cache = localStorage.getItem('sfl_ultimo_preco');
    const valorMostrar = cache ? parseFloat(cache) : ultimoPrecoValido;
    if (valorMostrar && valorMostrar > 0) {
      priceInfo.className = 'price-info stale';
      priceInfo.textContent = `$${valorMostrar.toFixed(6)} (desatualizado)`;
    } else {
      priceInfo.className = 'price-info error';
      priceInfo.textContent = 'erro';
    }
    if (Date.now() > precoFalhaToastEm) {
      mostrarToast('CoinGecko: ' + err.message);
      precoFalhaToastEm = Date.now() + 60000;
    }
    return null;
  }
}

function iniciarAtualizacaoPreco() {
  buscarPrecoFlower();
  buscarHistoricoPreco();
  buscarPrecoGold();
  clearInterval(precoInterval);
  precoInterval = setInterval(() => {
    buscarPrecoFlower();
    buscarHistoricoPreco();
    buscarPrecoGold();
  }, 300000);
}

async function buscarHistoricoPreco(dias) {
  if (dias === undefined) dias = precoPeriodo;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(getCoingeckoHistoryUrl(dias), { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (data.prices && data.prices.length > 0) {
      precoHistorico = data.prices.map(p => ({ timestamp: p[0], price: p[1] }));
      renderizar();
    }
  } catch (err) {
    console.warn('CoinGecko histórico:', err.message);
  }
}

function mudarPeriodo(dias) {
  precoPeriodo = dias;
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.days === dias);
  });
  buscarHistoricoPreco(dias);
}

async function buscarPrecoGold() {
  if (window.__test_skip_firestore) return;
  if (!goldInfo) return;
  goldInfo.className = 'price-info loading';
  goldInfo.textContent = 'buscando...';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(SFL_PRICES_URL, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const p2p = data?.data?.p2p;
    if (!p2p) throw new Error('P2P data not found');

    const entries = Object.entries(p2p)
      .filter(([name]) => RECURSOS_COINS[name] != null && p2p[name] > 0)
      .map(([name]) => ({
        name,
        p2pValue: p2p[name],
        coinsPerFlower: RECURSOS_COINS[name] / p2p[name]
      }));
    if (!entries.length) throw new Error('No valid P2P entries');

    entries.sort((a, b) => b.coinsPerFlower - a.coinsPerFlower);
    const coinRate = entries[0].coinsPerFlower;
    const conversao = coinRate > 0 ? 1000 / coinRate : 0;

    inputTaxaGold.value = conversao.toFixed(6);
    taxas.conversao = conversao;
    goldInfo.className = 'price-info';
    goldInfo.textContent = `1 FLW = ${Math.round(coinRate)} Coins`;
    atualizarTaxas();
  } catch (err) {
    console.warn('SFL Gold:', err.message);
    goldInfo.className = 'price-info error';
    goldInfo.textContent = 'taxa desatualizada';
  }
}

inputTaxaGold.addEventListener('input', atualizarTaxas);
inputQtdGemas.addEventListener('input', atualizarTaxas);
inputPrecoLote.addEventListener('input', atualizarTaxas);
inputTaxaDolar.addEventListener('input', atualizarTaxas);

btnAtualizarPreco.addEventListener('click', buscarPrecoFlower);
btnAtualizarGold.addEventListener('click', buscarPrecoGold);
btnAdd.addEventListener('click', () => abrirModal());
btnCancelar.addEventListener('click', fecharModal);
btnFecharModal.addEventListener('click', fecharModal);
modalForm.addEventListener('submit', salvarRegistro);
btnExport.addEventListener('click', exportarCSV);
btnClear.addEventListener('click', limparTudo);
btnSave.addEventListener('click', salvarBackup);
btnLoad.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', carregarBackup);
saqueFlower.addEventListener('input', atualizarSaque);
tbody.addEventListener('click', (e) => {
  const btnDel = e.target.closest('.btn-del');
  if (btnDel) {
    excluirRegistro(Number(btnDel.dataset.del));
    return;
  }
  const btnEdit = e.target.closest('.btn-edit');
  if (btnEdit) {
    abrirModal(Number(btnEdit.dataset.edit));
  }
});

function atualizarTaxas() {
  taxas.conversao = parseFloat(inputTaxaGold.value) || 0;
  taxas.qtdGemas = parseFloat(inputQtdGemas.value) || 0;
  taxas.precoLote = parseFloat(inputPrecoLote.value) || 0;
  taxas.diamanteTaxa = taxas.qtdGemas > 0 && taxas.precoLote > 0 ? taxas.precoLote / taxas.qtdGemas : 0;
  taxas.valorDolar = parseFloat(inputTaxaDolar.value) || 0;
  agendarSaveFirestore();
  atualizarDisplayGema();
  atualizarSaque();
  renderizar();
}

function atualizarDisplayGema() {
  if (spanTaxaGema) {
    spanTaxaGema.textContent = taxas.diamanteTaxa.toFixed(6);
  }
}

function atualizarSaque() {
  const flower = parseFloat(saqueFlower.value) || 0;
  const dolar = flower * taxas.valorDolar;
  saqueDolar.textContent = `= $${dolar.toFixed(2)}`;
  taxas.saqueFlower = flower;
  agendarSaveFirestore();
}

function atualizarInputsTaxas() {
  inputTaxaGold.value = taxas.conversao;
  inputQtdGemas.value = taxas.qtdGemas || 2800;
  inputPrecoLote.value = taxas.precoLote || 215.77;
  inputTaxaDolar.value = taxas.valorDolar;
  if (taxas.saqueFlower) saqueFlower.value = taxas.saqueFlower;
  atualizarDisplayGema();
  atualizarSaque();
}

function abrirModal(index) {
  modalForm.reset();
  editIndex.value = '';
  modalTitle.textContent = 'Adicionar Dia';

  if (index !== undefined) {
    const d = dados[index];
    editIndex.value = index;
    modalTitle.textContent = 'Editar Dia';
    document.getElementById('fieldData').value = d.data;
    document.getElementById('fieldGold').value = d.gold;
    document.getElementById('fieldDiamante').value = d.diamante || 0;
    document.getElementById('fieldFlower').value = d.flower;
    document.getElementById('fieldSaque').value = d.saque || 0;
    document.getElementById('fieldObs').value = d.obs || '';
  } else {
    document.getElementById('fieldData').value = new Date().toISOString().slice(0, 10);
    if (dados.length > 0) {
      const ultimo = dados[dados.length - 1];
      document.getElementById('fieldGold').value = ultimo.gold;
      document.getElementById('fieldDiamante').value = ultimo.diamante || 0;
      document.getElementById('fieldFlower').value = ultimo.flower;
      document.getElementById('fieldSaque').value = ultimo.saque || 0;
      document.getElementById('fieldObs').value = ultimo.obs || '';
    }
  }

  modalOverlay.classList.add('ativo');
  document.getElementById('fieldGold').focus();
}

function fecharModal() {
  modalOverlay.classList.remove('ativo');
  modalForm.reset();
  editIndex.value = '';
}

function salvarRegistro(e) {
  e.preventDefault();

  const data = document.getElementById('fieldData').value;
  const gold = parseFloat(document.getElementById('fieldGold').value);
  const diamante = parseFloat(document.getElementById('fieldDiamante').value);
  const flower = parseFloat(document.getElementById('fieldFlower').value);
  const saque = parseFloat(document.getElementById('fieldSaque').value) || 0;
  const obs = document.getElementById('fieldObs').value.trim();

  if (!data || gold < 0 || diamante < 0 || flower < 0 || saque < 0) {
    mostrarToast('Preencha todos os campos corretamente.');
    return;
  }

  const idx = editIndex.value;
  const entrada = { data, gold, diamante, flower, saque, obs };

  if (idx !== '') {
    dados[parseInt(idx)] = entrada;
    mostrarToast('Registro atualizado!');
  } else {
    dados.push(entrada);
    mostrarToast('Dia adicionado!');
  }

  agendarSaveFirestore();
  renderizar();
  fecharModal();
}

function excluirRegistro(index) {
  if (!confirm('Excluir este registro?')) return;
  dados.splice(index, 1);
  agendarSaveFirestore();
  renderizar();
  mostrarToast('Registro excluído.');
}

function limparTudo() {
  if (!confirm('Tem certeza? Todos os registros serão perdidos.')) return;
  if (!confirm('Confirma a exclusão de TODOS os dados?')) return;
  dados = [];
  agendarSaveFirestore();
  renderizar();
  mostrarToast('Todos os dados foram limpos.');
}

window.addEventListener('beforeunload', () => {
  if (fsSaveTimer) {
    clearTimeout(fsSaveTimer);
    fsSaveTimer = null;
    salvarParaFirestore();
  }
});

function calcularEntradas() {
  return dados.map((d, i) => {
    const goldFlower = taxas.conversao > 0 ? (d.gold / 1000) * taxas.conversao : 0;
    const diamanteFlower = taxas.diamanteTaxa > 0 ? (d.diamante || 0) * taxas.diamanteTaxa : 0;
    const saque = d.saque || 0;
    const flowerEfetivo = d.flower + saque;
    const totalFlower = goldFlower + d.flower + diamanteFlower;
    const totalFlowerEfetivo = goldFlower + flowerEfetivo + diamanteFlower;
    const totalDolar = totalFlower * taxas.valorDolar;

    let lucroFlower = 0;
    let lucroDolar = 0;
    if (i > 0) {
      const ant = dados[i - 1];
      const antGoldFlower = taxas.conversao > 0 ? (ant.gold / 1000) * taxas.conversao : 0;
      const antDiamanteFlower = taxas.diamanteTaxa > 0 ? (ant.diamante || 0) * taxas.diamanteTaxa : 0;
      const antSaque = ant.saque || 0;
      const antFlowerEfetivo = ant.flower + antSaque;
      const antTotalFlowerEfetivo = antGoldFlower + antFlowerEfetivo + antDiamanteFlower;
      lucroFlower = totalFlowerEfetivo - antTotalFlowerEfetivo;
      lucroDolar = (totalFlowerEfetivo * taxas.valorDolar) - (antTotalFlowerEfetivo * taxas.valorDolar);
    }

    return {
      ...d,
      saque,
      conversao: taxas.conversao,
      diamanteTaxa: taxas.diamanteTaxa,
      valorDolar: taxas.valorDolar,
      goldFlower, diamanteFlower, totalFlower, totalDolar, lucroFlower, lucroDolar
    };
  });
}

function renderizar() {
  const processados = calcularEntradas();
  tbody.innerHTML = '';

  if (processados.length === 0) {
    if (!loadingMsg || loadingMsg.style.display === 'none') {
      emptyMsg.style.display = 'block';
    }
    atualizarCards(null);
    atualizarGraficos([]);
    return;
  }
  emptyMsg.style.display = 'none';

  processados.forEach((p, i) => {
    const tr = document.createElement('tr');

    const lucroClass = p.lucroFlower > 0 ? 'profit' : p.lucroFlower < 0 ? 'loss' : 'zero';
    const lucroDolarClass = p.lucroDolar > 0 ? 'profit' : p.lucroDolar < 0 ? 'loss' : 'zero';

    const lucroFlowerStr = (p.lucroFlower >= 0 ? '+' : '') + p.lucroFlower.toFixed(2);
    const lucroDolarStr = (p.lucroDolar >= 0 ? '+' : '') + p.lucroDolar.toFixed(2);

    tr.innerHTML = `
      <td>${formatarData(p.data)}${p.horario ? ' <span class="data-horario">' + p.horario + '</span>' : ''}</td>
      <td>${p.gold.toFixed(2)}</td>
      <td>${(p.diamante || 0).toFixed(2)}</td>
      <td>${p.flower.toFixed(2)}</td>
      <td>${(p.saque || 0).toFixed(2)}</td>
      <td>${p.goldFlower.toFixed(2)}</td>
      <td>${(p.diamanteFlower || 0).toFixed(2)}</td>
      <td>${p.totalFlower.toFixed(2)}</td>
      <td>$${p.totalDolar.toFixed(2)}</td>
      <td class="${lucroClass}">${lucroFlowerStr}</td>
      <td class="${lucroDolarClass}">${lucroDolarStr}</td>
      <td>${p.obs || '-'}</td>
      <td>
        <button class="btn-edit" data-edit="${i}">Editar</button>
        <button class="btn-del" data-del="${i}">Excluir</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  atualizarCards(processados);
  atualizarGraficos(processados);
}

function atualizarCards(processados) {
  if (!processados || processados.length === 0) {
    document.getElementById('cardPatrimonio').textContent = '0 Flower';
    document.getElementById('cardDolar').textContent = '$0.00';
    document.getElementById('cardLucro').textContent = '0 Flower';
    document.getElementById('cardMedia').textContent = '0 Flower';
    document.getElementById('cardEstimativa').textContent = '$0.00';
    return;
  }

  const ultimo = processados[processados.length - 1];
  const lucroAcumulado = processados.reduce((acc, p) => acc + p.lucroFlower, 0);
  const media = lucroAcumulado / processados.length;
  const estimativa = media * 30 * taxas.valorDolar;

  const flowerDolar = ultimo.flower * taxas.valorDolar;
  document.getElementById('cardPatrimonio').textContent = `${ultimo.flower.toFixed(2)} Flower`;
  document.getElementById('cardDolar').textContent = `$${flowerDolar.toFixed(2)}`;
  document.getElementById('cardLucro').textContent = `${(lucroAcumulado >= 0 ? '+' : '')}${lucroAcumulado.toFixed(2)} Flower`;
  document.getElementById('cardMedia').textContent = `${(media >= 0 ? '+' : '')}${media.toFixed(2)} Flower`;
  document.getElementById('cardEstimativa').textContent = `$${(estimativa >= 0 ? '+' : '')}${estimativa.toFixed(2)}`;
}

function atualizarGraficos(processados) {
  const temPreco = precoHistorico.length > 0;
  const temDados = processados.length > 0;

  if (!temPreco && !temDados) {
    if (chartPreco) { chartPreco.destroy(); chartPreco = null; }
    if (chartLucro) { chartLucro.destroy(); chartLucro = null; }
    const section = document.querySelector('.charts-section');
    if (section) section.remove();
    return;
  }

  let section = document.querySelector('.charts-section');
  if (!section) {
    section = document.createElement('section');
    section.className = 'charts-section';
    section.innerHTML = `
      <div class="chart-card" id="chartPrecoCard">
        <div class="chart-header">
          <div>
            <h3>Preço do Flower (USD)</h3>
            <div class="price-display">
              <span class="current-price" id="currentPrice">—</span>
              <span class="price-change" id="priceChange"></span>
            </div>
          </div>
          <div class="period-selector">
            <button class="period-btn" data-days="1">1H</button>
            <button class="period-btn active" data-days="7">7D</button>
            <button class="period-btn" data-days="30">30D</button>
          </div>
        </div>
        <canvas id="chartPreco"></canvas>
      </div>
      <div class="chart-card" id="chartLucroCard">
        <h3>Lucro / Prejuízo Diário</h3>
        <canvas id="chartLucro"></canvas>
      </div>
    `;
    document.querySelector('.container').appendChild(section);
    document.querySelectorAll('.period-btn').forEach(btn => {
      btn.addEventListener('click', () => mudarPeriodo(btn.dataset.days));
    });
  }

  const lucroCard = document.getElementById('chartLucroCard');
  if (lucroCard) lucroCard.style.display = temDados ? '' : 'none';
  const precoCard = document.getElementById('chartPrecoCard');
  if (precoCard) precoCard.style.display = temPreco ? '' : 'none';

  if (temPreco) {
    const precosData = precoHistorico.map(p => p.price);
    const firstPrice = precosData[0];
    const lastPrice = precosData[precosData.length - 1];
    const change = lastPrice - firstPrice;
    const changePct = (change / firstPrice) * 100;

    const priceEl = document.getElementById('currentPrice');
    const changeEl = document.getElementById('priceChange');
    if (priceEl) priceEl.textContent = '$' + lastPrice.toFixed(6);
    if (changeEl) {
      const sign = change >= 0 ? '+' : '';
      changeEl.textContent = `${sign}${change.toFixed(6)} (${sign}${changePct.toFixed(2)}%)`;
      changeEl.className = 'price-change ' + (change >= 0 ? 'positive' : 'negative');
    }

    const precosLabels = precoHistorico.map(p => {
      const d = new Date(p.timestamp);
      if (precoPeriodo === '1') {
        return d.toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });

    if (chartPreco) {
      chartPreco.data.labels = precosLabels;
      chartPreco.data.datasets[0].data = precosData;
      chartPreco.update();
    } else {
      chartPreco = new Chart(document.getElementById('chartPreco'), {
        type: 'line',
        data: {
          labels: precosLabels,
          datasets: [{
            label: 'Preço (USD)',
            data: precosData,
            borderColor: '#22c55e',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 1,
            pointBackgroundColor: '#22c55e',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#8899aa' } },
            tooltip: {
              callbacks: {
                title: items => {
                  const p = precoHistorico[items[0].dataIndex];
                  if (!p) return '';
                  return new Date(p.timestamp).toLocaleString('pt-BR');
                },
                label: ctx => '$' + ctx.parsed.y.toFixed(6),
              }
            }
          },
          scales: {
            x: { ticks: { color: '#8899aa', maxTicksLimit: 10 }, grid: { color: '#1e2530' } },
            y: { ticks: { color: '#8899aa', callback: v => '$' + v.toFixed(6) }, grid: { color: '#1e2530' } }
          }
        }
      });
    }
  } else if (chartPreco) {
    chartPreco.destroy();
    chartPreco = null;
  }

  if (temDados) {
    const datas = processados.map(p => formatarData(p.data));
    const lucros = processados.map(p => p.lucroFlower);

    if (chartLucro) {
      chartLucro.data.labels = datas;
      chartLucro.data.datasets[0].data = lucros;
      chartLucro.data.datasets[0].backgroundColor = lucros.map(v => v >= 0 ? '#22c55e' : '#ef4444');
      chartLucro.update();
    } else {
      chartLucro = new Chart(document.getElementById('chartLucro'), {
        type: 'bar',
        data: {
          labels: datas,
          datasets: [{
            label: 'Lucro/Dia (Flower)',
            data: lucros,
            backgroundColor: lucros.map(v => v >= 0 ? '#22c55e' : '#ef4444'),
            borderRadius: 4,
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: '#8899aa' } }
          },
          scales: {
            x: { ticks: { color: '#8899aa' }, grid: { color: '#1e2530' } },
            y: { ticks: { color: '#8899aa' }, grid: { color: '#1e2530' } }
          }
        }
      });
    }
  } else if (chartLucro) {
    chartLucro.destroy();
    chartLucro = null;
  }
}

function exportarCSV() {
  if (dados.length === 0) {
    mostrarToast('Nenhum dado para exportar.');
    return;
  }

  const processados = calcularEntradas();
  const linhas = [
    ['Data', 'Horário', 'Gold', 'Diamante', 'Flower', 'Saque',
     'Gold → Flower', 'Diamante → Flower', 'Patrimônio (Flower)', 'Patrimônio (USD)',
     'Lucro/Dia (Flower)', 'Lucro/Dia (USD)', 'Observações']
  ];

  processados.forEach(p => {
    linhas.push([
      p.data,
      p.horario || '',
      p.gold.toFixed(2),
      (p.diamante || 0).toFixed(2),
      p.flower.toFixed(2),
      (p.saque || 0).toFixed(2),
      p.goldFlower.toFixed(2),
      (p.diamanteFlower || 0).toFixed(2),
      p.totalFlower.toFixed(2),
      p.totalDolar.toFixed(2),
      (p.lucroFlower >= 0 ? '+' : '') + p.lucroFlower.toFixed(2),
      (p.lucroDolar >= 0 ? '+' : '') + p.lucroDolar.toFixed(2),
      p.obs || ''
    ]);
  });

  const csv = linhas.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `sunflower-land-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  mostrarToast('CSV exportado!');
}

function formatarData(data) {
  if (!data) return '';
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

function salvarBackup() {
  if (dados.length === 0) {
    mostrarToast('Nenhum dado para salvar.');
    return;
  }

  const backup = {
    dados: dados,
    taxas: taxas,
    exportadoEm: new Date().toISOString()
  };

  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `sunflower-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  mostrarToast('Backup salvo!');
}

function carregarBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (ev) {
    try {
      const backup = JSON.parse(ev.target.result);

      if (!backup.dados || !Array.isArray(backup.dados)) {
        mostrarToast('Arquivo inválido.');
        return;
      }

      dados = backup.dados;
      if (backup.taxas) {
        taxas = backup.taxas;
        atualizarInputsTaxas();
      }

      agendarSaveFirestore();
      renderizar();
      mostrarToast(`Backup carregado! ${dados.length} registro(s).`);
    } catch {
      mostrarToast('Erro ao ler o arquivo.');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

function mostrarToast(msg) {
  toast.textContent = msg;
  toast.classList.add('ativo');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('ativo'), 2500);
}
