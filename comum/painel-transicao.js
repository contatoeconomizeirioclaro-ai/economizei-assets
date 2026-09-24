/* ==============================================================
   ECONOMIZEI! RIO CLARO — TRANSIÇÃO ENTRE PAINEL E MÓDULOS
   Overlay de carregamento com logo + preservação de estado entre
   Hub e módulos (scroll, aba ativa, modal aberto).

   Expõe: window.EconomizeiPainel.Transicao
   Depende de: EconomizeiUtils (comum/utils.js)
   ============================================================== */
(function (global) {
  'use strict';

  var EU = global.EconomizeiUtils;
  if (!EU) { console.error('[Transicao] EconomizeiUtils não carregado.'); return; }

  var CHAVE_ESTADO = 'economizei_transicao_estado';
  var TTL_ESTADO = 5000;

  var estadoOverlay = null;

  function garantirOverlay() {
    if (estadoOverlay) return estadoOverlay;
    var el = document.createElement('div');
    el.className = 'transicao-overlay';
    el.setAttribute('role', 'alert');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML =
      '<div class="transicao-card">' +
        '<div class="transicao-logo" id="transicaoLogo">' +
          '<i class="fas fa-store" aria-hidden="true"></i>' +
        '</div>' +
        '<div class="transicao-nome" id="transicaoNome">Carregando...</div>' +
        '<div class="transicao-spinner" aria-hidden="true"></div>' +
        '<div class="transicao-texto" id="transicaoTexto">Aguarde um instante</div>' +
      '</div>';
    document.body.appendChild(el);
    estadoOverlay = {
      el: el,
      logo: el.querySelector('#transicaoLogo'),
      nome: el.querySelector('#transicaoNome'),
      texto: el.querySelector('#transicaoTexto')
    };
    return estadoOverlay;
  }

  // ---------- OVERLAY ----------
  function mostrarOverlay(opcoes) {
    opcoes = opcoes || {};
    var ov = garantirOverlay();
    if (opcoes.logo) {
      ov.logo.innerHTML = '<img src="' + EU.sanitize(opcoes.logo) + '" alt="" onerror="this.parentNode.innerHTML=\'<i class=&quot;fas fa-store&quot;></i>\'">';
    }
    ov.nome.textContent = opcoes.nome || 'Carregando...';
    ov.texto.textContent = opcoes.texto || 'Aguarde um instante';
    ov.el.classList.add('ativo');
  }

  function esconderOverlay() {
    if (!estadoOverlay) return;
    estadoOverlay.el.classList.remove('ativo');
  }

  // ---------- ESTADO ----------
  function salvarEstado(extra) {
    try {
      var dados = Object.assign({
        pagina: (document.body && document.body.dataset.painel) || detectarPagina(),
        scrollY: window.scrollY || window.pageYOffset || 0,
        timestamp: Date.now()
      }, extra || {});
      sessionStorage.setItem(CHAVE_ESTADO, JSON.stringify(dados));
    } catch (e) { /* sessionStorage bloqueado */ }
  }

  function lerEstado() {
    try {
      var bruto = sessionStorage.getItem(CHAVE_ESTADO);
      if (!bruto) return null;
      var dados = JSON.parse(bruto);
      if (!dados || !dados.timestamp) return null;
      if (Date.now() - dados.timestamp > TTL_ESTADO) return null;
      return dados;
    } catch (e) { return null; }
  }

  function limparEstado() {
    try { sessionStorage.removeItem(CHAVE_ESTADO); } catch (e) {}
  }

  function detectarPagina() {
    var p = (location.pathname || '').toLowerCase();
    if (p.indexOf('painel-do-empreendedor.html') !== -1) return 'hub';
    if (p.indexOf('modulo-pedidos') !== -1) return 'pedidos';
    if (p.indexOf('modulo-loja') !== -1) return 'loja';
    if (p.indexOf('modulo-transporte') !== -1) return 'transporte';
    if (p.indexOf('admin.html') !== -1) return 'admin';
    return 'outro';
  }

  // ---------- NAVEGAÇÃO ----------
  function abrirModulo(url, opcoes) {
    opcoes = opcoes || {};
    salvarEstado({ destino: url });
    mostrarOverlay({
      nome: opcoes.nome || 'Abrindo módulo...',
      logo: opcoes.logo || '',
      texto: opcoes.texto || 'Preparando painel'
    });
    setTimeout(function () { window.location.href = url; }, 250);
  }

  function voltarAoHub(opcoes) {
    opcoes = opcoes || {};
    salvarEstado({ destino: 'hub' });
    mostrarOverlay({
      nome: opcoes.nome || 'Voltando ao painel...',
      logo: opcoes.logo || '',
      texto: 'Carregando página inicial'
    });
    var url = opcoes.url || 'https://www.economizeirioclaro.com.br/p/painel-do-empreendedor.html';
    setTimeout(function () { window.location.href = url; }, 250);
  }

  // ---------- RESTAURAÇÃO ----------
  function iniciar(opcoes) {
    opcoes = opcoes || {};
    var estado = lerEstado();
    if (!estado) return null;
    limparEstado();

    if (opcoes.nomePagina) {
      mostrarOverlay({
        nome: opcoes.nomePagina,
        logo: opcoes.logo || '',
        texto: opcoes.texto || 'Carregando...'
      });
    }
    return estado;
  }

  function restaurarScroll(estado) {
    if (!estado || typeof estado.scrollY !== 'number') return;
    requestAnimationFrame(function () {
      window.scrollTo(0, estado.scrollY);
    });
  }

  // ---------- EXPOSIÇÃO ----------
  global.EconomizeiPainel = global.EconomizeiPainel || {};
  global.EconomizeiPainel.Transicao = {
    mostrarOverlay: mostrarOverlay,
    esconderOverlay: esconderOverlay,
    salvarEstado: salvarEstado,
    lerEstado: lerEstado,
    limparEstado: limparEstado,
    abrirModulo: abrirModulo,
    voltarAoHub: voltarAoHub,
    iniciar: iniciar,
    restaurarScroll: restaurarScroll,
    detectarPagina: detectarPagina
  };
})(window);
