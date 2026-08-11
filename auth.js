(function () {
  const authScreen = document.getElementById('authScreen');
  const container = document.querySelector('.container');
  const btnSair = document.getElementById('btnSair');
  const tabLogin = document.getElementById('tabLogin');
  const tabCriar = document.getElementById('tabCriar');
  const loginPane = document.getElementById('loginPane');
  const createPane = document.getElementById('createPane');
  const btnGoogle = document.getElementById('btnGoogle');
  const btnGoogleCreate = document.getElementById('btnGoogleCreate');
  const btnEsqueci = document.getElementById('btnEsqueci');
  const formLogin = document.getElementById('loginForm');
  const formCreate = document.getElementById('createForm');
  const authError = document.getElementById('authError');
  const createError = document.getElementById('createError');

  function mostrarErro(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
  }

  function limparErro(el) {
    if (!el) return;
    el.textContent = '';
    el.style.display = 'none';
  }

  function traduzirErro(code) {
    const map = {
      'auth/invalid-email': 'Email inválido.',
      'auth/user-not-found': 'Email ou senha incorretos.',
      'auth/wrong-password': 'Email ou senha incorretos.',
      'auth/invalid-credential': 'Email ou senha incorretos.',
      'auth/email-already-in-use': 'Este email já está cadastrado.',
      'auth/weak-password': 'Senha muito fraca (mínimo 6 caracteres).',
      'auth/popup-closed-by-user': 'Login com Google cancelado.',
      'auth/cancelled-popup-request': 'Login com Google cancelado.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
      'auth/network-request-failed': 'Falha de rede. Verifique sua internet.',
    };
    return map[code] || 'Erro: ' + code;
  }

  function mostrarOuEsconderTela(logado) {
    if (authScreen) authScreen.style.display = logado ? 'none' : 'flex';
    if (container) container.style.display = logado ? 'block' : 'none';
    if (btnSair) btnSair.style.display = logado ? '' : 'none';
  }

  function irPara(pane) {
    const login = pane === 'login';
    if (tabLogin) tabLogin.classList.toggle('active', login);
    if (tabCriar) tabCriar.classList.toggle('active', !login);
    if (loginPane) loginPane.style.display = login ? 'block' : 'none';
    if (createPane) createPane.style.display = login ? 'none' : 'block';
    limparErro(authError);
    limparErro(createError);
  }

  window.setupAuthFlow = function (onReady) {
    firebase.auth().onAuthStateChanged(user => {
      mostrarOuEsconderTela(!!user);
      if (user && typeof onReady === 'function') onReady();
    });
  };

  if (tabLogin) tabLogin.addEventListener('click', () => irPara('login'));
  if (tabCriar) tabCriar.addEventListener('click', () => irPara('criar'));

  if (btnEsqueci) btnEsqueci.addEventListener('click', () => {
    const email = (document.getElementById('authEmail') || {}).value;
    if (!email || !email.trim()) {
      mostrarErro(authError, 'Informe seu email no campo acima para recuperar a senha.');
      return;
    }
    firebase.auth().sendPasswordResetEmail(email.trim())
      .then(() => mostrarErro(authError, 'Email de redefinição enviado!'))
      .catch(err => mostrarErro(authError, traduzirErro(err.code)));
  });

  function entrarComGoogle() {
    limparErro(authError);
    limparErro(createError);
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).catch(err => {
      const el = createPane && createPane.style.display === 'block' ? createError : authError;
      mostrarErro(el, traduzirErro(err.code));
    });
  }

  if (btnGoogle) btnGoogle.addEventListener('click', entrarComGoogle);
  if (btnGoogleCreate) btnGoogleCreate.addEventListener('click', entrarComGoogle);

  if (formLogin) formLogin.addEventListener('submit', e => {
    e.preventDefault();
    limparErro(authError);
    const email = document.getElementById('authEmail').value.trim();
    const senha = document.getElementById('authPassword').value;
    if (!email || !senha) {
      mostrarErro(authError, 'Preencha email e senha.');
      return;
    }
    firebase.auth().signInWithEmailAndPassword(email, senha)
      .catch(err => mostrarErro(authError, traduzirErro(err.code)));
  });

  if (formCreate) formCreate.addEventListener('submit', e => {
    e.preventDefault();
    limparErro(createError);
    const email = document.getElementById('newEmail').value.trim();
    const senha = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    if (!email || !senha || !confirm) {
      mostrarErro(createError, 'Preencha todos os campos.');
      return;
    }
    if (senha.length < 6) {
      mostrarErro(createError, 'Senha muito fraca (mínimo 6 caracteres).');
      return;
    }
    if (senha !== confirm) {
      mostrarErro(createError, 'As senhas não conferem.');
      return;
    }
    firebase.auth().createUserWithEmailAndPassword(email, senha)
      .catch(err => mostrarErro(createError, traduzirErro(err.code)));
  });

  if (btnSair) btnSair.addEventListener('click', () => {
    firebase.auth().signOut().catch(() => {});
  });

  irPara('criar');
})();
