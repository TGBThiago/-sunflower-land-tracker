const admin = require('firebase-admin');

const TIMEZONE_SP = 'America/Sao_Paulo';
const FARM_PROXY_URL = 'https://sfl-farm-proxy.sfl-proxy.workers.dev';
const SFL_SYNC_TIMEOUT_MS = 90000;
const SFL_SYNC_INTERVAL_MS = 1500;
const ORIGEM = 'SFL.World';

const HORARIOS_PADRAO = ['01:00', '07:00', '13:00', '19:00', '20:06', '20:33', '21:12'];
const FARM_ID_PADRAO = '72837';

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

function fetchComTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

async function dispararSyncFarm(farmId) {
  const res = await fetchComTimeout(FARM_PROXY_URL + '/update/' + encodeURIComponent(farmId), 20000);
  if (!res.ok) throw new Error('SFL World recusou o SYNC (HTTP ' + res.status + ').');
  const data = await res.json();
  if (!data || data.status !== 'OK') {
    throw new Error('SFL World não autorizou o início do SYNC: ' + JSON.stringify(data));
  }
}

async function aguardarSyncCompleto(farmId) {
  const inicio = Date.now();
  while (Date.now() - inicio < SFL_SYNC_TIMEOUT_MS) {
    const res = await fetchComTimeout(FARM_PROXY_URL + '/update/' + encodeURIComponent(farmId) + '/check', 15000);
    if (!res.ok) throw new Error('Erro ao consultar o SYNC (HTTP ' + res.status + ').');
    const data = await res.json();
    if (data && data.status === 'OK') return data;
    await new Promise(r => setTimeout(r, SFL_SYNC_INTERVAL_MS));
  }
  throw new Error('Tempo esgotado aguardando o SYNC do SFL World.');
}

async function buscarDadosFarm(farmId) {
  const res = await fetchComTimeout(FARM_PROXY_URL + '?farmId=' + encodeURIComponent(farmId), 15000);
  if (!res.ok) throw new Error('Proxy HTTP ' + res.status);
  return res.json();
}

function validarDadosFarm(d) {
  if (!d || typeof d !== 'object') return false;
  const valores = [d.gold, d.diamonds, d.flower];
  if (valores.some(v => v === null || v === undefined || v === '')) return false;
  if (valores.some(v => typeof v !== 'number' || !isFinite(v) || v < 0)) return false;
  return true;
}

async function executar(config) {
  const agora = obterDataHoraSP();
  console.log('[AUTO-SAVE] Início em ' + agora.data + ' ' + agora.horario + ' (SP).');

  if (!config.horarios.includes(agora.horario)) {
    console.log('[AUTO-SAVE] Horário ' + agora.horario + ' fora da lista — nada a fazer.');
    return { executado: false };
  }

  console.log('[AUTO-SAVE] Horário ' + agora.horario + ' coincide — sincronizando farm ' + config.farmId + '...');
  await dispararSyncFarm(config.farmId);
  await aguardarSyncCompleto(config.farmId);
  const dadosFarm = await buscarDadosFarm(config.farmId);
  if (!validarDadosFarm(dadosFarm)) {
    throw new Error('Dados obtidos após o SYNC são inválidos/incompletos.');
  }

  const registro = {
    farmId: config.farmId,
    data: agora.data,
    horario: agora.horario,
    gold: dadosFarm.gold,
    diamante: dadosFarm.diamonds,
    flower: dadosFarm.flower,
    saque: 0,
    obs: '',
    consultadoEm: dadosFarm.fetchedAt || new Date().toISOString(),
    origem: ORIGEM,
  };
  const chave = `${config.farmId}|${agora.data}|${agora.horario}`;

  const docs = await admin.firestore().collection('tracker').get();
  let atualizados = 0;

  for (const doc of docs.docs) {
    const atual = doc.data() || {};
    const dados = Array.isArray(atual.dados) ? atual.dados : [];
    const temFarm = dados.some(r => r && r.farmId === config.farmId);
    if (!temFarm) continue;

    const jaExiste = dados.some(r => r && r.farmId && `${r.farmId}|${r.data}|${r.horario}` === chave);
    if (jaExiste) {
      console.log('[AUTO-SAVE] Registro já existe para ' + doc.id + ' — pulado (anti-duplicação).');
      continue;
    }

    await admin.firestore().runTransaction(async (tx) => {
      const ref = doc.ref;
      const fresca = (await tx.get(ref)).data() || {};
      const lista = Array.isArray(fresca.dados) ? fresca.dados : [];
      const dup = lista.some(r => r && r.farmId && `${r.farmId}|${r.data}|${r.horario}` === chave);
      if (dup) return;
      tx.update(ref, {
        dados: [...lista, registro],
        version: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
    atualizados++;
    console.log('[AUTO-SAVE] Registro ' + agora.data + ' ' + agora.horario + ' gravado para ' + doc.id + '.');
  }

  console.log('[AUTO-SAVE] Concluído. Docs atualizados: ' + atualizados + '.');
  return { executado: true, atualizados };
}

async function main() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    throw new Error('Variável FIREBASE_SERVICE_ACCOUNT não definida.');
  }
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(serviceAccountJson);
  } catch (e) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT não é um JSON válido.');
  }
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

  let config = { farmId: FARM_ID_PADRAO, horarios: HORARIOS_PADRAO };
  try {
    const snap = await admin.firestore().doc('config/autosave').get();
    if (snap.exists) {
      const d = snap.data() || {};
      config = {
        farmId: (d.farmId && String(d.farmId)) || FARM_ID_PADRAO,
        horarios: (Array.isArray(d.horarios) && d.horarios.length) ? d.horarios : HORARIOS_PADRAO,
      };
    }
  } catch (err) {
    console.warn('config/autosave não lido, usando padrão:', err.message);
  }
  console.log('[AUTO-SAVE] Farm: ' + config.farmId + ' · Horários: ' + config.horarios.join(' '));

  await executar(config);
}

main().then(() => process.exit(0)).catch(err => {
  console.error('[AUTO-SAVE] ERRO:', err.message);
  process.exit(1);
});
