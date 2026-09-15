(function () {
'use strict';

var CFG = window.GRUPO_CONFIG || {};
var Economizei = window.Economizei = window.Economizei || {};
var EU = window.EconomizeiUtils;

if (!EU) console.error('[grupos.js] comum/utils.js não foi carregado antes deste script.');

(function () {
  function isAppMode() {
    var s = window.location.search || '';
    if (s.indexOf('app=1') !== -1 || s.indexOf('app=true') !== -1) return true;
    if (window.navigator.standalone === true) return true;
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    var ua = (navigator.userAgent || '').toLowerCase();
    if (ua.indexOf('wv') !== -1 || ua.indexOf('webview') !== -1) return true;
    return false;
  }
  if (isAppMode()) {
    document.documentElement.classList.add('modo-app-inicial');
    document.addEventListener('DOMContentLoaded', function () {
      document.body.classList.add('modo-app');
    });
  }
})();

var CARDS_CFG = {
  csvUrl: '',
  cacheKey: 'economizeiCacheGrupo',
  cacheDuration: 3600000,
  paginaCategorias: 'https://www.economizeirioclaro.com.br/p/categorias.html',
  paginaCadastro: 'https://www.economizeirioclaro.com.br/p/cadastro.html',
  paginaAtualUrl: '',
  favoritosKey: 'economizeiFavoritosGrupo',
  mapeamentoExato: {},
  imagemFallback: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop',
  iconeSemResultados: '📋',
  modoHorario: '7dias',
  colunas: null,
  tiposFiltroVisiveis: null
};

(function aplicarGRUPO_CONFIG() {
  if (!CFG || !Object.keys(CFG).length) return;
  var m = {
    csvUrl: 1, cacheKey: 1, favoritosKey: 1,
    urlBaseQR: 1, imagemFallback: 1, iconeSemResultados: 1,
    modoHorario: 1, colunas: 1, mapeamentoExato: 1
  };
  for (var k in CFG) {
    if (m[k] && CFG[k] !== undefined) {
      if (k === 'urlBaseQR') CARDS_CFG.paginaAtualUrl = CFG[k];
      else CARDS_CFG[k] = CFG[k];
    }
  }
})();

Economizei.Core = (function () {
  if (!window.EconomizeiFirebase) {
    console.error('[grupos.js] comum/firebase.js não foi carregado antes deste script.');
    return { authReady: Promise.resolve() };
  }
  var db = EconomizeiFirebase.db;
  var auth = EconomizeiFirebase.auth;
  var provider = EconomizeiFirebase.provider;

  var currentUser = null, userPhotoURL = '', userDisplayName = '';
  var authReadyResolve, authReady = new Promise(function (r) { authReadyResolve = r; });

  auth.onAuthStateChanged(function (user) {
    currentUser = user;
    if (user) {
      userPhotoURL = user.photoURL || '';
      userDisplayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário');
    } else { userPhotoURL = ''; userDisplayName = ''; }
    authReadyResolve();
  });

  function getCurrentUser() { return currentUser; }
  function getUserPhotoURL() { return userPhotoURL; }
  function getUserDisplayName() { return userDisplayName; }

  function sanitize(str) { return EU.sanitize(str); }
  function jsEscape(str) { if (!str) return ''; return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
  function ensureHttps(url) { return EU.ensureHttps(url); }
  function gerarSlug(texto) { return EU.gerarSlug(texto); }

  function formatarTelefone(numero) {
    if (!numero) return '';
    var n = numero.replace(/\D/g,'');
    if (n.startsWith('55')) n = n.slice(2);
    if (n.length >= 10) return '(' + n.slice(0,2) + ') ' + n.slice(2,7) + '-' + n.slice(7,11);
    return numero;
  }
  function sanitizarWhatsapp(numero) {
    if (!numero) return '';
    var limpo = numero.replace(/\D/g,'');
    if (!limpo) return '';
    if (!limpo.startsWith('55')) limpo = '55' + limpo;
    return limpo;
  }
  function showLoginOverlay() { var el = document.getElementById('loginOverlay'); if (el) el.style.display = 'flex'; }
  function hideLoginOverlay() { var el = document.getElementById('loginOverlay'); if (el) el.style.display = 'none'; }

  async function getEstatisticasAvaliacoes() {
    try {
      var snap = await db.collection('avaliacoes').get();
      var stats = {};
      snap.forEach(function (doc) {
        var data = doc.data(), id = data.estabelecimentoId;
        if (!stats[id]) stats[id] = { soma:0, total:0 };
        stats[id].soma += data.pontuacao; stats[id].total += 1;
      });
      var res = {};
      for (var id in stats) res[id] = { media: stats[id].soma / stats[id].total, total: stats[id].total };
      return res;
    } catch (e) { return {}; }
  }
  async function getAvaliacoesUsuario(uidOverride) {
    var uid = uidOverride || (currentUser && currentUser.uid);
    if (!uid) return {};
    try {
      var snap = await db.collection('avaliacoes').where('userId','==',uid).get();
      var map = {};
      snap.forEach(function (doc) { map[doc.data().estabelecimentoId] = doc.data().pontuacao; });
      return map;
    } catch (e) { return {}; }
  }
  async function salvarAvaliacaoFirebase(id, rating) {
    if (!currentUser) return;
    try {
      await db.collection('avaliacoes').doc(currentUser.uid + '_' + id).set({
        userId: currentUser.uid, estabelecimentoId: id, pontuacao: rating,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge:true });
    } catch (e) { console.error(e); }
  }
  function salvarPosicaoEAntesRecarregar() {
    sessionStorage.setItem('scrollPos', window.scrollY);
    var exp = document.querySelector('.card-expanded-container.active');
    if (exp) sessionStorage.setItem('expandedIndex', exp.dataset.index);
    else sessionStorage.removeItem('expandedIndex');
    location.reload();
  }
  function restaurarPosicao() {
    var sp = sessionStorage.getItem('scrollPos');
    var ei = sessionStorage.getItem('expandedIndex');
    if (sp) { window.scrollTo(0, parseInt(sp)); sessionStorage.removeItem('scrollPos'); }
    if (ei !== null) {
      setTimeout(function () {
        var exp = document.querySelector('.card-expanded-container[data-index="' + ei + '"]');
        if (exp) {
          var card = exp.previousElementSibling;
          if (card) {
            var btn = card.querySelector('.card-toggle');
            if (btn) btn.textContent = 'Ocultar detalhes';
            exp.classList.add('active');
          }
        }
        sessionStorage.removeItem('expandedIndex');
      }, 100);
    }
  }

  return {
    db:db, auth:auth, provider:provider, authReady:authReady,
    getCurrentUser:getCurrentUser, getUserPhotoURL:getUserPhotoURL, getUserDisplayName:getUserDisplayName,
    sanitize:sanitize, jsEscape:jsEscape, ensureHttps:ensureHttps, gerarSlug:gerarSlug,
    formatarTelefone:formatarTelefone, sanitizarWhatsapp:sanitizarWhatsapp,
    showLoginOverlay:showLoginOverlay, hideLoginOverlay:hideLoginOverlay,
    getEstatisticasAvaliacoes:getEstatisticasAvaliacoes,
    getAvaliacoesUsuario:getAvaliacoesUsuario,
    salvarAvaliacaoFirebase:salvarAvaliacaoFirebase,
    salvarPosicaoEAntesRecarregar:salvarPosicaoEAntesRecarregar,
    restaurarPosicao:restaurarPosicao
  };
})();

Economizei.Utils = (function () {
  var Core = Economizei.Core;
  var parseCSV = EU.parseCSV;

  function splitValores(val) {
    if (!val) return [];
    return val.split(',').map(function (v) { return v.trim(); }).filter(function (v) { return v !== ''; });
  }
  function valorAtendeFiltro(cel, filtro) { return splitValores(cel).indexOf(filtro) !== -1; }
  function calcularDistancia(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }
  function formatarDistancia(km) { return km < 1 ? Math.round(km*1000) + ' m' : km.toFixed(1) + ' km'; }
  function isClosedValue(valor) {
    if (!valor) return true;
    var str = String(valor).trim().toLowerCase();
    return str === '' || str === 'não' || str === 'nao';
  }
  function gerarURLQRCode(nome, urlBase) {
    var base = urlBase || CARDS_CFG.paginaAtualUrl || 'https://www.economizeirioclaro.com.br/p/categorias.html';
    return EU.gerarURLQRCode(base, Core.gerarSlug(nome));
  }
  function gerarImagemQRCode(nome, urlBase, tamanho) {
    return EU.gerarImagemQRCode(gerarURLQRCode(nome, urlBase), tamanho);
  }
  return {
    parseCSV:parseCSV, splitValores:splitValores, valorAtendeFiltro:valorAtendeFiltro,
    calcularDistancia:calcularDistancia, formatarDistancia:formatarDistancia,
    isClosedValue:isClosedValue, gerarURLQRCode:gerarURLQRCode, gerarImagemQRCode:gerarImagemQRCode
  };
})();

Economizei.Horario = (function () {
  var Utils = Economizei.Utils;
  var C = CFG.colunas || {
    NOME:0, CATEGORIA:1, SUBCATEGORIA:2, DISTRITO:3, IMAGEM:4, WHATSAPP:5, MAPS:6,
    HORARIO:7, DELIVERY:8, CONSUMO:9, OBSERVACAO:10, CARDAPIO:11, ATIVO:12,
    ID_UNICO:13, SLUG:14, URL_QR_CODE:15, LATITUDE:16, LONGITUDE:17,
    VERIFICADO:18, DATA_VERIFICACAO:19, SITE:20, FACEBOOK:21, INSTAGRAM:22, PROMOCAO:23,
    HORARIO_SEG:24, HORARIO_TER:25, HORARIO_QUA:26, HORARIO_QUI:27,
    HORARIO_SEX:28, HORARIO_SAB:29, HORARIO_DOM:30, ESTILO:31
  };
  if (C.ESTILO === undefined) C.ESTILO = 31;
  CARDS_CFG.colunas = C;
  var MODO = CARDS_CFG.modoHorario || '7dias';

  function getHorarioParaDia(est, dia) {
    var col;
    if (MODO === '3blocos') {
      if (dia === 0) col = C.HORARIO_DOM;
      else if (dia === 6) col = C.HORARIO_SAB;
      else col = C.HORARIO_SEG_SEX;
    } else {
      switch (dia) {
        case 0: col = C.HORARIO_DOM; break;
        case 1: col = C.HORARIO_SEG; break;
        case 2: col = C.HORARIO_TER; break;
        case 3: col = C.HORARIO_QUA; break;
        case 4: col = C.HORARIO_QUI; break;
        case 5: col = C.HORARIO_SEX; break;
        case 6: col = C.HORARIO_SAB; break;
        default: return null;
      }
    }
    var val = est[col];
    if (!Utils.isClosedValue(val)) return val.trim();
    return null;
  }

  function getHorarioPorDia(est) {
    var hoje = new Date().getDay();
    var esp = getHorarioParaDia(est, hoje);
    if (esp !== null) return esp;
    if (MODO === '3blocos') {
      var temAlgum = !Utils.isClosedValue(est[C.HORARIO_SEG_SEX]) ||
                     !Utils.isClosedValue(est[C.HORARIO_SAB]) ||
                     !Utils.isClosedValue(est[C.HORARIO_DOM]);
      if (temAlgum) return null;
    }
    var gen = est[C.HORARIO];
    return Utils.isClosedValue(gen) ? null : gen.trim();
  }

  function formatHorarioDisplay(est) {
    if (MODO === '3blocos') {
      var temSegSex = !Utils.isClosedValue(est[C.HORARIO_SEG_SEX]);
      var temSab = !Utils.isClosedValue(est[C.HORARIO_SAB]);
      var temDom = !Utils.isClosedValue(est[C.HORARIO_DOM]);
      if (temSegSex || temSab || temDom) {
        var partes = [];
        if (temSegSex) partes.push('Segunda a Sexta: ' + est[C.HORARIO_SEG_SEX].trim());
        if (temSab)     partes.push('Sábado: ' + est[C.HORARIO_SAB].trim());
        if (temDom)     partes.push('Domingo: ' + est[C.HORARIO_DOM].trim());
        return partes.join(' | ');
      }
    } else {
      var dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
      var hrs = [];
      for (var i = 0; i <= 6; i++) {
        var h = getHorarioParaDia(est, i);
        if (h) hrs.push(dias[i] + ': ' + h);
      }
      if (hrs.length > 0) return hrs.join(' | ');
    }
    var g = est[C.HORARIO];
    return (!g || Utils.isClosedValue(g)) ? 'Horário não informado' : g.trim();
  }

  function analisarHorario(hr) {
    if (!hr) return null;
    var h = hr.trim().toLowerCase();
    if (h.indexOf('marcado') !== -1 || h.indexOf('agendamento') !== -1 || h.indexOf('consultar') !== -1 ||
        h.indexOf('combinar') !== -1 || h.indexOf('agendar') !== -1)
      return { isMarcado:true, aberto:null, fechaEmBreve:false, horarioFechamento:null };
    if (h === '24h' || h === '0h-24h' || h === '0:00-24:00')
      return { is24h:true, aberto:true, fechaEmBreve:false, horarioFechamento:null };
    var agora = new Date();
    var agoraMin = agora.getHours()*60 + agora.getMinutes();
    var turnos = hr.split('/').map(function (t) { return t.trim(); });
    for (var i = 0; i < turnos.length; i++) {
      var match = turnos[i].match(/(\d{1,2})(?:h|:)?(\d{0,2})\s*-\s*(\d{1,2})(?:h|:)?(\d{0,2})/);
      if (!match) continue;
      var iniH = parseInt(match[1],10), iniM = match[2] ? parseInt(match[2],10) : 0;
      var fimH = parseInt(match[3],10), fimM = match[4] ? parseInt(match[4],10) : 0;
      var iniMin = iniH*60 + iniM;
      var fimMin = fimH*60 + fimM;
      if (fimH === 0 && fimM === 0) fimMin = 24*60;
      var aberto = false, rest = Infinity, fechamento = null;
      if (iniMin <= fimMin) {
        if (agoraMin >= iniMin && agoraMin <= fimMin) {
          aberto = true; rest = fimMin - agoraMin;
          fechamento = String(fimH).padStart(2,'0') + ':' + String(fimM).padStart(2,'0');
        }
      } else {
        if (agoraMin >= iniMin || agoraMin <= fimMin) {
          aberto = true;
          rest = (agoraMin >= iniMin) ? ((24*60 - agoraMin) + fimMin) : (fimMin - agoraMin);
          fechamento = String(fimH === 0 ? 0 : fimH).padStart(2,'0') + ':' + String(fimM).padStart(2,'0');
        }
      }
      if (aberto) return { is24h:false, isMarcado:false, aberto:true, fechaEmBreve: rest <= 60 && rest > 0, horarioFechamento:fechamento };
    }
    return { aberto:false, is24h:false, isMarcado:false };
  }

  function getStatusHorario(hr) {
    var res = analisarHorario(hr);
    if (!res) return { status:'fechado', texto:'Fechado', cor:'status-fechado' };
    if (res.isMarcado) return { status:'marcado', texto:'Atendimento agendado', cor:'status-marcado' };
    if (res.is24h) return { status:'24h', texto:'24 horas', cor:'status-24h' };
    if (!res.aberto) return { status:'fechado', texto:'Fechado', cor:'status-fechado' };
    if (res.fechaEmBreve) return { status:'breve', texto:'Fecha em breve (' + res.horarioFechamento + ')', cor:'status-breve' };
    return { status:'aberto', texto:'Aberto agora', cor:'status-aberto' };
  }

  return {
    COLUNAS: C,
    getHorarioPorDia:getHorarioPorDia, formatHorarioDisplay:formatHorarioDisplay,
    getStatusHorario:getStatusHorario, isClosedValue:Utils.isClosedValue
  };
})();

Economizei.UI = (function () {
  var Core = Economizei.Core;
  var modalAcessivel = EU.criarModalAcessivel();

  function mostrarToast(msg) {
    var t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg;
    t.setAttribute('role','alert'); t.setAttribute('aria-live','assertive');
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2400);
  }

  function abrirModalWhatsapp(index) {
    var card = Economizei.Cards.getCardByIndex(index);
    if (!card) return;
    var wData = JSON.parse(card.dataset.whatsapp || '[]');
    if (!wData.length) return;
    var modal = document.getElementById('modalWhatsapp');
    if (!modal) return;
    document.getElementById('modalWhatsappTitulo').innerHTML =
      '<i class="fa-solid fa-comment-dots" aria-hidden="true"></i> WhatsApp';
    var lista = document.getElementById('listaWhatsapp'); lista.innerHTML = '';
    wData.forEach(function (w) {
      var a = document.createElement('a');
      a.href = 'https://wa.me/' + w.numero;
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.className = 'item-opcao item-whatsapp';
      var nome = w.nome || 'WhatsApp';
      var tel  = Core.formatarTelefone(w.numero);
      a.setAttribute('aria-label', 'Abrir WhatsApp ' + nome + ' — ' + tel);
      a.innerHTML =
        '<span class="item-icone" aria-hidden="true"><i class="fa-brands fa-whatsapp"></i></span>' +
        '<span class="item-texto">' +
          '<span class="item-label">' + Core.sanitize(nome) + '</span>' +
          '<span class="item-sublabel">' + Core.sanitize(tel) + '</span>' +
        '</span>' +
        '<span class="item-seta" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></span>';
      lista.appendChild(a);
    });
    modalAcessivel.abrir(modal);
  }

  function trapFocus(modal) { modalAcessivel.abrir(modal); }
  function restoreFocus() { modalAcessivel.fechar(); }

  return {
    mostrarToast:mostrarToast, abrirModalWhatsapp:abrirModalWhatsapp,
    trapFocus:trapFocus, restoreFocus:restoreFocus
  };
})();

Economizei.Cards = (function () {
  var Core = Economizei.Core;
  var Utils = Economizei.Utils;
  var Horario = Economizei.Horario;
  var UI = Economizei.UI;
  var C = Horario.COLUNAS;

  var gerenciadorFav = EU.criarGerenciadorFavoritos(CARDS_CFG.favoritosKey);

  var dadosProcessados = [];
  var todosCardsRenderizados = [];
  var listaFiltradaIndices = [];
  var filtrosAtivos = new Map();
  var categoriaGlobal = null;
  var estabelecimentoViaQR = null;
  var pertoMimAtivo = false, usuarioPosicao = null;
  var ordenarPorMedia = false;
  var cardsPorPagina = 20, paginaAtual = 1, vigiaScroll = null;
  var estatisticasGlobais = {}, avaliacoesUsuarioGlobais = {};
  var modulosRegistrados = {};
  var dadosResolvidos;
  var dadosProntos = new Promise(function (r) { dadosResolvidos = r; });

  function configurar(opcoes) {
    opcoes = opcoes || {};
    if (opcoes.colunas) {
      for (var k in opcoes.colunas) C[k] = opcoes.colunas[k];
      if (C.ESTILO === undefined) C.ESTILO = 31;
      Horario.COLUNAS = C;
    }
    if (opcoes.tiposFiltroVisiveis) CARDS_CFG.tiposFiltroVisiveis = opcoes.tiposFiltroVisiveis;
    for (var key in opcoes) {
      if (key === 'colunas' || key === 'filtros' || key === 'tiposFiltroVisiveis') continue;
      CARDS_CFG[key] = opcoes[key];
    }
  }

  function registrarModulo(estilo, definicao) {
    if (!estilo || !definicao || typeof definicao.onClick !== 'function') {
      console.error('[registrarModulo] inválido:', estilo, definicao);
      return;
    }
    modulosRegistrados[String(estilo).toLowerCase().trim()] = definicao;
  }

  function montarBotaoModulo(estilo, idx) {
    var def = modulosRegistrados[(estilo || '').toLowerCase().trim()];
    if (!def) return '';
    var label = def.label || 'Abrir';
    var aria = def.ariaLabel || label;
    return '<button class="btn-acao btn-modulo" onclick="' + def.onClick(idx) + '" aria-label="' + Core.sanitize(aria) + '">' + label + '</button>';
  }

  function getFavoritos() { return gerenciadorFav.getTodos(); }
  function toggleFavorito(nome) { return gerenciadorFav.toggle(nome); }

  function estaVerificado(c) {
    var v = c[C.VERIFICADO] && c[C.VERIFICADO].toLowerCase() === 'sim';
    var dataStr = c[C.DATA_VERIFICACAO];
    if (!v || !dataStr) return false;
    var data = null;
    if (dataStr.indexOf('/') !== -1) {
      var partes = dataStr.split('/');
      if (partes.length === 3) data = new Date(parseInt(partes[2],10), parseInt(partes[1],10)-1, parseInt(partes[0],10));
    } else if (dataStr.indexOf('-') !== -1) data = new Date(dataStr + 'T00:00:00');
    if (!data || isNaN(data.getTime())) return false;
    return (new Date() - data) < 365*24*60*60*1000;
  }
  function getDataVerificacao(c) {
    var dataStr = c[C.DATA_VERIFICACAO];
    if (!dataStr) return null;
    if (dataStr.indexOf('/') !== -1) {
      var p = dataStr.split('/');
      if (p.length === 3) return new Date(parseInt(p[2],10), parseInt(p[1],10)-1, parseInt(p[0],10));
    } else if (dataStr.indexOf('-') !== -1) return new Date(dataStr + 'T00:00:00');
    return null;
  }
  function compararPorDataVerificacao(a, b) {
    var da = getDataVerificacao(dadosProcessados[a]);
    var db_ = getDataVerificacao(dadosProcessados[b]);
    if (!da && !db_) return 0;
    if (!da) return 1;
    if (!db_) return -1;
    return da - db_;
  }
  function colunaTemValores(col) {
    var filt = categoriaGlobal ? dadosProcessados.filter(function (it) { return it[C.CATEGORIA] === categoriaGlobal; }) : dadosProcessados;
    return filt.some(function (it) { var v = it[col]; return v && Utils.splitValores(v).length > 0; });
  }
  function obterOpcoesFiltro(tipoInfo) {
    var set = new Set();
    var filt = categoriaGlobal ? dadosProcessados.filter(function (it) { return it[C.CATEGORIA] === categoriaGlobal; }) : dadosProcessados;
    filt.forEach(function (it) {
      var v = it[tipoInfo.coluna];
      if (v) Utils.splitValores(v).forEach(function (item) { set.add(item); });
    });
    return Array.from(set).sort();
  }
  function infoFiltroPorId(tipoId) {
    var vis = CARDS_CFG.tiposFiltroVisiveis || {};
    for (var k in vis) if (vis[k].id === tipoId) return vis[k];
    return null;
  }
  function listarTiposFiltro() {
    var vis = CARDS_CFG.tiposFiltroVisiveis || {};
    var out = [];
    for (var k in vis) out.push(vis[k]);
    return out;
  }

  function criarIndicadorCategoria(cat) {
    document.getElementById('indicadorCategoriaContainer').innerHTML =
      '<div class="indicador-categoria-selecionada">' +
        '<div class="categoria-info">' +
          '<div class="categoria-icone" aria-hidden="true">📋</div>' +
          '<div class="categoria-texto">' +
            '<span class="categoria-titulo">Você está explorando</span>' +
            '<span class="categoria-nome">' + Core.sanitize(cat) + '</span>' +
          '</div>' +
        '</div>' +
        '<a href="' + CARDS_CFG.paginaCategorias + '" class="botao-voltar-categorias">← Voltar para página de categorias</a>' +
      '</div>';
  }
  function criarIndicadorQRCode(nome, categoria) {
    document.getElementById('indicadorQRCodeContainer').innerHTML =
      '<div class="indicador-qr-code">' +
        '<div class="qr-code-info">' +
          '<div class="qr-code-icone" aria-hidden="true">📱</div>' +
          '<div class="qr-code-texto">' +
            '<span class="qr-code-titulo">Você está acessando:</span>' +
            '<span class="qr-code-nome">' + Core.sanitize(nome) + '</span>' +
          '</div>' +
        '</div>' +
        '<button class="botao-fechar-qr" data-categoria="' + Core.sanitize(categoria) + '">← Voltar para ' + Core.sanitize(categoria) + '</button>' +
      '</div>';
  }
  function fecharQRCode(categoria) {
    document.getElementById('indicadorQRCodeContainer').innerHTML = '';
    estabelecimentoViaQR = null;
    var b = document.getElementById('busca'); if (b) b.value = '';
    var url = new URL(window.location);
    url.searchParams.delete('qr');
    window.history.replaceState({}, '', url);
    if (categoria) {
      document.getElementById('indicadorCategoriaContainer').innerHTML = '';
      categoriaGlobal = categoria;
      criarIndicadorCategoria(categoria);
    } else {
      categoriaGlobal = null;
      document.getElementById('indicadorCategoriaContainer').innerHTML = '';
    }
    aplicarFiltrosEOrdenacao();
  }

  function mostrarMensagemSemResultados() {
    var lista = document.getElementById('lista');
    if (lista.querySelector('.sem-resultados')) return;
    var params = new URLSearchParams(location.search);
    var hasCat = !!categoriaGlobal || params.has('cat');
    var temBusca = document.getElementById('busca').value.trim() !== '';
    var temOutrosFiltros = filtrosAtivos.size > 0;
    var icone = CARDS_CFG.iconeSemResultados || '📋';
    if (hasCat && !temBusca && !temOutrosFiltros) {
      lista.innerHTML += '<div class="sem-resultados sem-resultados-cadastro">' +
        '<div style="font-size:2rem;margin-bottom:0.5rem;" aria-hidden="true">' + icone + '</div>' +
        '<h3>Ainda não há estabelecimentos cadastrados nesta categoria</h3>' +
        '<p>Se você tem um negócio nesta área em Rio Claro, seja o primeiro a aparecer aqui!</p>' +
        '<a href="' + CARDS_CFG.paginaCadastro + '" target="_blank" rel="noopener noreferrer" class="btn-cadastro-cta">📋 Cadastrar meu estabelecimento</a><br>' +
        '<button onclick="window.location.href=\'' + CARDS_CFG.paginaCategorias + '\'" class="btn-adicionar-filtro" style="border-radius:2rem;border:none;padding:0.5rem 1rem;cursor:pointer;">← Voltar para categorias</button>' +
        '</div>';
      return;
    }
    var botao = hasCat
      ? '<button onclick="window.location.href=\'' + CARDS_CFG.paginaCategorias + '\'" class="btn-adicionar-filtro" style="border-radius:2rem;border:none;padding:0.5rem 1rem;cursor:pointer;">← Voltar para categorias</button>'
      : '<button onclick="Economizei.Cards.limparTodosFiltros()" class="btn-adicionar-filtro" style="border-radius:2rem;border:none;padding:0.5rem 1rem;cursor:pointer;">↺ Limpar Filtros</button>';
    lista.innerHTML += '<div class="sem-resultados"><div style="font-size:2rem;margin-bottom:0.5rem;color:#d97706;" aria-hidden="true">🔍</div><h3>Nenhum estabelecimento encontrado</h3><p>Tente alterar os filtros de busca.</p>' + botao + '</div>';
  }

  function renderizarPagina() {
    var lista = document.getElementById('lista');
    lista.innerHTML = '';
    var fim = paginaAtual * cardsPorPagina;
    listaFiltradaIndices.slice(0, fim).forEach(function (idx) {
      var item = todosCardsRenderizados[idx];
      if (item) { lista.appendChild(item.card); lista.appendChild(item.expanded); }
    });
    ativarInteracoesCards();
    if (fim < listaFiltradaIndices.length) colocarEspiao();
    else if (vigiaScroll) { vigiaScroll.disconnect(); vigiaScroll = null; }
    if (listaFiltradaIndices.length === 0) mostrarMensagemSemResultados();
  }
  function colocarEspiao() {
    if (vigiaScroll) { vigiaScroll.disconnect(); vigiaScroll = null; }
    var espiao = document.createElement('div');
    espiao.id = 'espiao'; espiao.style.height = '10px'; espiao.style.width = '100%';
    espiao.setAttribute('aria-hidden','true');
    document.getElementById('lista').appendChild(espiao);
    vigiaScroll = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { paginaAtual++; renderizarPagina(); }
    });
    vigiaScroll.observe(espiao);
  }

  function aplicarFiltrosEOrdenacao() {
    if (!dadosProcessados.length || !todosCardsRenderizados.length) return;
    var indicesFiltrados = [];
    var busca = document.getElementById('busca').value.toLowerCase().trim();
    dadosProcessados.forEach(function (est, idx) {
      if (estabelecimentoViaQR) { if (est[C.NOME] === estabelecimentoViaQR[C.NOME]) indicesFiltrados.push(idx); return; }
      if (busca && !est[C.NOME].toLowerCase().includes(busca)) return;
      if (categoriaGlobal && est[C.CATEGORIA] !== categoriaGlobal) return;
      var ok = true;
      filtrosAtivos.forEach(function (valor, tipo) {
        var info = infoFiltroPorId(tipo);
        if (info) {
          var cel = est[info.coluna] || '';
          if (!Utils.valorAtendeFiltro(cel, valor)) ok = false;
        }
      });
      if (!ok) return;
      indicesFiltrados.push(idx);
    });

    if (ordenarPorMedia) {
      indicesFiltrados.sort(function (a, b) {
        var ma = (estatisticasGlobais[dadosProcessados[a][C.NOME]] || {}).media || 0;
        var mb = (estatisticasGlobais[dadosProcessados[b][C.NOME]] || {}).media || 0;
        return mb - ma;
      });
      listaFiltradaIndices = indicesFiltrados;
      paginaAtual = 1;
      if (vigiaScroll) { vigiaScroll.disconnect(); vigiaScroll = null; }
      renderizarPagina();
      return;
    }

    var indicesVerificados    = indicesFiltrados.filter(function (idx) { return estaVerificado(dadosProcessados[idx]); }).sort(compararPorDataVerificacao);
    var indicesNaoVerificados = indicesFiltrados.filter(function (idx) { return !estaVerificado(dadosProcessados[idx]); });
    var favoritos = getFavoritos();
    var verFav     = indicesVerificados.filter(function (idx) { return favoritos.indexOf(dadosProcessados[idx][C.NOME]) !== -1; });
    var verNaoFav  = indicesVerificados.filter(function (idx) { return favoritos.indexOf(dadosProcessados[idx][C.NOME]) === -1; });
    var naoVerFav  = indicesNaoVerificados.filter(function (idx) { return favoritos.indexOf(dadosProcessados[idx][C.NOME]) !== -1; });
    var naoVerNaoFav = indicesNaoVerificados.filter(function (idx) { return favoritos.indexOf(dadosProcessados[idx][C.NOME]) === -1; });

    if (pertoMimAtivo && usuarioPosicao) {
      var ordenarDist = function (l) {
        return l.map(function (idx) {
          var est = dadosProcessados[idx];
          var lat = parseFloat(est[C.LATITUDE]), lng = parseFloat(est[C.LONGITUDE]);
          var dist = Infinity;
          if (!isNaN(lat) && !isNaN(lng)) dist = Utils.calcularDistancia(usuarioPosicao.lat, usuarioPosicao.lng, lat, lng);
          return { idx:idx, dist:dist };
        }).sort(function (a, b) { return a.dist - b.dist; }).map(function (it) { return it.idx; });
      };
      listaFiltradaIndices = [].concat(ordenarDist(verFav), ordenarDist(verNaoFav), ordenarDist(naoVerFav), ordenarDist(naoVerNaoFav));
    } else {
      listaFiltradaIndices = [].concat(verFav, verNaoFav, naoVerFav, naoVerNaoFav);
    }
    paginaAtual = 1;
    if (vigiaScroll) { vigiaScroll.disconnect(); vigiaScroll = null; }
    renderizarPagina();
  }

  function atualizarFichasFiltros() {
    var lista = document.getElementById('filtrosAtivosLista'); lista.innerHTML = '';
    filtrosAtivos.forEach(function (valor, tipo) {
      var info = infoFiltroPorId(tipo); if (!info) return;
      var f = document.createElement('div');
      f.className = 'ficha-filtro';
      f.setAttribute('role','button'); f.setAttribute('tabindex','0');
      f.setAttribute('aria-label', 'Remover filtro ' + info.nome + ': ' + valor);
      f.innerHTML = '<span class="ficha-filtro-tipo">' + info.nome + '</span>: ' + Core.sanitize(valor) +
        '<button class="ficha-filtro-remover" data-tipo="' + tipo + '" aria-label="Remover filtro ' + valor + '">×</button>';
      f.querySelector('.ficha-filtro-remover').onclick = function (e) { e.stopPropagation(); removerFiltro(tipo); };
      f.onclick = function (e) { if (!e.target.classList.contains('ficha-filtro-remover')) abrirModalOpcoesFiltro(tipo); };
      f.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.click(); } });
      lista.appendChild(f);
    });
  }
  function adicionarFiltro(tipo, valor) {
    if (tipo === 'categoria') { categoriaGlobal = valor; criarIndicadorCategoria(valor); }
    else { filtrosAtivos.set(tipo, valor); }
    atualizarFichasFiltros();
    aplicarFiltrosEOrdenacao();
  }
  function removerFiltro(tipo) {
    if (tipo === 'categoria') return;
    filtrosAtivos.delete(tipo);
    atualizarFichasFiltros();
    aplicarFiltrosEOrdenacao();
  }
  function limparTodosFiltros() {
    filtrosAtivos.clear(); categoriaGlobal = null;
    document.getElementById('indicadorCategoriaContainer').innerHTML = '';
    estabelecimentoViaQR = null;
    var b = document.getElementById('busca'); if (b) b.value = '';
    var bl = document.getElementById('btnLimparBusca'); if (bl) bl.classList.remove('visible');
    document.getElementById('indicadorQRCodeContainer').innerHTML = '';
    var bp = document.getElementById('btnPertoMim');
    if (pertoMimAtivo) {
      pertoMimAtivo = false; usuarioPosicao = null;
      if (bp) { bp.classList.remove('ativo'); bp.innerHTML = '📍 Perto de Mim'; }
    }
    ordenarPorMedia = false;
    atualizarFichasFiltros();
    aplicarFiltrosEOrdenacao();
  }
  function abrirModalTiposFiltro() {
    var modal = document.getElementById('modalAdicionarFiltro');
    var lista = document.getElementById('listaTiposFiltro'); lista.innerHTML = '';
    listarTiposFiltro().forEach(function (tipo) {
      if (!colunaTemValores(tipo.coluna)) return;
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'item-opcao';
      item.textContent = tipo.nome;
      item.onclick = function () {
        UI.restoreFocus();
        abrirModalOpcoesFiltro(tipo.id);
      };
      lista.appendChild(item);
    });
    UI.trapFocus(modal);
  }
  function abrirModalOpcoesFiltro(tipoId) {
    var info = infoFiltroPorId(tipoId); if (!info) return;
    var opcoes = obterOpcoesFiltro(info);
    var modalOpcoes = document.getElementById('modalOpcoesFiltro');
    document.getElementById('tituloOpcoesFiltro').innerHTML =
      '<i class="fa-solid fa-list" aria-hidden="true"></i> Selecionar ' + Core.sanitize(info.nome);
    var lista = document.getElementById('listaOpcoesFiltro'); lista.innerHTML = '';
    var todos = document.createElement('button');
    todos.type = 'button';
    todos.className = 'item-opcao';
    todos.textContent = 'Todos';
    todos.onclick = function () { removerFiltro(tipoId); UI.restoreFocus(); };
    lista.appendChild(todos);
    opcoes.forEach(function (op) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'item-opcao' + (filtrosAtivos.get(tipoId) === op ? ' selecionada' : '');
      item.textContent = op;
      item.onclick = function () { adicionarFiltro(tipoId, op); UI.restoreFocus(); };
      lista.appendChild(item);
    });
    UI.trapFocus(modalOpcoes);
  }
  function aplicarFiltroURL() {
    var params = new URLSearchParams(location.search);
    if (!params.has('cat')) return;
    var slug = params.get('cat').toLowerCase().trim();
    slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    var catEncontrada = null;
    var mape = CARDS_CFG.mapeamentoExato || {};
    for (var key in mape) {
      if (key === slug) { catEncontrada = mape[key]; break; }
    }
    if (!catEncontrada && dadosProcessados.length > 0) {
      var catsMap = new Map();
      dadosProcessados.forEach(function (c) {
        var orig = c[C.CATEGORIA];
        if (orig) {
          var norm = orig.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
          catsMap.set(norm, orig);
        }
      });
      if (catsMap.has(slug)) catEncontrada = catsMap.get(slug);
      else {
        for (var entry of catsMap.entries()) {
          if (entry[0].includes(slug) || slug.includes(entry[0])) { catEncontrada = entry[1]; break; }
        }
      }
    }
    if (catEncontrada) adicionarFiltro('categoria', catEncontrada);
  }

  function obterLocalizacaoUsuario() {
    return new Promise(function (resolve, reject) {
      if (!navigator.geolocation) { reject('Geolocalização não suportada'); return; }
      navigator.geolocation.getCurrentPosition(
        function (pos) { usuarioPosicao = { lat: pos.coords.latitude, lng: pos.coords.longitude }; resolve(usuarioPosicao); },
        function (err) {
          var msg = 'Erro ao obter localização';
          if (err.code === 1) msg = 'Permissão negada. Habilite a localização nas configurações do navegador.';
          else if (err.code === 2) msg = 'Localização indisponível';
          else if (err.code === 3) msg = 'Tempo esgotado';
          reject(msg);
        },
        { enableHighAccuracy:true, timeout:10000, maximumAge:0 }
      );
    });
  }
  function ativarPertoDeMim() {
    var btn = document.getElementById('btnPertoMim');
    btn.classList.add('ativo'); btn.innerHTML = '📍 Buscando...';
    obterLocalizacaoUsuario().then(function () {
      pertoMimAtivo = true; btn.innerHTML = '📍 Ativo';
      renderizarCards(estatisticasGlobais, avaliacoesUsuarioGlobais);
      aplicarFiltrosEOrdenacao();
    }).catch(function (erro) {
      btn.classList.remove('ativo'); btn.innerHTML = '📍 Perto de Mim';
      UI.mostrarToast(erro);
    });
  }
  function desativarPertoDeMim() {
    pertoMimAtivo = false; usuarioPosicao = null;
    document.getElementById('btnPertoMim').classList.remove('ativo');
    document.getElementById('btnPertoMim').innerHTML = '📍 Perto de Mim';
    renderizarCards(estatisticasGlobais, avaliacoesUsuarioGlobais);
    aplicarFiltrosEOrdenacao();
  }
  function togglePertoDeMim() { if (pertoMimAtivo) desativarPertoDeMim(); else ativarPertoDeMim(); }

  function abrirQRCode(event, nome, qrCodeURL, urlQRCode) {
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label', 'QR Code de ' + nome);
    modal.innerHTML =
      '<div class="modal-conteudo modal-sm modal-midia">' +
        '<div class="modal-header">' +
          '<h3><i class="fa-solid fa-qrcode" aria-hidden="true"></i> QR Code</h3>' +
          '<button class="modal-close-btn" data-fechar-qr aria-label="Fechar QR Code">×</button>' +
        '</div>' +
        '<div class="modal-body">' +
          '<div class="midia-wrap"><img src="' + qrCodeURL + '" alt="QR Code para ' + Core.sanitize(nome) + '" loading="lazy" decoding="async" width="220" height="220"></div>' +
          '<p class="midia-titulo">' + Core.sanitize(nome) + '</p>' +
          '<div class="midia-acoes">' +
            '<button class="btn-modal-secundario" data-acao="compartilhar" data-nome="' + Core.sanitize(nome) + '" data-url="' + Core.sanitize(urlQRCode) + '"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Compartilhar</button>' +
            '<button class="btn-modal-primario" data-acao="copiar" data-url="' + Core.sanitize(urlQRCode) + '"><i class="fa-solid fa-copy" aria-hidden="true"></i> Copiar</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    var ctrl = EU.criarModalAcessivel();
    ctrl.abrir(modal, function () { modal.remove(); });

    modal.addEventListener('click', function (e) {
      var t = e.target;
      if (t === modal) { ctrl.fechar(); return; }
      if (t.closest('[data-fechar-qr]')) { ctrl.fechar(); return; }
      var btn = t.closest('[data-acao]');
      if (!btn) return;
      var url = btn.dataset.url;
      if (btn.dataset.acao === 'compartilhar') {
        if (navigator.share) navigator.share({ title: btn.dataset.nome, url: url });
        else Economizei.UI.mostrarToast('Compartilhamento não suportado');
      } else if (btn.dataset.acao === 'copiar') {
        navigator.clipboard.writeText(url).then(function () {
          Economizei.UI.mostrarToast('URL copiada!');
        });
      }
    });
  }

  function renderizarCards(estatisticas, avaliacoesUsuario) {
    var favoritos = getFavoritos();
    var lista = document.getElementById('lista');
    lista.innerHTML = ''; todosCardsRenderizados = [];

    dadosProcessados.forEach(function (c, idx) {
      var nome          = c[C.NOME] || '';
      var categoria     = c[C.CATEGORIA] || '';
      var subcategoria  = c[C.SUBCATEGORIA] || '';
      var distrito      = c[C.DISTRITO] || '';
      var imagem        = Core.ensureHttps(c[C.IMAGEM]) || CARDS_CFG.imagemFallback;
      var whatsappRaw   = c[C.WHATSAPP] || '';
      var maps          = c[C.MAPS] || '';
      var horarioDisplay = Horario.formatHorarioDisplay(c);
      var horarioStatus  = Horario.getHorarioPorDia(c);
      var status         = Horario.getStatusHorario(horarioStatus);
      var delivery      = c[C.DELIVERY] || '';
      var consumo       = c[C.CONSUMO] || '';
      var observacao    = c[C.OBSERVACAO] || '';
      var cardapio      = c[C.CARDAPIO] || '';
      var site          = c[C.SITE] || '';
      var facebook      = c[C.FACEBOOK] || '';
      var instagram     = c[C.INSTAGRAM] || '';
      var promocao      = c[C.PROMOCAO] || '';
      var idUnico       = c[C.ID_UNICO] || '';
      var slug          = c[C.SLUG] || '';
      var latitude      = c[C.LATITUDE] || '';
      var longitude     = c[C.LONGITUDE] || '';
      var estilo        = (c[C.ESTILO] || '').toLowerCase().trim();

      var verificado = estaVerificado(c);
      var dataVerif = '';
      if (verificado && c[C.DATA_VERIFICACAO]) {
        var d = getDataVerificacao(c);
        if (d) dataVerif = d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear();
      }

      var isFav = favoritos.indexOf(nome) !== -1;
      var avUser = avaliacoesUsuario[nome] || 0;
      var stats = estatisticas[nome] || { media:0, total:0 };
      var mediaF = stats.media > 0 ? stats.media.toFixed(1) : '0.0';
      var totalV = stats.total || 0;
      var estrelasHTML = Array.from({ length:5 }, function (_, i) {
        return '<span aria-hidden="true">' + (i < Math.round(stats.media) ? '★' : '☆') + '</span>';
      }).join('');
      var qrCodeURL = Utils.gerarImagemQRCode(nome);
      var urlQRCode = Utils.gerarURLQRCode(nome);

      var distanciaHTML = '';
      if (pertoMimAtivo && usuarioPosicao) {
        var lat = parseFloat(latitude), lng = parseFloat(longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          var dist = Utils.calcularDistancia(usuarioPosicao.lat, usuarioPosicao.lng, lat, lng);
          distanciaHTML = '<div class="card-distancia"><span aria-hidden="true">📍</span> ' + Utils.formatarDistancia(dist) + '</div>';
        }
      }

      var whatsappData = [];
      if (whatsappRaw) {
        whatsappRaw.split(/[,\n;]+/).map(function (s) { return s.trim(); }).filter(function (s) { return s !== ''; }).forEach(function (parte) {
          if (parte.indexOf('|') !== -1) {
            var sp = parte.split('|').map(function (s) { return s.trim(); });
            var num = Core.sanitizarWhatsapp(sp[1]);
            if (num) whatsappData.push({ nome: sp[0], numero: num });
          } else {
            var num2 = Core.sanitizarWhatsapp(parte);
            if (num2) whatsappData.push({ nome: null, numero: num2 });
          }
        });
      }

      var reservasData = [];
      if (C.RESERVA !== undefined && c[C.RESERVA]) {
        c[C.RESERVA].split(',').map(function (s) { return s.trim(); }).forEach(function (item) {
          if (item.indexOf('|') !== -1) {
            var sp = item.split('|').map(function (s) { return s.trim(); });
            reservasData.push({ nome: sp[0], url: sp[1] });
          } else {
            var nn = item;
            try { var u = new URL(item); nn = u.hostname.replace(/^www\./, ''); } catch (e) {}
            reservasData.push({ nome: nn, url: item });
          }
        });
      }

      var card = document.createElement('div');
      card.className = 'card' + (isFav ? ' card-favorito' : '');
      card.setAttribute('role','button'); card.setAttribute('tabindex','0');
      card.setAttribute('aria-label', nome + (verificado ? ', verificado' : '') + (isFav ? ', favorito' : '') + ', ' + status.texto);
      card.dataset.nome = nome; card.dataset.categoria = categoria;
      card.dataset.subcategoria = subcategoria; card.dataset.distrito = distrito;
      card.dataset.idUnico = idUnico; card.dataset.slug = slug;
      card.dataset.latitude = latitude; card.dataset.longitude = longitude;
      card.dataset.index = idx; card.dataset.verificado = verificado ? 'true' : 'false';
      card.dataset.whatsapp = JSON.stringify(whatsappData);
      card.dataset.estilo = estilo;
      if (reservasData.length) card.dataset.reservas = JSON.stringify(reservasData);

      var separadorHtml = (categoria && subcategoria) ? '<span class="card-categoria-separador">|</span>' : '';

      card.innerHTML =
        '<div class="card-img-container"><img class="card-img" src="' + imagem + '" alt="' + Core.sanitize(nome) + '" loading="' + (idx < 8 ? 'eager' : 'lazy') + '" decoding="async" onerror="this.src=\'' + CARDS_CFG.imagemFallback + '\'"></div>' +
        '<div class="card-status ' + status.cor + '"><span class="status-texto">' + status.texto + '</span></div>' +
        '<button class="btn-favorito ' + (isFav ? 'ativo' : '') + '" data-nome="' + Core.sanitize(nome) + '" data-index="' + idx + '" aria-label="' + (isFav ? 'Remover' : 'Adicionar') + ' ' + Core.sanitize(nome) + ' dos favoritos">' + (isFav ? '♥' : '♡') + '</button>' +
        '<div class="card-content">' +
          (verificado ? '<div class="badge-verificado-container"><span class="badge-tooltip" data-tooltip="Verificado em ' + dataVerif + '" tabindex="0">✅ Verificado</span></div>' : '') +
          '<h3 class="card-title">' + Core.sanitize(nome) + '</h3>' +
          '<div class="card-categoria-container">' +
            (categoria ? '<span class="card-categoria">' + Core.sanitize(categoria) + '</span>' : '') + separadorHtml +
            (subcategoria ? '<span class="card-subcategoria">' + Core.sanitize(subcategoria) + '</span>' : '') +
          '</div>' +
          (distrito ? '<div class="card-distrito">' + Core.sanitize(distrito) + '</div>' : '') +
          distanciaHTML +
          '<div class="card-avaliacao-header">' +
            '<div class="estrelas-header" aria-label="Avaliação: ' + mediaF + ' estrelas, ' + totalV + ' ' + (totalV === 1 ? 'voto' : 'votos') + '">' + estrelasHTML + '</div>' +
            '<div class="nota-header">' + mediaF + ' (' + totalV + ' ' + (totalV === 1 ? 'voto' : 'votos') + ')</div>' +
          '</div>' +
          '<button class="card-toggle" data-index="' + idx + '" aria-expanded="false">Ver detalhes</button>' +
        '</div>';

      var expanded = document.createElement('div');
      expanded.className = 'card-expanded-container';
      expanded.dataset.index = idx; expanded.dataset.parent = nome;
      expanded.setAttribute('aria-label', 'Detalhes de ' + nome);

      var authHTML = gerarAuthHTML(idx);

      var botoes = [];
      if (whatsappData.length === 1) {
        var w = whatsappData[0];
        botoes.push('<a href="https://wa.me/' + w.numero + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-whatsapp" aria-label="WhatsApp ' + Core.sanitize(w.nome ? w.nome : Core.formatarTelefone(w.numero)) + '">WhatsApp</a>');
      } else if (whatsappData.length > 1) {
        botoes.push('<button class="btn-acao btn-whatsapp" data-index="' + idx + '" onclick="Economizei.UI.abrirModalWhatsapp(' + idx + ')" aria-label="Opções de WhatsApp para ' + Core.sanitize(nome) + '">WhatsApp</button>');
      }
      if (maps) botoes.push('<a href="' + maps + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-mapa" aria-label="Localização de ' + Core.sanitize(nome) + '">Localização</a>');
      if (cardapio) botoes.push('<a href="' + cardapio + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-cardapio" aria-label="Cardápio de ' + Core.sanitize(nome) + '">Cardápio</a>');
      if (site) botoes.push('<a href="' + site + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-site-pedido" aria-label="Site/Pedido de ' + Core.sanitize(nome) + '">Site/Pedido</a>');
      if (facebook) botoes.push('<a href="' + facebook + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-facebook" aria-label="Facebook de ' + Core.sanitize(nome) + '">Facebook</a>');
      if (instagram) botoes.push('<a href="' + instagram + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-instagram" aria-label="Instagram de ' + Core.sanitize(nome) + '">Instagram</a>');
      if (promocao) botoes.push('<a href="' + promocao + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-promocao" aria-label="Promoção de ' + Core.sanitize(nome) + '">🔥 Promoção</a>');
      if (estilo) botoes.push(montarBotaoModulo(estilo, idx));
      botoes.push('<button class="btn-acao btn-qrcode" onclick="abrirQRCode(event, \'' + Core.jsEscape(nome) + '\', \'' + qrCodeURL + '\', \'' + urlQRCode + '\')" aria-label="QR Code de ' + Core.sanitize(nome) + '">📱 QR Code</button>');

      var detalhesHTML = '';
      if (horarioDisplay) detalhesHTML += '<div class="detalhe-item"><strong>Horário:</strong> ' + Core.sanitize(horarioDisplay) + '</div>';
      if (delivery) detalhesHTML += '<div class="detalhe-item"><strong>Delivery:</strong> ' + Core.sanitize(delivery) + '</div>';
      if (consumo) detalhesHTML += '<div class="detalhe-item"><strong>Consumo Local:</strong> ' + Core.sanitize(consumo) + '</div>';
      if (observacao) detalhesHTML += '<div class="detalhe-item"><strong>Observações:</strong> ' + Core.sanitize(observacao) + '</div>';
      if (idUnico) detalhesHTML += '<div class="detalhe-item"><strong>ID Único:</strong> ' + Core.sanitize(idUnico) + '</div>';

      expanded.innerHTML =
        '<div class="card-expanded">' +
          '<div class="detalhes-grid">' + detalhesHTML + '</div>' +
          '<div class="avaliacao-section">' +
            '<div class="avaliacao-topo" data-index="' + idx + '" data-nome="' + Core.sanitize(nome) + '">' + authHTML + '</div>' +
            '<div class="avaliacao-estrelas" data-nome="' + Core.sanitize(nome) + '" data-index="' + idx + '" role="radiogroup" aria-label="Avaliar ' + Core.sanitize(nome) + '">' +
              Array.from({ length:5 }, function (_, i) {
                var ativa = i < avUser ? 'ativa' : '';
                return '<button class="estrela-btn ' + ativa + '" data-rating="' + (i+1) + '" data-index="' + idx + '" aria-label="' + (i+1) + ' estrela' + (i+1 > 1 ? 's' : '') + '" role="radio" aria-checked="' + (ativa ? 'true' : 'false') + '">★</button>';
              }).join('') +
            '</div>' +
            '<div class="avaliacao-mensagem" data-index="' + idx + '">' + (avUser ? 'Sua nota: ' + avUser + ' estrela' + (avUser > 1 ? 's' : '') : '') + '</div>' +
          '</div>' +
          '<div class="card-acoes">' + botoes.join('') + '</div>' +
        '</div>';

      todosCardsRenderizados.push({ card:card, expanded:expanded, index:idx });
    });

    document.getElementById('loading').style.display = 'none';
    var listaEl = document.getElementById('lista');
    listaEl.style.display = window.innerWidth <= 768 ? 'flex' : 'grid';
    if (window.innerWidth <= 768) listaEl.style.flexDirection = 'column';
    ativarInteracoesCards();
    if (dadosResolvidos) { dadosResolvidos(); dadosResolvidos = null; }
  }

  function abrirModalReservas(index) {
    var card = getCardByIndex(index);
    if (!card) return;
    var rData = JSON.parse(card.dataset.reservas || '[]');
    if (!rData.length) return;
    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true');
    modal.setAttribute('aria-label', 'Opções de Reserva');
    modal.innerHTML =
      '<div class="modal-conteudo modal-multis">' +
        '<div class="modal-header">' +
          '<h3><i class="fa-solid fa-calendar-check" aria-hidden="true"></i> Opções de Reserva</h3>' +
          '<button class="modal-close-btn" data-fechar aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="modal-body"><div id="listaReservasModal"></div></div>' +
      '</div>';
    document.body.appendChild(modal);
    var lista = modal.querySelector('#listaReservasModal');
    rData.forEach(function (r) {
      var a = document.createElement('a');
      a.href = r.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.className = 'item-opcao item-reserva';
      var host = '';
      try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch (e) {}
      a.innerHTML =
        '<span class="item-icone" aria-hidden="true"><i class="fa-solid fa-calendar-check"></i></span>' +
        '<span class="item-texto">' +
          '<span class="item-label">' + Core.sanitize(r.nome) + '</span>' +
          (host ? '<span class="item-sublabel">' + Core.sanitize(host) + '</span>' : '') +
        '</span>' +
        '<span class="item-seta" aria-hidden="true"><i class="fa-solid fa-chevron-right"></i></span>';
      lista.appendChild(a);
    });
    var ctrl = EU.criarModalAcessivel();
    ctrl.abrir(modal, function () { modal.remove(); });
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('[data-fechar]')) ctrl.fechar();
    });
  }

  function ativarInteracoesCards() {
    document.querySelectorAll('.card').forEach(function (c) {
      c.removeEventListener('click', handleCardClick); c.addEventListener('click', handleCardClick);
      c.removeEventListener('keydown', handleCardKeydown); c.addEventListener('keydown', handleCardKeydown);
    });
    document.querySelectorAll('.card-toggle').forEach(function (b) { b.removeEventListener('click', handleToggleClick); b.addEventListener('click', handleToggleClick); });
    document.querySelectorAll('.btn-favorito').forEach(function (b) { b.removeEventListener('click', handleFavoritoClick); b.addEventListener('click', handleFavoritoClick); });
    document.querySelectorAll('.estrela-btn').forEach(function (b) { b.removeEventListener('click', handleEstrelaClick); b.addEventListener('click', handleEstrelaClick); });
    document.querySelectorAll('.avaliacao-estrelas').forEach(function (container) {
      container.removeEventListener('mouseover', handleEstrelasMouseOver); container.addEventListener('mouseover', handleEstrelasMouseOver);
      container.removeEventListener('mouseout', handleEstrelasMouseOut); container.addEventListener('mouseout', handleEstrelasMouseOut);
      container.removeEventListener('focusin', handleEstrelasMouseOver); container.addEventListener('focusin', handleEstrelasMouseOver);
      container.removeEventListener('focusout', handleEstrelasMouseOut); container.addEventListener('focusout', handleEstrelasMouseOut);
    });
    document.querySelectorAll('.card-expanded-container').forEach(function (ex) { ex.removeEventListener('click', handleExpandedClick); ex.addEventListener('click', handleExpandedClick); });
    document.querySelectorAll('.link-entrar').forEach(function (l) { l.removeEventListener('click', handleLinkEntrarClick); l.addEventListener('click', handleLinkEntrarClick); });
    document.querySelectorAll('.link-sair').forEach(function (l) { l.removeEventListener('click', handleLinkSairClick); l.addEventListener('click', handleLinkSairClick); });
  }

  function handleCardClick(e) {
    if (e.target.closest('.btn-favorito, .card-toggle, .btn-qrcode, .btn-whatsapp, .btn-mapa, .btn-cardapio, .btn-catalogo, .btn-site, .btn-site-pedido, .btn-facebook, .btn-instagram, .btn-promocao, .btn-reserva, .btn-modulo, .badge-tooltip, .link-entrar, .link-sair')) return;
    toggleCardExpand(this);
  }
  function handleCardKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      if (e.target.closest('.btn-favorito, .card-toggle, .btn-qrcode, .btn-whatsapp, .btn-mapa, .btn-cardapio, .btn-catalogo, .btn-site, .btn-site-pedido, .btn-facebook, .btn-instagram, .btn-promocao, .btn-reserva, .btn-modulo, .badge-tooltip, .link-entrar, .link-sair')) return;
      e.preventDefault(); toggleCardExpand(this);
    }
  }
  function toggleCardExpand(card) {
    var expanded = card.nextElementSibling;
    if (!expanded || !expanded.classList.contains('card-expanded-container')) return;
    var btn = card.querySelector('.card-toggle');
    var isActive = expanded.classList.contains('active');
    if (isActive) {
      expanded.classList.remove('active');
      if (btn) { btn.textContent = 'Ver detalhes'; btn.setAttribute('aria-expanded','false'); }
      return;
    }
    document.querySelectorAll('.card-expanded-container.active').forEach(function (ex) {
      if (ex !== expanded) {
        ex.classList.remove('active');
        var otherCard = ex.previousElementSibling;
        if (otherCard) {
          var otherBtn = otherCard.querySelector('.card-toggle');
          if (otherBtn) { otherBtn.textContent = 'Ver detalhes'; otherBtn.setAttribute('aria-expanded','false'); }
        }
      }
    });
    expanded.classList.add('active');
    if (btn) { btn.textContent = 'Ocultar detalhes'; btn.setAttribute('aria-expanded','true'); }
    setTimeout(function () { expanded.scrollIntoView({ behavior:'smooth', block:'nearest' }); }, 50);
  }
  function handleToggleClick(e) { e.stopPropagation(); var card = this.closest('.card'); if (card) toggleCardExpand(card); }
  function handleFavoritoClick(e) { e.stopPropagation(); toggleFav(this); }
  function toggleFav(btn) {
    var nome = btn.dataset.nome; var card = btn.closest('.card');
    var isFav = toggleFavorito(nome);
    btn.classList.toggle('ativo', isFav);
    btn.innerHTML = isFav ? '♥' : '♡';
    btn.setAttribute('aria-label', (isFav ? 'Remover' : 'Adicionar') + ' ' + nome + ' dos favoritos');
    card.classList.toggle('card-favorito', isFav);
    aplicarFiltrosEOrdenacao();
  }
  function handleEstrelaClick(e) { e.stopPropagation(); rateEstrela(this); }
  function handleEstrelasMouseOver(e) {
    var btn = e.target.closest('.estrela-btn'); if (!btn) return;
    var container = this;
    var hoverRating = parseInt(btn.dataset.rating);
    container.querySelectorAll('.estrela-btn').forEach(function (s, i) { s.classList.toggle('preview', (i + 1) <= hoverRating); });
  }
  function handleEstrelasMouseOut(e) {
    var container = this;
    if (container.contains(e.relatedTarget)) return;
    container.querySelectorAll('.estrela-btn').forEach(function (s) { s.classList.remove('preview'); });
  }

  function gerarAuthHTML(idx, userOverride) {
    var user = (typeof userOverride !== 'undefined') ? userOverride : Core.getCurrentUser();
    if (user) {
      var nomeExibicao = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário');
      var primeiroNome = Core.sanitize(nomeExibicao.split(' ')[0]);
      var foto = user.photoURL ? '<img src="' + user.photoURL + '" class="foto-perfil" alt="Foto de perfil de ' + primeiroNome + '" loading="lazy" decoding="async" width="26" height="26">' : '';
      return '<div style="display:flex;align-items:center;">' + foto + '<span style="margin:0 4px;">olá ' + primeiroNome + '</span><span class="link-sair" data-index="' + idx + '" style="cursor:pointer;" role="button" tabindex="0">Sair</span></div>';
    }
    return '<span class="link-entrar" data-index="' + idx + '" style="cursor:pointer;" role="button" tabindex="0">Entrar</span>';
  }
  var notasEmSalvamento = {};
  function rateEstrela(btn) {
    var rating = parseInt(btn.dataset.rating);
    var idx = parseInt(btn.dataset.index);
    if (notasEmSalvamento[idx]) return;
    var container = btn.closest('.avaliacao-estrelas');
    var nome = container.dataset.nome;
    var user = Core.getCurrentUser();
    if (!user) { abrirLoginParaAcao({ idx:idx, nome:nome, rating:rating }); return; }
    aplicarNotaLocal(idx, rating);
    salvarNota(idx, nome, rating);
  }
  function aplicarNotaLocal(idx, rating) {
    var item = todosCardsRenderizados[idx]; if (!item) return;
    var container = item.expanded.querySelector('.avaliacao-estrelas');
    if (container) container.querySelectorAll('.estrela-btn').forEach(function (s, i) { s.classList.toggle('ativa', i < rating); s.setAttribute('aria-checked', i < rating ? 'true' : 'false'); });
    var msg = item.expanded.querySelector('.avaliacao-mensagem');
    if (msg) msg.textContent = 'Sua nota: ' + rating + ' estrela' + (rating > 1 ? 's' : '');
  }
  function atualizarExibicaoEstatisticas(idx, stats) {
    var item = todosCardsRenderizados[idx]; if (!item) return;
    var mediaF = stats.media > 0 ? stats.media.toFixed(1) : '0.0';
    var totalV = stats.total || 0;
    var estrelasHTML = Array.from({ length:5 }, function (_, i) { return '<span aria-hidden="true">' + (i < Math.round(stats.media) ? '★' : '☆') + '</span>'; }).join('');
    var estrelasEl = item.card.querySelector('.estrelas-header');
    var notaEl = item.card.querySelector('.nota-header');
    if (estrelasEl) { estrelasEl.innerHTML = estrelasHTML; estrelasEl.setAttribute('aria-label', 'Avaliação: ' + mediaF + ' estrelas, ' + totalV + ' ' + (totalV === 1 ? 'voto' : 'votos')); }
    if (notaEl) notaEl.textContent = mediaF + ' (' + totalV + ' ' + (totalV === 1 ? 'voto' : 'votos') + ')';
  }
  function salvarNota(idx, nome, rating) {
    notasEmSalvamento[idx] = true;
    var notaAnterior = avaliacoesUsuarioGlobais[nome] || 0;
    Core.salvarAvaliacaoFirebase(nome, rating).then(function () {
      var stats = estatisticasGlobais[nome] || { media:0, total:0 };
      var soma = stats.media * stats.total;
      if (notaAnterior > 0) { soma = soma - notaAnterior + rating; }
      else { soma = soma + rating; stats.total = stats.total + 1; }
      stats.media = stats.total > 0 ? soma / stats.total : 0;
      estatisticasGlobais[nome] = stats;
      avaliacoesUsuarioGlobais[nome] = rating;
      atualizarExibicaoEstatisticas(idx, stats);
      UI.mostrarToast('Avaliação salva. Obrigado!');
    }).catch(function (err) { UI.mostrarToast('Erro ao salvar avaliação: ' + err.message); })
      .finally(function () { notasEmSalvamento[idx] = false; });
  }
  function abrirLoginParaAcao(pending) {
    var modal = document.getElementById('modalAvisoLogin');
    var estaNoApp = !!(window.Android && typeof window.Android.iniciarLoginGoogle === 'function');
    var header = modal.querySelector('.modal-header');
    if (estaNoApp && header && !header.querySelector('.modal-close-btn')) {
      var btnX = document.createElement('button');
      btnX.type = 'button';
      btnX.className = 'modal-close-btn';
      btnX.setAttribute('aria-label', 'Fechar');
      btnX.textContent = '×';
      btnX.onclick = function () { UI.restoreFocus(); };
      header.appendChild(btnX);
    }
    UI.trapFocus(modal);
    var btnGoogle = document.getElementById('btnContinuarGoogle');
    btnGoogle.onclick = function () {
      UI.restoreFocus();
      Core.showLoginOverlay();
      var timeoutId = setTimeout(function () {
        Core.hideLoginOverlay();
        UI.mostrarToast('O login demorou demais. Tente novamente.');
      }, 30000);
      function finalizar() { clearTimeout(timeoutId); Core.hideLoginOverlay(); }
      Core.auth.signInWithPopup(Core.provider).then(function (result) {
        finalizar();
        finalizarLogin(result.user, pending);
      }).catch(function (err) {
        finalizar();
        if (err && (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request' || err.code === 'auth/user-cancelled')) return;
        if (err.code === 'auth/popup-blocked') UI.mostrarToast('O pop-up foi bloqueado. Permita pop-ups para este site.');
        else UI.mostrarToast('Erro ao fazer login: ' + (err.message || err));
      });
    };
    document.getElementById('btnCancelarAviso').onclick = function () { UI.restoreFocus(); };
  }
  function finalizarLogin(user, pending) {
    document.querySelectorAll('.avaliacao-topo').forEach(function (topo) {
      var idx = topo.dataset.index; topo.innerHTML = gerarAuthHTML(idx, user);
    });
    ativarInteracoesCards();
    Core.getAvaliacoesUsuario(user.uid).then(function (map) {
      avaliacoesUsuarioGlobais = map;
      document.querySelectorAll('.avaliacao-estrelas').forEach(function (container) {
        var nome = container.dataset.nome;
        var rating = avaliacoesUsuarioGlobais[nome] || 0;
        container.querySelectorAll('.estrela-btn').forEach(function (s, i) { var ativa = i < rating; s.classList.toggle('ativa', ativa); s.setAttribute('aria-checked', ativa ? 'true' : 'false'); });
        var msg = container.parentElement.querySelector('.avaliacao-mensagem');
        if (msg) msg.textContent = rating ? ('Sua nota: ' + rating + ' estrela' + (rating > 1 ? 's' : '')) : '';
      });
      if (pending) { aplicarNotaLocal(pending.idx, pending.rating); salvarNota(pending.idx, pending.nome, pending.rating); }
      UI.mostrarToast(pending ? 'Login realizado! Salvando sua avaliação...' : 'Login realizado com sucesso!');
    });
  }
  function handleExpandedClick(e) { if (e.target.closest('.btn-acao, .estrela-btn, .card-toggle, a, .link-entrar, .link-sair')) return; e.stopPropagation(); }
  function handleLinkEntrarClick(e) { e.stopPropagation(); abrirLoginParaAcao(null); }
  function handleLinkSairClick(e) {
    e.stopPropagation();
    Core.auth.signOut().then(function () {
      avaliacoesUsuarioGlobais = {};
      document.querySelectorAll('.avaliacao-topo').forEach(function (topo) { var idx = topo.dataset.index; topo.innerHTML = gerarAuthHTML(idx, null); });
      document.querySelectorAll('.avaliacao-estrelas').forEach(function (container) {
        container.querySelectorAll('.estrela-btn').forEach(function (s) { s.classList.remove('ativa'); s.setAttribute('aria-checked','false'); });
        var msg = container.parentElement.querySelector('.avaliacao-mensagem'); if (msg) msg.textContent = ''; });
      ativarInteracoesCards();
      UI.mostrarToast('Você saiu da sua conta.');
    }).catch(function (err) { UI.mostrarToast('Erro ao sair: ' + err.message); });
  }
  function getCardByIndex(idx) { var item = todosCardsRenderizados[idx]; return item ? item.card : null; }

  function carregarDados() {
    var csvUrl = CARDS_CFG.csvUrl;
    var cacheKey = CARDS_CFG.cacheKey;
    var cacheDuration = CARDS_CFG.cacheDuration;
    var loading = document.getElementById('loading');
    loading.style.display = 'flex';
    loading.innerHTML = '<div class="spinner" aria-hidden="true"></div><span>Carregando estabelecimentos...</span>';

    function finalizarComDados(dados) {
      dadosProcessados = dados;
      Core.authReady.then(function () {
        return Promise.all([Core.getEstatisticasAvaliacoes(), Core.getCurrentUser() ? Core.getAvaliacoesUsuario() : {}]);
      }).then(function (results) {
        estatisticasGlobais = results[0];
        avaliacoesUsuarioGlobais = results[1] || {};
        renderizarCards(estatisticasGlobais, avaliacoesUsuarioGlobais);
        tratarQRCodeURL();
        aplicarFiltroURL();
        aplicarFiltrosEOrdenacao();
        atualizarFichasFiltros();
        loading.style.display = 'none';
      });
    }

    var cache = EU.criarCacheCSV(cacheKey, cacheDuration);
    var dadosCacheados = cache.ler();
    if (dadosCacheados && dadosCacheados.length) {
      finalizarComDados(dadosCacheados);
      return;
    }

    fetch(csvUrl).then(function (response) {
      if (!response.ok) throw new Error('Erro HTTP ' + response.status);
      return response.text();
    }).then(function (texto) {
      var dadosCompletos = Utils.parseCSV(texto).slice(1);
      var ativos = dadosCompletos.filter(function (c) { return c[C.ATIVO] && c[C.ATIVO].toLowerCase() === 'sim'; });
      cache.salvar(ativos);
      finalizarComDados(ativos);
    }).catch(function (err) {
      console.error('Erro no carregamento:', err);
      var fallback = null;
      try { fallback = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) {}
      if (fallback && fallback.length) {
        finalizarComDados(fallback);
        UI.mostrarToast('⚠️ Dados desatualizados. Verifique sua conexão.');
        return;
      }
      loading.innerHTML = '<div class="estado-erro"><div class="estado-erro-icone" aria-hidden="true">⚠️</div><h3>Não foi possível carregar os estabelecimentos</h3><p>' + Core.sanitize(err.message) + '</p><button class="retry-button" onclick="Economizei.Cards.carregarDados()">Tentar novamente</button></div>';
    });
  }

  function tratarQRCodeURL() {
    if (!dadosProcessados.length) return;
    var params = new URLSearchParams(location.search);
    if (!params.has('qr')) return;
    var qrValue = params.get('qr').toLowerCase().trim().replace(/-+$/, '');
    var est = dadosProcessados.find(function (e) { return e[C.ID_UNICO] && e[C.ID_UNICO].toLowerCase().trim() === qrValue; });
    if (!est) est = dadosProcessados.find(function (e) {
      if (e[C.SLUG]) { var s = e[C.SLUG].toLowerCase().trim().replace(/-+$/, ''); return s === qrValue; }
      return false;
    });
    if (!est) est = dadosProcessados.find(function (e) {
      var sn = Core.gerarSlug(e[C.NOME]);
      return sn === qrValue || sn.replace(/-+$/, '') === qrValue;
    });
    if (!est) return;
    estabelecimentoViaQR = est;
    var cat = est[C.CATEGORIA];
    categoriaGlobal = cat;
    criarIndicadorQRCode(est[C.NOME], cat);
    var busca = document.getElementById('busca'); if (busca) busca.value = est[C.NOME];
    var idx = dadosProcessados.findIndex(function (e) { return e[C.NOME] === est[C.NOME]; });
    if (idx !== -1 && todosCardsRenderizados[idx]) {
      var cardEl = todosCardsRenderizados[idx].card;
      var expEl = todosCardsRenderizados[idx].expanded;
      if (cardEl && expEl) {
        var btn = cardEl.querySelector('.card-toggle');
        if (btn) { btn.textContent = 'Ocultar detalhes'; btn.setAttribute('aria-expanded','true'); }
        expEl.classList.add('active');
        setTimeout(function () { expEl.scrollIntoView({ behavior:'smooth', block:'start' }); }, 200);
      }
    }
  }

  return {
    configurar: configurar,
    registrarModulo: registrarModulo,
    dadosProntos: dadosProntos,
    get dadosProcessados() { return dadosProcessados; },
    getFavoritos:getFavoritos, toggleFavorito:toggleFavorito, estaVerificado:estaVerificado,
    criarIndicadorCategoria:criarIndicadorCategoria, criarIndicadorQRCode:criarIndicadorQRCode, fecharQRCode:fecharQRCode,
    mostrarMensagemSemResultados:mostrarMensagemSemResultados, renderizarPagina:renderizarPagina,
    aplicarFiltrosEOrdenacao:aplicarFiltrosEOrdenacao, atualizarFichasFiltros:atualizarFichasFiltros,
    adicionarFiltro:adicionarFiltro, removerFiltro:removerFiltro, limparTodosFiltros:limparTodosFiltros,
    abrirModalTiposFiltro:abrirModalTiposFiltro, abrirModalOpcoesFiltro:abrirModalOpcoesFiltro, aplicarFiltroURL:aplicarFiltroURL,
    abrirModalReservas:abrirModalReservas,
    togglePertoDeMim:togglePertoDeMim, abrirQRCode:abrirQRCode, renderizarCards:renderizarCards,
    ativarInteracoesCards:ativarInteracoesCards, getCardByIndex:getCardByIndex, carregarDados:carregarDados,
    set ordenarPorMedia(v) { ordenarPorMedia = v; }, get ordenarPorMedia() { return ordenarPorMedia; }
  };
})();

Economizei.Init = (function () {
  function iniciar() {
    var buscaInput = document.getElementById('busca');
    var btnLimparBusca = document.getElementById('btnLimparBusca');
    if (buscaInput && btnLimparBusca) {
      function toggleLimparBusca() {
        if (buscaInput.value.length > 0) btnLimparBusca.classList.add('visible');
        else btnLimparBusca.classList.remove('visible');
      }
      buscaInput.addEventListener('input', function () { toggleLimparBusca(); Economizei.Cards.aplicarFiltrosEOrdenacao(); });
      btnLimparBusca.addEventListener('click', function () {
        buscaInput.value = ''; toggleLimparBusca();
        Economizei.Cards.aplicarFiltrosEOrdenacao(); buscaInput.focus();
      });
      buscaInput.addEventListener('keypress', function (e) { if (e.key === 'Enter') { e.preventDefault(); this.blur(); } });
    }

    function onClick(id, handler) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('click', handler);
    }

    onClick('btnAdicionarFiltro', function () { Economizei.Cards.abrirModalTiposFiltro(); });
    onClick('btnLimparFiltros', function () { Economizei.Cards.limparTodosFiltros(); });
    onClick('btnPertoMim', function () { Economizei.Cards.togglePertoDeMim(); });
    onClick('btnFecharModal', function () { Economizei.UI.restoreFocus(); });
    onClick('btnFecharModalOpcoes', function () { Economizei.UI.restoreFocus(); });
    onClick('btnFecharModalWhatsapp', function () { Economizei.UI.restoreFocus(); });
    document.querySelectorAll('.modal-overlay').forEach(function (m) {
      m.addEventListener('click', function (e) {
        if (e.target === this) { Economizei.UI.restoreFocus(); }
      });
    });
    onClick('btnMelhoresAvaliados', function () {
      Economizei.Cards.ordenarPorMedia = !Economizei.Cards.ordenarPorMedia;
      Economizei.Cards.aplicarFiltrosEOrdenacao();
    });
    window.addEventListener('resize', function () {
      var lista = document.getElementById('lista');
      if (lista) lista.style.display = window.innerWidth <= 768 ? 'flex' : 'grid';
    });

    document.addEventListener('click', function (e) {
      var b = e.target.closest('.botao-fechar-qr');
      if (b) Economizei.Cards.fecharQRCode(b.dataset.categoria);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var modais = document.querySelectorAll('.modal-overlay[style*="display: flex"], .modal-overlay[style*="display:flex"], .modal-imagem-full, .popup-confirmacao');
      if (modais.length === 0) return;
      var ultimo = modais[modais.length - 1];
      if (ultimo.classList.contains('modal-imagem-full') || ultimo.classList.contains('popup-confirmacao')) {
        ultimo.remove();
      } else {
        ultimo.style.display = 'none';
      }
      Economizei.UI.restoreFocus();
    });
  }
  return { iniciar:iniciar };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function () {
    Economizei.Init.iniciar();
    Economizei.Cards.carregarDados();
  });
} else {
  Economizei.Init.iniciar();
  Economizei.Cards.carregarDados();
}

window.abrirQRCode = Economizei.Cards.abrirQRCode;
window.togglePertoDeMim = Economizei.Cards.togglePertoDeMim;
window.abrirModalReservas = Economizei.Cards.abrirModalReservas;

})();
