const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AIzaSyCmMhetbyG1ozSsFMNYC9Q_EBADLPskTdg';
const PROJECT_ID = 'sunflower-calculadora';
const BACKUP_PATH = path.join(__dirname, 'save', 'sunflower-backup-2026-06-03.json');

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        if (res.statusCode >= 400) reject(new Error(parsed.error?.message || JSON.stringify(parsed)));
        else resolve(parsed);
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('Lendo backup...');
  const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));

  console.log('Autenticando anonimamente...');
  const auth = await request(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
    { returnSecureToken: true }
  );
  const idToken = auth.idToken;
  console.log('Autenticado!');

  const docPayload = {
    fields: {
      dados: {
        arrayValue: {
          values: backup.dados.map(d => ({
            mapValue: {
              fields: {
                data: { stringValue: d.data },
                gold: { doubleValue: d.gold },
                diamante: { doubleValue: d.diamante },
                flower: { doubleValue: d.flower },
                saque: { doubleValue: d.saque },
                obs: { stringValue: d.obs || '' }
              }
            }
          }))
        }
      },
      taxas: {
        mapValue: {
          fields: Object.entries(backup.taxas).reduce((acc, [k, v]) => {
            acc[k] = typeof v === 'number' ? { doubleValue: v } : { stringValue: String(v) };
            return acc;
          }, {})
        }
      },
      version: { integerValue: String(Date.now()) },
      updatedAt: { timestampValue: new Date().toISOString() }
    }
  };

  console.log('Enviando dados para Firestore...');
  const result = await request(
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/tracker/main?updateMask.fieldPaths=dados&updateMask.fieldPaths=taxas&updateMask.fieldPaths=version&updateMask.fieldPaths=updatedAt`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      }
    },
    docPayload
  );

  console.log('Sucesso! Documento atualizado.');
  console.log(`  ${backup.dados.length} registros restaurados.`);
}

main().catch(err => {
  console.error('Erro:', err.message);
  process.exit(1);
});
