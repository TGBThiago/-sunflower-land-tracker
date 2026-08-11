# Login com email/senha + dados privados por usuÃ¡rio â€” Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar login obrigatÃ³rio (email/senha + Google) ao site `sunflower-calculadora.web.app`, com dados privados por usuÃ¡rio, e migrar os 2 registros atuais do dono.

**Architecture:** A tela de login/cadastro (`auth.js`) controla o estado de autenticaÃ§Ã£o via `onAuthStateChanged`. Com usuÃ¡rio logado, o app carrega/escreve em `tracker/<uid>` (documento por usuÃ¡rio no Firestore). Regras do Firestore permitem ler/escrever apenas o prÃ³prio documento. Uma migraÃ§Ã£o via URL secreta copia o documento legado `tracker/main` para o documento do dono e o apaga.

**Tech Stack:** Firebase compat SDK 10.14.1 (app/auth/firestore/analytics) via CDN, HTML/CSS/JS vanilla, Playwright (e2e), Firebase CLI 13.0.0.

**Projeto:** `C:\Users\thiag\OneDrive\Ãrea de Trabalho\sunflower-land-tracker-backup\sunflower-land-tracker-backup\`

## Global Constraints

- Projeto **sem repositÃ³rio git** â†’ nenhuma etapa de commit; salvar arquivos direto no diretÃ³rio.
- Firebase project: `sunflower-calculadora` (`.firebaserc` jÃ¡ aponta para ele).
- Todos os comandos `npm`/`node`/`firebase` rodam com `workdir` = raiz do projeto.
- Arquivos publicados: `firebase.json` public `"."` â€” `*.md`, `e2e`, `save`, `node_modules`, `.planning`, `test-results`, `firestore.rules` jÃ¡ sÃ£o ignorados do hosting.
- Idioma da UI: **pt-BR**.
- Sem dependÃªncias novas; usar os SDKs compat jÃ¡ carregados no `index.html`.
- **Ordem obrigatÃ³ria:** o backup (Task 1) DEVE rodar antes do deploy das regras novas (Task 4), pois as regras novas bloqueiam leitura de `tracker/main`.
- Testes: `npm test` (Playwright chromium, `file://`). e2e usa flags `window.__test_skip_firestore` (jÃ¡ existe) e `window.__test_skip_auth` (novo).
- NÃ£o alterar o layout existente alÃ©m do necessÃ¡rio para a tela de login/botÃ£o Sair.

---

## Task 1: Backup dos dados atuais (rede de seguranÃ§a)

**Files:**
- Create: `save/sunflower-backup-2026-08-10.json` (via script temporÃ¡rio)
- Copy: `C:\Users\thiag\OneDrive\Ãrea de Trabalho\sunflower-backup-2026-08-10.json`

**Interfaces:**
- Consumes: Firestore `tracker/main` (SDK web, login anÃ´nimo â€” regras atuais ainda permitem).
- Produces: arquivo JSON com `{ dados, taxas, exportadoEm }` usado como seguranÃ§a no fluxo todo.

- [ ] **Step 1: Criar script de backup temporÃ¡rio**

Create `C:\Users\thiag\AppData\Local\Temp\opencode\backup-main.js`:

```js
const { initializeApp } = require('firebase/app');
const { getAuth, signInAnonymously } = require('firebase/auth');
const { getFirestore, doc, getDoc } = require('firebase/firestore');
const fs = require('fs');

const config = {
  apiKey: 'AIzaSyCmMhetbyG1ozSsFMNYC9Q_EBADLPskTdg',
  authDomain: 'sunflower-calculadora.firebaseapp.com',
  projectId: 'sunflower-calculadora',
};
const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

(async () => {
  await signInAnonymously(auth);
  const snap = await getDoc(doc(db, 'tracker', 'main'));
  if (!snap.exists()) {
    console.log('NO DOC tracker/main');
    process.exit(0);
  }
  const data = snap.data();
  const backup = {
    dados: data.dados || [],
    taxas: data.taxas || {},
    exportadoEm: new Date().toISOString(),
  };
  const out = process.argv[2];
  fs.writeFileSync(out, JSON.stringify(backup, null, 2), 'utf8');
  console.log('OK records=' + backup.dados.length + ' -> ' + out);
  process.exit(0);
})().catch(e => { console.error('ERR ' + e.message); process.exit(1); });
```

- [ ] **Step 2: Rodar o script (workdir = projeto)**

Run:
```bash
node "C:\Users\thiag\AppData\Local\Temp\opencode\backup-main.js" "save\sunflower-backup-2026-08-10.json"
```
Expected: `OK records=2 -> save\sunflower-backup-2026-08-10.json`

- [ ] **Step 3: Copiar para o Desktop**

```bash
Copy-Item "save\sunflower-backup-2026-08-10.json" "$env:USERPROFILE\OneDrive\Ãrea de Trabalho\sunflower-backup-2026-08-10.json"
```

- [ ] **Step 4: Verificar conteÃºdo do backup**

```bash
Get-Content "save\sunflower-backup-2026-08-10.json"
```
Expected: arquivo JSON com `dados` contendo 2 registros (datas `2026-08-10`) e `taxas`.

---

## Task 2: Tela de login/cadastro + dados por usuÃ¡rio + regras

**Files:**
- Modify: `e2e/tracker.spec.js` (flags + teste de login)
- Modify: `index.html` (tela de login, botÃ£o Sair, script `auth.js`)
- Create: `auth.js`
- Modify: `style.css` (estilos da tela de login/Sair)
- Modify: `script.js` (inicializaÃ§Ã£o autenticada)
- Modify: `firebase.js` (documento por UID, sem anÃ´nimo)
- Modify: `firestore.rules` (regra por usuÃ¡rio + acesso de migraÃ§Ã£o a `main`)

**Interfaces:**
- Consumes: `firebase.auth()` (provedores Email/Senha e Google habilitados pelo dono no console).
- Produces: `window.setupAuthFlow(onReady)` â€” registra `onAuthStateChanged` e chama `onReady()` quando hÃ¡ usuÃ¡rio logado; exibe/esconde tela de login. `window.__test_skip_auth` pula o gate de autenticaÃ§Ã£o.

- [ ] **Step 1: Escrever os testes (red)**

Modify `e2e/tracker.spec.js`:

1. No `test.beforeEach` (linhas 33-39), adicionar a flag de auth ao init script:

```js
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
```

2. Adicionar um novo `test.describe` ao final do arquivo (fora do bloco existente):

```js
test.describe('Auth', () => {
  test('deve mostrar tela de login quando nÃ£o autenticado', async ({ page }) => {
    await page.goto(INDEX);
    await page.waitForLoadState('load');
    await expect(page.locator('#authScreen')).toBeVisible();
    await expect(page.locator('.container')).toBeHidden();
  });
});
```

- [ ] **Step 2: Rodar os testes (esperar o teste de login falhar)**

Run: `npm test`
Expected: os testes existentes passam; o novo teste `Auth â€º deve mostrar tela de login quando nÃ£o autenticado` FALHA (`#authScreen` nÃ£o encontrado).

- [ ] **Step 3: Adicionar tela de login ao `index.html`**

Modify `index.html`:

1. Logo apÃ³s `<body>` (antes do `<div class="container">`), inserir:

```html
  <div class="auth-screen" id="authScreen">
    <div class="auth-card">
      <h1><span class="gold">âœ¦</span> Sunflower Land <span class="gold">âœ¦</span></h1>
      <p class="subtitle">Planilha de Lucro DiÃ¡rio</p>
      <p class="auth-error" id="authError"></p>
      <form id="loginForm" class="auth-form" autocomplete="on">
        <input type="email" id="authEmail" placeholder="Email" required autocomplete="email">
        <input type="password" id="authPassword" placeholder="Senha" required minlength="6" autocomplete="current-password">
        <button type="submit" class="btn btn-add" id="authSubmit">Entrar</button>
      </form>
      <button type="button" class="btn-google" id="btnGoogle">Entrar com Google</button>
      <div class="auth-links">
        <button type="button" class="link-btn" id="btnEsqueci">Esqueci minha senha</button>
        <button type="button" class="link-btn" id="btnToggleCadastro">Criar conta</button>
      </div>
    </div>
  </div>
```

2. No `<header>` (linhas 11-15), adicionar o botÃ£o Sair logo apÃ³s a abertura:

```html
      <button class="btn-sair" id="btnSair" style="display:none">Sair</button>
```

3. Adicionar o script `auth.js` entre `firebase.js` e `chart.js` (linhas 152-153):

```html
  <script src="firebase.js"></script>
  <script src="auth.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

- [ ] **Step 4: Criar `auth.js`**

Create `auth.js`:

```js
(function () {
  const authScreen = document.getElementById('authScreen');
  const container = document.querySelector('.container');
  const btnSair = document.getElementById('btnSair');
  const btnGoogle = document.getElementById('btnGoogle');
  const btnEsqueci = document.getElementById('btnEsqueci');
  const btnToggleCadastro = document.getElementById('btnToggleCadastro');
  const formLogin = document.getElementById('loginForm');
  const inputEmail = document.getElementById('authEmail');
  const inputPassword = document.getElementById('authPassword');
  const btnSubmit = document.getElementById('authSubmit');
  const authError = document.getElementById('authError');

  let modoCadastro = false;

  function mostrarErro(msg) {
    if (authError) {
      authError.textContent = msg;
      authError.style.display = 'block';
    }
  }

  function limparErro() {
    if (authError) {
      authError.textContent = '';
      authError.style.display = 'none';
    }
  }

  function traduzirErro(code) {
    const map = {
      'auth/invalid-email': 'Email invÃ¡lido.',
      'auth/user-not-found': 'Email ou senha incorretos.',
      'auth/wrong-password': 'Email ou senha incorretos.',
      'auth/invalid-credential': 'Email ou senha incorretos.',
      'auth/email-already-in-use': 'Este email jÃ¡ estÃ¡ cadastrado.',
      'auth/weak-password': 'Senha muito fraca (mÃ­nimo 6 caracteres).',
      'auth/popup-closed-by-user': 'Login com Google cancelado.',
      'auth/cancelled-popup-request': 'Login com Google cancelado.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'auth/network-request-failed': 'Falha de rede. Verifique sua internet.',
    };
    return map[code] || 'Erro: ' + code;
  }

  function mostrarOuEsconderTela(logado) {
    if (authScreen) authScreen.style.display = logado ? 'none' : 'flex';
    if (container) container.style.display = logado ? '' : 'none';
    if (btnSair) btnSair.style.display = logado ? '' : 'none';
  }

  function atualizarForm() {
    btnSubmit.textContent = modoCadastro ? 'Criar conta' : 'Entrar';
    btnToggleCadastro.textContent = modoCadastro ? 'JÃ¡ tenho conta' : 'Criar conta';
    if (btnEsqueci) btnEsqueci.style.display = modoCadastro ? 'none' : '';
    limparErro();
  }

  window.setupAuthFlow = function (onReady) {
    firebase.auth().onAuthStateChanged(user => {
      mostrarOuEsconderTela(!!user);
      if (user && typeof onReady === 'function') onReady();
    });
  };

  if (btnToggleCadastro) btnToggleCadastro.addEventListener('click', () => {
    modoCadastro = !modoCadastro;
    atualizarForm();
  });

  if (btnEsqueci) btnEsqueci.addEventListener('click', () => {
    const email = inputEmail.value.trim();
    if (!email) {
      mostrarErro('Informe seu email no campo acima para recuperar a senha.');
      return;
    }
    firebase.auth().sendPasswordResetEmail(email)
      .then(() => mostrarErro('Email de redefiniÃ§Ã£o enviado!'))
      .catch(err => mostrarErro(traduzirErro(err.code)));
  });

  if (btnGoogle) btnGoogle.addEventListener('click', () => {
    limparErro();
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(err => mostrarErro(traduzirErro(err.code)));
  });

  if (formLogin) formLogin.addEventListener('submit', e => {
    e.preventDefault();
    limparErro();
    const email = inputEmail.value.trim();
    const senha = inputPassword.value;
    if (!email || !senha) {
      mostrarErro('Preencha email e senha.');
      return;
    }
    const action = modoCadastro
      ? firebase.auth().createUserWithEmailAndPassword(email, senha)
      : firebase.auth().signInWithEmailAndPassword(email, senha);
    action.catch(err => mostrarErro(traduzirErro(err.code)));
  });

  if (btnSair) btnSair.addEventListener('click', () => {
    firebase.auth().signOut().catch(() => {});
  });

  atualizarForm();
})();
```

- [ ] **Step 5: Adicionar estilos ao `style.css`**

Modify `style.css` (adicionar ao final):

```css
/* ===== Tela de login ===== */
.auth-screen {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 40px);
  padding: 16px;
}
.auth-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 28px;
  width: 100%;
  max-width: 380px;
  text-align: center;
}
.auth-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 18px 0 10px;
}
.auth-form input {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border);
  background: var(--surface2);
  color: var(--text);
  font-size: 0.95rem;
}
.auth-error {
  color: var(--loss);
  font-size: 0.85rem;
  min-height: 1.3em;
  margin-top: 10px;
}
.auth-links {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin-top: 14px;
}
.link-btn {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 4px;
}
.link-btn:hover {
  text-decoration: underline;
}
.btn-google {
  width: 100%;
  background: var(--surface2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 10px 12px;
  cursor: pointer;
  font-size: 0.95rem;
}
.btn-google:hover {
  background: var(--border);
}
.btn-sair {
  position: absolute;
  top: 16px;
  right: 16px;
  background: var(--surface2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 14px;
  cursor: pointer;
}
.btn-sair:hover {
  background: var(--border);
}
```

TambÃ©m alterar a regra `.container` (linhas 26-29) para comeÃ§ar escondido (a tela de login o mostra quando autentica):

```css
.container {
  max-width: 1400px;
  margin: 0 auto;
  display: none;
}
```

- [ ] **Step 6: InicializaÃ§Ã£o autenticada no `script.js`**

Modify `script.js`:

1. Substituir a linha 35 `init();` por:

```js
iniciarApp();

function iniciarApp() {
  if (window.__test_skip_auth) {
    const c = document.querySelector('.container');
    if (c) c.style.display = '';
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
```

- [ ] **Step 7: Documento por usuÃ¡rio no `firebase.js`**

Modify `firebase.js` â€” substituir o bloco das linhas 20-42 (coleÃ§Ã£o + refs) e `resetFirebase` (linhas 66-82):

Novo conteÃºdo do arquivo completo:

```js
const firebaseConfig = {
  apiKey: 'AIzaSyCmMhetbyG1ozSsFMNYC9Q_EBADLPskTdg',
  authDomain: 'sunflower-calculadora.firebaseapp.com',
  projectId: 'sunflower-calculadora',
  storageBucket: 'sunflower-calculadora.firebasestorage.app',
  messagingSenderId: '175990453610',
  appId: '1:175990453610:web:aacd735238e627c5fc2113',
  measurementId: 'G-B1SZC92YQZ',
};

firebase.initializeApp(firebaseConfig);

try {
  firebase.analytics();
} catch (e) {
  console.warn('Analytics not available:', e.message);
}

const db = firebase.firestore();
const TRACKER_COLLECTION = 'tracker';

let unsubSnapshot = null;

function getTrackerRef() {
  const user = firebase.auth().currentUser;
  if (!user) return Promise.reject(new Error('UsuÃ¡rio nÃ£o logado'));
  return Promise.resolve(db.collection(TRACKER_COLLECTION).doc(user.uid));
}

function onTrackerSnapshot(callback) {
  getTrackerRef().then(ref => {
    unsubSnapshot = ref.onSnapshot(
      doc => {
        if (doc.exists) {
          callback(doc.data());
        } else {
          callback({ dados: [], taxas: null, version: 0 });
        }
      },
      err => console.warn('Snapshot error:', err.message)
    );
  }).catch(() => {});
}

function unsubscribeSnapshot() {
  if (unsubSnapshot) {
    unsubSnapshot();
    unsubSnapshot = null;
  }
}

async function resetFirebase() {
  unsubscribeSnapshot();
  try {
    const ref = await getTrackerRef();
    await ref.set({
      dados: [],
      taxas: {},
      version: 0,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    await firebase.auth().signOut();
  } catch (e) {
  }
}
```

- [ ] **Step 8: Regras do Firestore**

Modify `firestore.rules` (arquivo completo):

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Cada usuÃ¡rio sÃ³ lÃª/escreve o prÃ³prio documento
    match /tracker/{docId} {
      allow read, write: if request.auth != null && request.auth.uid == docId;
      // Acesso somente de migraÃ§Ã£o ao documento legado (copiar e excluir)
      allow get, delete: if docId == 'main';
    }

    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 9: Rodar os testes (green)**

Run: `npm test`
Expected: TODOS os testes passam, incluindo `Auth â€º deve mostrar tela de login quando nÃ£o autenticado`.

---

## Task 3: MigraÃ§Ã£o automÃ¡tica via link secreto

**Files:**
- Modify: `script.js` (init + `executarMigracaoSeSolicitada` + `MIGRATION_SECRET`)

**Interfaces:**
- Consumes: `getTrackerRef()`, `db.collection(TRACKER_COLLECTION)`, `mostrarToast()`.
- Produces: migra `tracker/main` â†’ documento do usuÃ¡rio logado quando a URL contÃ©m `?migrar=<segredo>`. Usada pelo dono apÃ³s o deploy (Task 5).

- [ ] **Step 1: Adicionar o segredo e a funÃ§Ã£o de migraÃ§Ã£o**

Modify `script.js`:

1. Logo apÃ³s as declaraÃ§Ãµes de constantes (linhas 1-33), adicionar:

```js
const MIGRATION_SECRET = 'SL-41dcc7bf5ed62791901e01b9';
```

2. Em `init()` (linha 37), inserir `await executarMigracaoSeSolicitada();` como primeira linha:

```js
async function init() {
  mostrarCarregando(true);
  await executarMigracaoSeSolicitada();
  await carregarDoFirestore();
  mostrarCarregando(false);
  renderizar();
  iniciarSnapshot();
  iniciarAtualizacaoPreco();
}
```

3. Adicionar a funÃ§Ã£o logo abaixo de `init()`:

```js
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
    mostrarToast('Erro na migraÃ§Ã£o: ' + err.message);
  }
}
```

- [ ] **Step 2: Rodar os testes**

Run: `npm test`
Expected: todos os testes passam (a migraÃ§Ã£o retorna cedo com `__test_skip_firestore`).

---

## Task 4: Deploy e verificaÃ§Ã£o

**Files:**
- Deploy: hosting + firestore rules via CLI.

**Interfaces:**
- Consumes: cÃ³digo das Tasks 1-3; provedores Email/Senha e Google jÃ¡ habilitados no console.

- [ ] **Step 1: Confirmar login do Firebase CLI**

Run:
```bash
firebase login --reauth
```
Expected: abre o navegador para autenticar (necessÃ¡rio se ainda nÃ£o logado). Pode pular se jÃ¡ logado.

- [x] **Step 2: Deploy**

Run: `firebase deploy --project sunflower-calculadora`
Expected: sucesso em `firestore.rules` e `hosting` (arquivos de `firebase.js`, `auth.js`, `script.js`, `index.html`, `style.css`). `*.md`/`e2e`/`save` sÃ£o ignorados pelo hosting.

- [x] **Step 3: VerificaÃ§Ã£o de regras (opcional) â€” console Firebase**

Abrir Firestore â†’ Regras â†’ **Simulador**: testar uma leitura em `tracker/outro-uid` â†’ esperado **NEGADO**.

- [ ] **Step 4: VerificaÃ§Ã£o manual no navegador (dono)**

1. Abrir `https://sunflower-calculadora.web.app/` â†’ deve aparecer a tela de login.
2. Criar conta com email+senha â†’ deve abrir planilha vazia.
3. Clicar **Sair** â†’ volta para a tela de login. Entrar de novo â†’ planilha vazia persiste.
4. Abrir em outra aba (sem login) â†’ tela de login.
5. Criar segunda conta (outro email) â†’ planilha vazia independente.

---

## Task 5: MigraÃ§Ã£o dos dados do dono (aÃ§Ã£o manual pÃ³s-deploy)

**Files:** nenhum â€” passo de uso.

- [ ] **Step 1: Dono faz login com a conta criada na Task 4**

Abrir `https://sunflower-calculadora.web.app/` e entrar com o email/senha da conta do dono.

- [ ] **Step 2: Abrir a URL secreta de migraÃ§Ã£o**

Na mesma aba, abrir:
```
https://sunflower-calculadora.web.app/?migrar=SL-41dcc7bf5ed62791901e01b9
```
Expected: toast "Dados migrados com sucesso!", os 2 registros de `2026-08-10` aparecem na tabela, e a URL fica sem o parÃ¢metro `?migrar=`.

- [ ] **Step 3: Confirmar no Firestore (console)**

Firestore â†’ coleÃ§Ã£o `tracker`: existe documento com o UID do dono contendo `dados` com 2 registros; **nÃ£o existe** mais `tracker/main`.

- [ ] **Step 4: Testar isolamento com amigo**

Pedir a um amigo para abrir `https://sunflower-calculadora.web.app/`, criar a prÃ³pria conta e confirmar que a planilha dele estÃ¡ vazia e independente.

---

## Self-Review

- **Cobertura da spec:** login email/senha + Google (Task 2) âœ“; dados por usuÃ¡rio (Task 2, firebase.js + rules) âœ“; prÃ©-requisito provedores (instruÃ­do e jÃ¡ feito pelo dono) âœ“; backup prÃ©-deploy (Task 1) âœ“; migraÃ§Ã£o via link secreto (Task 3 + Task 5) âœ“; sem anÃ´nimo (firebase.js) âœ“; esqueci senha (auth.js) âœ“; logout (auth.js) âœ“; testes com bypass (Task 2 Step 1) âœ“.
- **Placeholders:** nenhum; todos os passos tÃªm cÃ³digo e comandos exatos.
- **ConsistÃªncia de tipos/nomes:** `MIGRATION_SECRET` usado igual em Task 3 e Task 5; `setupAuthFlow(init)` (Task 2) e `iniciarApp()` (Task 2) coerentes com o `init()` existente; `executarMigracaoSeSolicitada` chamado em `init()` e definido na mesma Task 3; `__test_skip_auth` idÃªntico em `script.js` e `e2e/tracker.spec.js`.
