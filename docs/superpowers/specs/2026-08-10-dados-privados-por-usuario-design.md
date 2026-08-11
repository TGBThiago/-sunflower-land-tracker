# Design â€” Login com email/senha + dados privados por usuÃ¡rio

Data: 2026-08-10
Status: Em revisÃ£o (v2 â€” login obrigatÃ³rio)

## Objetivo

Compartilhar o site `sunflower-calculadora.web.app` com amigos de forma que cada
pessoa tenha a prÃ³pria planilha de lucro (dados, taxas e histÃ³rico), sem ver nem
modificar os dados de outra pessoa. Os dados ficam atrelados a uma **conta com
email e senha**, para que fiquem salvos de forma permanente (em qualquer navegador).

## Problema atual

- Todos os dados ficam em um Ãºnico documento Firestore fixo: `tracker/main`
  (`firebase.js:26-42`).
- A regra do Firestore permite leitura/escrita a qualquer usuÃ¡rio autenticado:
  `allow read, write: if request.auth != null` (`firestore.rules:7`).
- Login Ã© anÃ´nimo (`signInAnonymously`), o que se perde ao limpar o navegador.

## PrÃ©-requisito (aÃ§Ã£o do dono no console)

- Habilitar os provedores em Firebase Console â†’
  Authentication â†’ Sign-in method:
  - **Email/Senha** â†’ Email/Password â†’ Enable â†’ Save;
  - **Google** â†’ Google â†’ Enable â†’ informar email de suporte â†’ Save.
- Link direto: https://console.firebase.google.com/project/sunflower-calculadora/authentication/providers
- Hoje o projeto NÃƒO tem Email/Senha habilitado (verificado via
  `accounts:createAuthUri` â€” `signupMethods` vazio).

## SoluÃ§Ã£o

### 1. Login obrigatÃ³rio com email/senha + Google (novo `auth.js` + `index.html`)

- Tela de **entrada/cadastro** (email + senha) e botÃ£o **"Entrar com Google"**,
  exibida quando nÃ£o hÃ¡ usuÃ¡rio logado.
- BotÃ£o **"Sair"** no cabeÃ§alho para encerrar a sessÃ£o.
- Link **"Esqueci minha senha"** â†’ envia email de redefiniÃ§Ã£o
  (`sendPasswordResetEmail`). NecessÃ¡rio porque o login Ã© obrigatÃ³rio.
- Sem modo anÃ´nimo. A planilha sÃ³ carrega com usuÃ¡rio logado.
- `onAuthStateChanged` dispara o carregamento dos dados apÃ³s o login.

### 2. Documento por usuÃ¡rio no Firestore (`firebase.js`)

- Remover `signInAnonymously`.
- `getTrackerRef()` passa a usar `db.collection('tracker').doc(currentUser.uid)`.
- Garantir que a referÃªncia sÃ³ seja criada com usuÃ¡rio logado.
- Remover a constante `FIXED_DOC_ID` (usada sÃ³ para o doc fixo `main`).

### 3. Regras do Firestore (`firestore.rules`)

Apertar para impedir leitura de documentos alheios, mantendo acesso somente de
migraÃ§Ã£o ao documento antigo `main` (get + delete):

```firestore
match /tracker/{docId} {
  allow read, write: if request.auth != null && request.auth.uid == docId;
  allow get, delete: if docId == 'main';
}
```

- Cada usuÃ¡rio sÃ³ lÃª/escreve o prÃ³prio documento.
- `main` sÃ³ Ã© legÃ­vel/apagÃ¡vel durante a migraÃ§Ã£o; depois Ã© excluÃ­do.
- Risco residual aceito: entre o deploy e a migraÃ§Ã£o, um cliente autenticado que
  conheÃ§a a URL secreta poderia ler/apagar `main`. Mitigado por (a) backup
  prÃ©-deploy, (b) o dono migrar logo apÃ³s o deploy, (c) amigos nunca receberem a
  URL secreta.

### 4. Backup prÃ©-deploy (rede de seguranÃ§a)

- Gerar um arquivo JSON com o conteÃºdo atual de `tracker/main` (2 registros de hoje,
  10/08/2026) lendo o Firestore via SDK web com login anÃ´nimo (ainda permitido atÃ©
  o deploy das regras).
- Salvar em:
  - `save/sunflower-backup-2026-08-10.json` (no projeto);
  - cÃ³pia no Desktop do usuÃ¡rio para fÃ¡cil acesso.

### 5. MigraÃ§Ã£o automÃ¡tica via link secreto (aÃ§Ã£o mÃ­nima do dono)

- O dono cria a conta (email+senha) apÃ³s o deploy e abre **uma Ãºnica vez** a URL
  `https://sunflower-calculadora.web.app/?migrar=<segredo>`.
- No `init()`, antes de carregar os dados, o app verifica o parÃ¢metro `migrar`:
  - se o documento pessoal do dono ainda nÃ£o tem registros e `tracker/main` existe,
    copia `main` â†’ documento pessoal e exclui `main`;
  - remove o parÃ¢metro da URL (`history.replaceState`);
  - em caso de erro, mostra toast e segue (backup cobre).
- SÃ³ o dono recebe o segredo.

## Fora de escopo

- Sem verificaÃ§Ã£o de email (YAGNI).
- Sem integraÃ§Ã£o com outras redes sociais alÃ©m do Google (YAGNI).
- Sem alterar preÃ§os pÃºblicos (CoinGecko/SFL) nem o visual geral do site.
- Limpeza do documento Ã³rfÃ£o `main` Ã© feita pela prÃ³pria migraÃ§Ã£o (delete).

## Testes e verificaÃ§Ã£o

- Suite e2e existente (`npm test`, Playwright) usa `window.__test_skip_firestore`.
  Com a tela de login, os testes precisam de bypass: adicionar
  `window.__test_skip_auth = true` no `beforeEach` para renderizar a planilha sem
  login (mesmo padrÃ£o do flag atual).
- Teste manual: criar conta â†’ abrir URL com `?migrar=<segredo>` â†’ confirmar que
  `main` foi copiado para o documento pessoal, que `main` foi excluÃ­do e que o
  parÃ¢metro saiu da URL.
- ApÃ³s o deploy das regras: conferir no console do Firebase que as regras foram
  publicadas e que um documento de outro UID nÃ£o Ã© legÃ­vel.
- VerificaÃ§Ã£o funcional pelo dono: abrir a URL secreta uma vez e confirmar que os
  2 registros aparecem na planilha. Fazer logout/login e confirmar persistÃªncia.

## Deploy

- `firebase deploy` (hosting + firestore rules) no projeto `sunflower-calculadora`.
- PrÃ©-requisito: habilitar Email/Senha no console antes do deploy.
