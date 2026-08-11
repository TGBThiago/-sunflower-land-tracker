const admin = require('firebase-admin');

const TIMEZONE_SP = 'America/Sao_Paulo';
const FARM_PROXY_URL = 'https://sfl-farm-proxy.sfl-proxy.workers.dev';
const SFL_SYNC_TIMEOUT_MS = 90000;
const SFL_SYNC_INTERVAL_MS = 1500;
const ORIGEM = 'SFL.World';
const JANELA_MIN = 30;

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

function paraMinutos(horario) {
  const [h, m] = String(horario).split(':').map(Number);
  return h * 60 + m;
}

function encontrarHorarioAlvo(agora, horarios) {
  const agoraMin = paraMinutos(agora.horario);
  for (const horario of horarios) {
    const alvoMin = paraMinutos(horario);
    const diff = (agoraMin - alvoMin + 1440) % 1440;
    if (diff >= 0 && diff <= JANELA_MIN) return horario;
  }
  return null;
}

async function executar(config) {
  const agora = obterDataHoraSP();
  console.log('[AUTO-SAVE] Início em ' + agora.data + ' ' + agora.horario + ' (SP).');

  const alvo = encontrarHorarioAlvo(agora, config.horarios);
  if (!alvo) {
    console.log('[AUTO-SAVE] Nenhum horário configurado coincide com ' + agora.horario + ' (janela de ' + JANELA_MIN + ' min) — nada a fazer.');
    return { executado: false };
  }
  console.log('[AUTO-SAVE] Horário alvo ' + alvo + ' detectado — sincronizando farm ' + config.farmId + '...');
  await dispararSyncFarm(config.farmId);
  await aguardarSyncCompleto(config.farmId);
  const dadosFarm = await buscarDadosFarm(config.farmId);
  if (!validarDadosFarm(dadosFarm)) {
    throw new Error('Dados obtidos após o SYNC são inválidos/incompletos.');
  }

  const registro = {
    farmId: config.farmId,
    data: agora.data,
    horario: alvo,
    gold: dadosFarm.gold,
    diamante: dadosFarm.diamonds,
    flower: dadosFarm.flower,
    saque: 0,
    obs: '',
    consultadoEm: dadosFarm.fetchedAt || new Date().toISOString(),
    origem: ORIGEM,
  };
  const chave = `${config.farmId}|${agora.data}|${alvo}`;
  const chaveExecutado = `${agora.data}|${alvo}`;

  if (Array.isArray(config.executados) && config.executados.includes(chaveExecutado)) {
    console.log('[AUTO-SAVE] ' + chaveExecutado + ' já executado hoje — pulado (não recria registro excluído).');
    return { executado: false, jaExecutado: true };
  }

  const docs = await admin.firestore().collection('tracker').get();
  let atualizados = 0;
  let encontradoExistente = false;

  for (const doc of docs.docs) {
    const atual = doc.data() || {};
    const dados = Array.isArray(atual.dados) ? atual.dados : [];
    const temFarm = dados.some(r => r && r.farmId === config.farmId);
    if (!temFarm) continue;

    const jaExiste = dados.some(r => r && r.farmId && `${r.farmId}|${r.data}|${r.horario}` === chave);
    if (jaExiste) {
      console.log('[AUTO-SAVE] Registro já existe para ' + doc.id + ' — pulado (anti-duplicação).');
      encontradoExistente = true;
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
    console.log('[AUTO-SAVE] Registro ' + agora.data + ' ' + alvo + ' gravado para ' + doc.id + '.');
  }

  if (atualizados > 0 || encontradoExistente) {
    try {
      await admin.firestore().doc('config/autosave').set({
        executados: admin.firestore.FieldValue.arrayUnion(chaveExecutado),
      }, { merge: true });
    } catch (err) {
      console.warn('[AUTO-SAVE] Não foi possível marcar ' + chaveExecutado + ' como executado:', err.message);
    }
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

  let config = { farmId: FARM_ID_PADRAO, horarios: HORARIOS_PADRAO, executados: [] };
  try {
    const snap = await admin.firestore().doc('config/autosave').get();
    if (snap.exists) {
      const d = snap.data() || {};
      const hoje = obterDataHoraSP().data;
      const executados = (Array.isArray(d.executados) ? d.executados : []).filter(e => typeof e === 'string' && e.startsWith(hoje + '|'));
      config = {
        farmId: (d.farmId && String(d.farmId)) || FARM_ID_PADRAO,
        horarios: (Array.isArray(d.horarios) && d.horarios.length) ? d.horarios : HORARIOS_PADRAO,
        executados,
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
