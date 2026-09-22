/* ==============================================================
   ECONOMIZEI! RIO CLARO — PAINEL AUTH
   Unifica o fluxo de entrada dos painéis do empreendedor.

   Suporta 3 contextos:
     - Módulos (Pedidos/Loja/Transporte): login em página inteira
     - Hub (painel-do-empreendedor.html): login em modal + vitrine
     - Admin (admin.html): login em página inteira, só admin

   Estados possíveis do lojista:
     anonimo      → não logado
     sem-cadastro → logado, mas sem doc em lojistas/{email}
     em-analise   → doc existe, mas sem estabelecimentoId
     vencendo     → faltam ≤ 10 dias
     vencido      → dataVencimento passou
     bloqueado    → bloqueadoManualmente === true
     ativo        → tudo certo

   Depende de:
     - comum/firebase.js     (EconomizeiFirebase)
     - comum/utils.js        (EconomizeiUtils)
     - comum/lojista.js      (Economizei.Lojista)
     - comum/painel-shell.js (Economizei.Painel.Shell — opcional)

   Expõe:
     window.Economizei.Painel.Auth
   ============================================================== */
(function (global) {
  'use strict';

  var EU  = global.EconomizeiUtils;
  var FB  = global.EconomizeiFirebase;
  var Loj = global.Economizei && global.Economizei.Lojista;

  if (!EU) { console.error('[Painel.Auth] EconomizeiUtils não carregado.'); return; }
  if (!FB) { console.error('[Painel.Auth] EconomizeiFirebase não carregado.'); return; }
  if (!Loj) { console.error('[Painel.Auth] Economizei.Lojista não carregado.'); return; }

  // ==================================================================
  // CONFIGURAÇÃO
  // ==================================================================
  var HUB_URL = 'https://www.economizeirioclaro.com.br/p/painel-do-empreendedor.html';
  var COL_ADMINS = 'admins';
  var COL_LOJISTAS = 'lojistas';

  // ==================================================================
  // ESTADO
  // ==================================================================
  var state = {
    tipo: 'lojista',          // 'lojista' | 'admin'
    modoLogin: 'pagina',      // 'pagina' | 'modal'
    contexto: null,           // 'pedidos' | 'loja' | 'transporte' | 'hub' | 'admin'
    prefixosEsperados: null,  // array — só em módulos
    redirecionarAnonimo: true,// só em módulos
    aoEntrar: null,           // callback(user, dados)
    aoEstadoInvalido: null,   // callback(motivo, mensagem)
    aoSair: null,             // callback()
    dadosAtuais: null,
    usuarioAtual: null,
    iniciado: false
  };

  // ==================================================================
  // HELPERS
  // ==================================================================
  function $id(id) { return document.getElementById(id); }

  function traduzirErroAuth(code) {
    var mapa = {
      'auth/user-not-found': 'Usuário não encontrado.',
      'auth/wrong-password': 'Senha incorreta.',
      'auth/invalid-credential': 'E-mail ou senha incorretos.',
      'auth/invalid-email': 'E-mail inválido.',
      'auth/email-already-in-use': 'Este e-mail já está em uso.',
      'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
      'auth/too-many-requests': 'Muitas tentativas. Tente novamente em instantes.',
      'auth/network-request-failed': 'Falha de rede. Tente novamente.',
      'auth/popup-closed-by-user': null,
      'auth/cancelled-popup-request': null,
      'auth/user-cancelled': null,
      'auth/popup-blocked': 'O pop-up foi bloqueado. Permita pop-ups para este site.'
    };
    if (code in mapa) return mapa[code];
    return 'Erro ao entrar. Tente novamente.';
  }

  function carregarDocLojista(email) {
    return FB.db.collection(COL_LOJISTAS).doc(email).get().then(function (doc) {
      if (!doc.exists) return null;
      return Object.assign({ id: doc.id }, doc.data());
    });
  }

  function verificarAdmin(email) {
    return FB.db.collection(COL_ADMINS).doc(email).get()
      .then(function (doc) { return doc.exists; })
      .catch(function () { return false; });
  }

  // ==================================================================
  // UI — mostra a área certa
  // ==================================================================
  function mostrarAreaPagina(area) {
    var elLogin = $id('areaLogin');
    var elPainel = $id('areaPainel') || $id('areaAdmin');
    if (elLogin)  elLogin.style.display  = (area === 'login')  ? 'flex'  : 'none';
    if (elPainel) elPainel.style.display = (area === 'painel') ? 'block' : 'none';
  }

  function abrirModalLogin() {
    var el = $id('modalLogin');
    if (el) el.classList.add('active');
  }

  function fecharModalLogin() {
    var el = $id('modalLogin');
    if (el) el.classList.remove('active');
  }

  function abrirModalPerfil() {
    var el = $id('modalPerfil');
    if (el) el.classList.add('active');
  }

  function fecharModalPerfil() {
    var el = $id('modalPerfil');
    if (el) el.classList.remove('active');
  }

  function atualizarBotaoLoginHub(user) {
    var btn = $id('loginButton');
    var txt = $id('loginText');
    if (btn) btn.setAttribute('aria-label', user ? 'Abrir perfil' : 'Abrir login');
    if (txt) txt.textContent = user ? 'Perfil' : 'Entrar';
  }

  // ==================================================================
  // ESTADOS INVÁLIDOS — reação unificada
  // ==================================================================
  function tratarEstadoInvalido(motivo, mensagem) {
    if (typeof state.aoEstadoInvalido === 'function') {
      try { state.aoEstadoInvalido(motivo, mensagem); } catch (e) {}
    }
    if (mensagem) EU.mostrarToast(mensagem, 'erro');

    if (state.modoLogin === 'pagina') {
      mostrarAreaPagina('login');
    } else {
      fecharModalLogin();
      fecharModalPerfil();
    }

    // Desloga nos casos em que a conta não tem acesso
    if (motivo !== 'em-analise' && motivo !== 'vencendo') {
      setTimeout(function () { FB.auth.signOut(); }, 200);
    }
  }

  // ==================================================================
  // FLUXO — LOJISTA
  // ==================================================================
  function tratarLojista(user) {
    var email = user.email;

    carregarDocLojista(email).then(function (dados) {
      if (!dados) {
        tratarEstadoInvalido('sem-cadastro',
          'Cadastro não encontrado. Fale com a gente pelo WhatsApp para contratar.');
        return;
      }

      var estado = Loj.estadoDoLojista(dados);

      if (estado === 'pendente' || !dados.estabelecimentoId) {
        tratarEstadoInvalido('em-analise',
          'Seu cadastro está em análise. Em breve você terá acesso.');
        return;
      }
      if (estado === 'bloqueado') {
        tratarEstadoInvalido('bloqueado',
          'Seu acesso está suspenso. Fale com a gente pelo WhatsApp.');
        return;
      }
      if (estado === 'vencido') {
        tratarEstadoInvalido('vencido',
          'Sua assinatura venceu. Fale com a gente pelo WhatsApp para renovar.');
        return;
      }

      // Checa se o módulo desta página bate com o estabelecimentoId
      if (state.prefixosEsperados && dados.estabelecimentoId) {
        if (!EU.pertencePrefixo(dados.estabelecimentoId, state.prefixosEsperados)) {
          var mod = Loj.moduloDoId(dados.estabelecimentoId);
          tratarEstadoInvalido('modulo-errado',
            'Você não tem acesso a este módulo. Seu módulo é ' +
            (Loj.rotuloModulo(mod) || 'desconhecido') + '.');
          return;
        }
      }

      // OK — entra
      state.dadosAtuais = dados;
      state.usuarioAtual = user;

      if (state.modoLogin === 'pagina') {
        mostrarAreaPagina('painel');
      } else {
        fecharModalLogin();
        abrirModalPerfil();
        atualizarBotaoLoginHub(user);
      }

      // Shell — só em módulos
      var Shell = global.Economizei && global.Economizei.Painel && global.Economizei.Painel.Shell;
      if (state.modoLogin === 'pagina' && Shell) {
        Shell.iniciar({
          dados: dados,
          email: email,
          contexto: state.contexto,
          chaveConfig: 'painel_config_' + state.contexto
        });
      }

      if (typeof state.aoEntrar === 'function') {
        Promise.resolve(state.aoEntrar(user, dados)).catch(function (e) {
          console.error('[Painel.Auth] aoEntrar:', e);
        });
      }
    }).catch(function (e) {
      console.error('[Painel.Auth] Erro ao carregar lojista:', e);
      tratarEstadoInvalido('erro', 'Erro ao carregar seus dados. Tente novamente.');
    });
  }

  // ==================================================================
  // FLUXO — ADMIN
  // ==================================================================
  function tratarAdmin(user) {
    verificarAdmin(user.email).then(function (isAdmin) {
      if (!isAdmin) {
        mostrarAreaPagina('login');
        EU.mostrarToast('Acesso restrito ao administrador.', 'erro');
        setTimeout(function () { FB.auth.signOut(); }, 200);
        return;
      }

      state.usuarioAtual = user;
      mostrarAreaPagina('painel');
      atualizarBotaoLoginHub(user);

      if (typeof state.aoEntrar === 'function') {
        Promise.resolve(state.aoEntrar(user)).catch(function (e) {
          console.error('[Painel.Auth] aoEntrar (admin):', e);
        });
      }
    });
  }

  // ==================================================================
  // FLUXO — HUB
  // ==================================================================
  function tratarHub(user) {
    state.usuarioAtual = user;

    if (!user) {
      // Anônimo: Hub mostra vitrine
      atualizarBotaoLoginHub(null);
      if (typeof state.aoEntrar === 'function') {
        Promise.resolve(state.aoEntrar(null, null)).catch(function () {});
      }
      return;
    }

    // Logado: carrega doc e decide
    carregarDocLojista(user.email).then(function (dados) {
      var estado = dados ? Loj.estadoDoLojista(dados) : 'sem-cadastro';

      state.dadosAtuais = dados;
      atualizarBotaoLoginHub(user);

      if (typeof state.aoEntrar === 'function') {
        Promise.resolve(state.aoEntrar(user, dados, estado)).catch(function () {});
      }
    });
  }

  // ==================================================================
  // LOGIN
  // ==================================================================
  function loginGoogle() {
    EU.showLoading('Autenticando...');
    FB.auth.signInWithPopup(FB.provider)
      .then(function () { fecharModalLogin(); })
      .catch(function (e) {
        var msg = traduzirErroAuth(e.code);
        if (msg) EU.mostrarToast(msg, 'erro');
      })
      .finally(function () { EU.hideLoading(); });
  }

  function loginEmail() {
    var emailEl = $id('emailLogin');
    var senhaEl = $id('senhaLogin');
    if (!emailEl || !senhaEl) return;

    var email = emailEl.value.trim();
    var senha = senhaEl.value;

    if (!email || !senha) { EU.mostrarToast('Preencha e-mail e senha.', 'erro'); return; }
    if (!EU.validarEmail(email)) { EU.mostrarToast('E-mail inválido.', 'erro'); return; }

    EU.showLoading('Autenticando...');
    FB.auth.signInWithEmailAndPassword(email, senha)
      .then(function () { fecharModalLogin(); })
      .catch(function (e) {
        var msg = traduzirErroAuth(e.code);
        if (msg) EU.mostrarToast(msg, 'erro');
      })
      .finally(function () { EU.hideLoading(); });
  }

  function recuperarSenha() {
    var emailEl = $id('emailLogin');
    if (!emailEl) return;
    var email = emailEl.value.trim();
    if (!email || !EU.validarEmail(email)) {
      EU.mostrarToast('Digite um e-mail válido.', 'erro');
      return;
    }
    EU.showLoading('Enviando...');
    FB.auth.sendPasswordResetEmail(email)
      .then(function () { EU.mostrarToast('E-mail de recuperação enviado!', 'sucesso'); })
      .catch(function (e) {
        var msg = traduzirErroAuth(e.code);
        if (msg) EU.mostrarToast(msg, 'erro');
      })
      .finally(function () { EU.hideLoading(); });
  }

  // ==================================================================
  // SAIR
  // ==================================================================
  function sair() {
    if (typeof state.aoSair === 'function') { try { state.aoSair(); } catch (e) {} }
    state.dadosAtuais = null;
    state.usuarioAtual = null;
    FB.auth.signOut();
  }

  // ==================================================================
  // WIRING DOS BOTÕES DE LOGIN
  // ==================================================================
  function wireLoginUI() {
    var btnGoogle = $id('btnLoginGoogle') || $id('btnGoogleLogin');
    if (btnGoogle && !btnGoogle.__authWired) {
      btnGoogle.__authWired = true;
      btnGoogle.addEventListener('click', loginGoogle);
    }
    var btnEmail = $id('btnLoginEmail');
    if (btnEmail && !btnEmail.__authWired) {
      btnEmail.__authWired = true;
      btnEmail.addEventListener('click', loginEmail);
    }
    var btnEsqueci = $id('esqueciSenhaLink') || $id('linkRecuperarSenha');
    if (btnEsqueci && !btnEsqueci.__authWired) {
      btnEsqueci.__authWired = true;
      btnEsqueci.addEventListener('click', recuperarSenha);
    }
  }

  // ==================================================================
  // PROCESSAR USUÁRIO
  // ==================================================================
  function processarUsuario(user) {
    // Módulo: se anônimo e deve redirecionar, manda pro Hub
    if (!user && state.modoLogin === 'pagina' && state.redirecionarAnonimo) {
      var redir = encodeURIComponent(window.location.href);
      window.location.replace(HUB_URL + '?redir=' + redir);
      return;
    }

    if (state.tipo === 'admin') {
      if (!user) { mostrarAreaPagina('login'); wireLoginUI(); return; }
      tratarAdmin(user);
      return;
    }

    if (state.contexto === 'hub') { tratarHub(user); return; }

    if (!user) { mostrarAreaPagina('login'); wireLoginUI(); return; }
    tratarLojista(user);
  }

  // ==================================================================
  // INICIAR
  // ==================================================================
  function iniciar(opcoes) {
    if (state.iniciado) { console.warn('[Painel.Auth] iniciar() chamado 2x'); return; }
    opcoes = opcoes || {};

    state.tipo = opcoes.tipo || 'lojista';
    state.modoLogin = opcoes.modoLogin || (opcoes.contexto === 'hub' ? 'modal' : 'pagina');
    state.contexto = opcoes.contexto || null;
    state.prefixosEsperados = opcoes.prefixosEsperados || null;
    state.redirecionarAnonimo = opcoes.redirecionarAnonimo !== false;
    state.aoEntrar = opcoes.aoEntrar || null;
    state.aoEstadoInvalido = opcoes.aoEstadoInvalido || null;
    state.aoSair = opcoes.aoSair || null;
    state.iniciado = true;

    if (!FB.auth) { console.error('[Painel.Auth] FB.auth indisponível'); return; }

    if (typeof FB.auth.getRedirectResult === 'function') {
      FB.auth.getRedirectResult().catch(function () {});
    }

    FB.auth.onAuthStateChanged(function (user) {
      processarUsuario(user);
    });

    wireLoginUI();
  }

  // ==================================================================
  // EXPOSIÇÃO
  // ==================================================================
  global.Economizei = global.Economizei || {};
  global.Economizei.Painel = global.Economizei.Painel || {};
  global.Economizei.Painel.Auth = {
    iniciar: iniciar,
    sair: sair,
    loginGoogle: loginGoogle,
    loginEmail: loginEmail,
    recuperarSenha: recuperarSenha,
    abrirModalLogin: abrirModalLogin,
    fecharModalLogin: fecharModalLogin,
    abrirModalPerfil: abrirModalPerfil,
    fecharModalPerfil: fecharModalPerfil,
    dadosAtuais: function () { return state.dadosAtuais; },
    usuarioAtual: function () { return state.usuarioAtual; }
  };
})(window);
