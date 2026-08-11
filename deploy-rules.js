const { GoogleAuth } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'sunflower-calculadora';
const RULES_FILE = path.resolve(__dirname, 'firestore.rules');

async function deployRules() {
  let keyFile;
  const possibleKeys = [
    path.resolve(__dirname, 'service-account.json'),
    ...fs.readdirSync(__dirname).filter(f => f.startsWith('service-account') && f.endsWith('.json')).map(f => path.resolve(__dirname, f)),
  ];

  for (const k of possibleKeys) {
    if (fs.existsSync(k)) { keyFile = k; break; }
  }

  if (!keyFile) {
    console.error('Arquivo service-account.json não encontrado.');
    console.error('');
    console.error('Para gerar:');
    console.error('  1. Acesse https://console.firebase.google.com/project/sunflower-calculadora/settings/serviceaccounts');
    console.error('  2. Clique em "Gerar nova chave privada"');
    console.error('  3. Salve o arquivo como service-account.json na raiz do projeto');
    process.exit(1);
  }

  const rulesContent = fs.readFileSync(RULES_FILE, 'utf8').trim();
  if (!rulesContent) {
    console.error('firestore.rules está vazio');
    process.exit(1);
  }

  const auth = new GoogleAuth({
    keyFile,
    scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/firebase'],
  });

  const client = await auth.getClient();
  const accessToken = await client.getAccessToken();
  const token = accessToken.token;

  const RULES_API = 'https://firebaserules.googleapis.com/v1';
  const RELEASE_NAME = `projects/${PROJECT_ID}/releases/cloud.firestore`;

  // 1. Create a new ruleset
  console.log('Criando novo ruleset...');
  const rulesetRes = await fetch(`${RULES_API}/projects/${PROJECT_ID}/rulesets`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: {
        files: [{
          name: 'firestore.rules',
          content: rulesContent,
        }],
      },
    }),
  });

  if (!rulesetRes.ok) {
    const err = await rulesetRes.text();
    throw new Error(`Erro ao criar ruleset: ${rulesetRes.status} ${err}`);
  }

  const ruleset = await rulesetRes.json();
  const rulesetName = ruleset.name;
  console.log(`Ruleset criado: ${rulesetName}`);

  // 2. Release the ruleset
  console.log('Liberando ruleset para cloud.firestore...');
  const releaseRes = await fetch(`${RULES_API}/${RELEASE_NAME}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: RELEASE_NAME,
      rulesetName: rulesetName,
    }),
  });

  if (!releaseRes.ok) {
    const err = await releaseRes.text();
    throw new Error(`Erro ao liberar ruleset: ${releaseRes.status} ${err}`);
  }

  console.log('Regras de segurança do Firestore atualizadas com sucesso!');
}

deployRules().catch(err => {
  console.error(err.message);
  process.exit(1);
});
