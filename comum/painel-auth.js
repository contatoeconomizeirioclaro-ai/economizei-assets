/* ==============================================================
   ECONOMIZEI! RIO CLARO — PAINEL AUTH
   ============================================================== */
(function (global) {
  'use strict';

  var EU  = global.EconomizeiUtils;
  var FB  = global.EconomizeiFirebase;
  var Loj = global.Economizei && global.Economizei.Lojista;

  if (!EU) { console.error('[Painel.Auth] EconomizeiUtils não carregado.'); return; }
  if (!FB) { console.error('[Painel.Auth] EconomizeiFirebase não carregado.'); return; }
  if (!Loj) { console.error('[Painel.Auth] Economizei.Lojista não carregado.'); return; }

  var HUB_URL = 'https://www.economizeirioclaro.com.br/p/painel-do-empreendedor.html';
  var COL_ADMINS = 'admins';
  var COL_LOJISTAS = 'lojistas';
  var TEMPO_TOLERANCIA_ANONIMO = 3000;

  var state = {
    tipo: 'lojista',
    modoLogin: 'pagina',
    contexto: null,
    prefixosEsperados: null,
    redirecionarAnonimo: true,
    aoEntrar: null,
    aoEstadoInvalido: null,
    aoSair: null,
    dadosAtuais: null,
    usuarioAtual: null,
    iniciado: false,
    timeoutAnonimo: null,
    jaEntrou: false
  };

  function log() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Painel.Auth]');
    console.log.apply(console, args);
  }

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

  function mostrarAreaPagina(area) {
    var elLogin = $id('areaLogin');
    var elPainel = $id('areaPainel') || $id('areaAdmin');
    if (elLogin)  elLogin.style.display  = (area === 'login')  ? 'flex'  : 'none';
    if (elPainel) elPainel.style.display = (area === 'painel') ? 'block' : 'none';
  }

  function abrirModalLogin() { var el = $id('modalLogin'); if (el) el.classList.add('active'); }
  function fecharModalLogin() { var el = $id('modalLogin'); if (el) el.classList.remove('active'); }
  function abrirModalPerfil() { var el = $id('modalPerfil'); if (el) el.classList.add('active'); }
  function fecharModalPerfil() { var el = $id('modalPerfil'); if (el) el.classList.remove('active'); }
  function atualizarBotaoLoginHub(user) {
    var btn = $id('loginButton');
    var txt = $id('loginText');
    if (btn) btn.setAttribute('aria-label', user ? 'Abrir perfil' : 'Abrir login');
    if (txt) txt.textContent = user ? 'Perfil' : 'Entrar';
  }

  function tratarEstadoInvalido(motivo, mensagem) {
    log('Estado inválido:', motivo, '|', mensagem);
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

if (motivo !== 'em-analise' && motivo !== 'vencendo' && motivo !== 'modulo-errado' && motivo !== 'erro') {      log('Chamando signOut() por causa do motivo:', motivo);
      setTimeout(function () { FB.auth.signOut(); }, 200);
    }
  }

  function tratarLojista(user) {
    var email = user.email;
    log('tratarLojista — email:', email);

    carregarDocLojista(email).then(function (dados) {
      log('Doc carregado:', dados ? 'sim' : 'NÃO');
      if (!dados) {
        tratarEstadoInvalido('sem-cadastro',
          'Cadastro não encontrado. Fale com a gente pelo WhatsApp para contratar.');
        return;
      }

      var estado = Loj.estadoDoLojista(dados);
      log('Estado do lojista:', estado, '| estabelecimentoId:', dados.estabelecimentoId);

      if (estado === 'pendente' || !dados.estabelecimentoId) {
        tratarEstadoInvalido('em-analise', 'Seu cadastro está em análise. Em breve você terá acesso.');
        return;
      }
      if (estado === 'bloqueado') {
        tratarEstadoInvalido('bloqueado', 'Seu acesso está suspenso. Fale com a gente pelo WhatsApp.');
        return;
      }
      if (estado === 'vencido') {
        tratarEstadoInvalido('vencido', 'Sua assinatura venceu. Fale com a gente pelo WhatsApp para renovar.');
        return;
      }

      if (state.prefixosEsperados && dados.estabelecimentoId) {
        var bate = EU.pertencePrefixo(dados.estabelecimentoId, state.prefixosEsperados);
        log('Prefixo bate?', bate, '| esperados:', state.prefixosEsperados.join(','), '| id:', dados.estabelecimentoId);
        if (!bate) {
          var mod = Loj.moduloDoId(dados.estabelecimentoId);
          tratarEstadoInvalido('modulo-errado',
            'Você não tem acesso a este módulo. Seu módulo é ' + (Loj.rotuloModulo(mod) || 'desconhecido') + '.');
          return;
        }
      }

      state.dadosAtuais = dados;
      state.usuarioAtual = user;
      state.jaEntrou = true;

      if (state.modoLogin === 'pagina') {
        mostrarAreaPagina('painel');
      } else {
        fecharModalLogin();
        abrirModalPerfil();
        atualizarBotaoLoginHub(user);
      }

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

  function tratarAdmin(user) {
    verificarAdmin(user.email).then(function (isAdmin) {
      log('É admin?', isAdmin);
      if (!isAdmin) {
        mostrarAreaPagina('login');
        EU.mostrarToast('Acesso restrito ao administrador.', 'erro');
        setTimeout(function () { FB.auth.signOut(); }, 200);
        return;
      }
      state.usuarioAtual = user;
      state.jaEntrou = true;
      mostrarAreaPagina('painel');
      atualizarBotaoLoginHub(user);
      if (typeof state.aoEntrar === 'function') {
        Promise.resolve(state.aoEntrar(user)).catch(function (e) {
          console.error('[Painel.Auth] aoEntrar (admin):', e);
        });
      }
    });
  }

  function tratarHub(user) {
    state.usuarioAtual = user;
    if (!user) {
      log('Hub — anônimo');
      atualizarBotaoLoginHub(null);
      if (typeof state.aoEntrar === 'function') {
        Promise.resolve(state.aoEntrar(null, null)).catch(function () {});
      }
      return;
    }
    log('Hub — logado:', user.email);
    carregarDocLojista(user.email).then(function (dados) {
      var estado = dados ? Loj.estadoDoLojista(dados) : 'sem-cadastro';
      state.dadosAtuais = dados;
      atualizarBotaoLoginHub(user);
      if (typeof state.aoEntrar === 'function') {
        Promise.resolve(state.aoEntrar(user, dados, estado)).catch(function () {});
      }
    });
  }

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

  function sair() {
    if (typeof state.aoSair === 'function') { try { state.aoSair(); } catch (e) {} }
    state.dadosAtuais = null;
    state.usuarioAtual = null;
    state.jaEntrou = false;
    FB.auth.signOut();
  }

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

  function redirecionarParaHub() {
    var redir = encodeURIComponent(window.location.href);
    log('Redirecionando pro Hub (motivo: anônimo confirmado).');
    window.location.replace(HUB_URL + '?redir=' + redir);
  }

  function processarUsuario(user) {
    log('onAuthStateChanged — user:', user ? user.email : 'null');

    if (state.timeoutAnonimo) {
      clearTimeout(state.timeoutAnonimo);
      state.timeoutAnonimo = null;
    }

    if (!user && state.modoLogin === 'pagina' && state.redirecionarAnonimo) {
      if (!state.timeoutAnonimo) {
        log('User null — aguardando ' + TEMPO_TOLERANCIA_ANONIMO + 'ms antes de redirecionar pro Hub.');
        state.timeoutAnonimo = setTimeout(function () {
          state.timeoutAnonimo = null;
          if (FB.auth.currentUser) {
            log('Sessão restaurou nesse meio tempo, cancelando redirect.');
            return;
          }
          redirecionarParaHub();
        }, TEMPO_TOLERANCIA_ANONIMO);
      }
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

    log('Iniciando — tipo:', state.tipo, '| contexto:', state.contexto, '| prefixos:', state.prefixosEsperados);

    if (!FB.auth) { console.error('[Painel.Auth] FB.auth indisponível'); return; }

    if (typeof FB.auth.getRedirectResult === 'function') {
      FB.auth.getRedirectResult().catch(function () {});
    }

    FB.auth.onAuthStateChanged(function (user) {
      processarUsuario(user);
    });

    wireLoginUI();
  }

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
    usuarioAtual: function () { return state.usuarioAtual; },
    jaEntrou: function () { return state.jaEntrou; }
  };
})(window);
