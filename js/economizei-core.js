/* ============================================================
   economizei-core.js
   Código compartilhado entre TODAS as páginas de grupo do guia
   comercial (Economizei! Rio Claro). Carregar SEMPRE antes de
   qualquer arquivo de módulo (economizei-pedidos.js, etc).

   Extraído da página "Onde Comer" (versão sem módulo) em
   ago/2026. Mudanças em relação ao original, para correção de
   bugs identificados em revisão:

   1. Core.jsEscape(str) — nova função. Escapa aspas simples e
      barras invertidas para uso seguro dentro de literais de
      string JS gerados via concatenação (onclick="...('...')").
      Nomes de estabelecimento com apóstrofo (ex. "Maria D'Ávila")
      quebravam o HTML gerado antes desta correção.
   2. Horario.COLUNAS ganhou o campo ESTILO (coluna 31), usado
      pelos módulos (Pedidos, Loja, Transporte) para saber que
      tipo de botão de ação exibir no card.
   3. Cards.renderizarCardsGaveta agora decide o botão de módulo
      de forma genérica: olha o valor de ESTILO e verifica se o
      módulo correspondente (Economizei.Pedido / .Loja /
      .Transporte) está carregado na página, em vez de cada
      página precisar de lógica própria. Módulo não carregado =
      nenhum botão extra (comportamento idêntico ao anterior).
   4. O listener de tecla Escape (na inicialização, no fim do
      arquivo) agora fecha também modais que os módulos podem
      criar dinamicamente (ex. modal de imagem em tela cheia do
      módulo Pedidos, popups de confirmação), não só os
      ".modal-overlay" fixos da página. Antes, Esc não fechava
      esses modais dinâmicos.
   ============================================================ */

var Economizei = Economizei || {};

// ============================================================
// MÓDULO CORE
// ============================================================
Economizei.Core = (function() {
    var firebaseConfig = {
        apiKey: "AIzaSyDrNlMrrlYJhC78ALOBUdr8bSJ7ykLs_O4",
        authDomain: "economizeirioclaro.firebaseapp.com",
        projectId: "economizeirioclaro",
        storageBucket: "economizeirioclaro.firebasestorage.app",
        messagingSenderId: "243852155427",
        appId: "1:243852155427:web:57bcc18ca6b329f1bc6f96"
    };
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    var db = firebase.firestore();
    var auth = firebase.auth();
    var provider = new firebase.auth.GoogleAuthProvider();

    var currentUser = null;
    var userPhotoURL = '';
    var userDisplayName = '';
    var authReadyResolve;
    var authReady = new Promise(function(resolve) { authReadyResolve = resolve; });

    auth.onAuthStateChanged(function(user) {
        currentUser = user;
        if (user) {
            userPhotoURL = user.photoURL || '';
            userDisplayName = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário');
        } else {
            userPhotoURL = '';
            userDisplayName = '';
        }
        authReadyResolve();
    });

    function getCurrentUser() { return currentUser; }
    function getUserPhotoURL() { return userPhotoURL; }
    function getUserDisplayName() { return userDisplayName; }

    // Escapa para inserção segura em innerHTML (contexto HTML).
    function sanitize(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;'); }

    // NOVO: escapa para inserção segura dentro de um literal de
    // string JS (ex. onclick="minhaFuncao('" + Core.jsEscape(nome) + "')").
    // Sem isso, nomes com aspas simples ou barra invertida quebram
    // o atributo onclick gerado (erro de sintaxe JS silencioso).
    function jsEscape(str) { if (!str) return ''; return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }

    function ensureHttps(url) { return url && !url.startsWith('http') ? 'https://' + url : url; }
    function gerarSlug(texto) { if (!texto) return ''; return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim(); }
    function formatarTelefone(numero) { if (!numero) return ''; var n = numero.replace(/\D/g, ''); if (n.startsWith('55')) n = n.slice(2); if (n.length >= 10) return '(' + n.slice(0,2) + ') ' + n.slice(2,7) + '-' + n.slice(7,11); return numero; }
    function sanitizarWhatsapp(numero) { if (!numero) return ''; var limpo = numero.replace(/\D/g, ''); if (!limpo) return ''; if (!limpo.startsWith('55')) limpo = '55' + limpo; return limpo; }
    function showLoginOverlay() { document.getElementById('loginOverlay').style.display = 'flex'; }
    function hideLoginOverlay() { document.getElementById('loginOverlay').style.display = 'none'; }

    async function getEstatisticasAvaliacoes() { try { var snap = await db.collection('avaliacoes').get(); var stats = {}; snap.forEach(function(doc) { var data = doc.data(); var id = data.estabelecimentoId; if (!stats[id]) stats[id] = { soma:0, total:0 }; stats[id].soma += data.pontuacao; stats[id].total += 1; }); var res = {}; for (var id in stats) { res[id] = { media: stats[id].soma / stats[id].total, total: stats[id].total }; } return res; } catch (e) { return {}; } }
    async function getAvaliacoesUsuario(uidOverride) { var uid = uidOverride || (currentUser && currentUser.uid); if (!uid) return {}; try { var snap = await db.collection('avaliacoes').where('userId', '==', uid).get(); var map = {}; snap.forEach(function(doc) { map[doc.data().estabelecimentoId] = doc.data().pontuacao; }); return map; } catch (e) { return {}; } }
    async function salvarAvaliacaoFirebase(id, rating) { if (!currentUser) return; try { await db.collection('avaliacoes').doc(currentUser.uid + '_' + id).set({ userId: currentUser.uid, estabelecimentoId: id, pontuacao: rating, timestamp: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true }); } catch (e) { console.error(e); } }
    function salvarPosicaoEAntesRecarregar() { sessionStorage.setItem('scrollPos', window.scrollY); var exp = document.querySelector('.card-expanded-container.active'); if (exp) sessionStorage.setItem('expandedIndex', exp.dataset.index); else sessionStorage.removeItem('expandedIndex'); location.reload(); }
    function restaurarPosicao() { var sp = sessionStorage.getItem('scrollPos'); var ei = sessionStorage.getItem('expandedIndex'); if (sp) { window.scrollTo(0, parseInt(sp)); sessionStorage.removeItem('scrollPos'); } if (ei !== null) { setTimeout(function() { var exp = document.querySelector('.card-expanded-container[data-index="' + ei + '"]'); if (exp) { var card = exp.previousElementSibling; if (card) { var btn = card.querySelector('.card-toggle'); if (btn) btn.textContent = 'Ocultar detalhes'; exp.classList.add('active'); } } sessionStorage.removeItem('expandedIndex'); }, 100); } }

    return {
        db:db, auth:auth, provider:provider, authReady:authReady,
        getCurrentUser:getCurrentUser, getUserPhotoURL:getUserPhotoURL, getUserDisplayName:getUserDisplayName,
        sanitize:sanitize, jsEscape:jsEscape, ensureHttps:ensureHttps, gerarSlug:gerarSlug,
        formatarTelefone:formatarTelefone, sanitizarWhatsapp:sanitizarWhatsapp,
        showLoginOverlay:showLoginOverlay, hideLoginOverlay:hideLoginOverlay,
        getEstatisticasAvaliacoes:getEstatisticasAvaliacoes, getAvaliacoesUsuario:getAvaliacoesUsuario,
        salvarAvaliacaoFirebase:salvarAvaliacaoFirebase, salvarPosicaoEAntesRecarregar:salvarPosicaoEAntesRecarregar,
        restaurarPosicao:restaurarPosicao
    };
})();

// ============================================================
// MÓDULO UTILS
// ============================================================
Economizei.Utils = (function() {
    var Core = Economizei.Core;
    function parseCSV(texto) { var linhas = [], dentroAspas = false, campo = '', linha = []; for (var i = 0; i < texto.length; i++) { var c = texto[i], p = texto[i+1]; if (c === '"') { if (!dentroAspas) dentroAspas = true; else if (p === '"') { campo += '"'; i++; } else dentroAspas = false; } else if (c === ',' && !dentroAspas) { linha.push(campo); campo = ''; } else if ((c === '\n' || c === '\r') && !dentroAspas) { if (campo || linha.length) { linha.push(campo); linhas.push(linha); } campo = ''; linha = []; if (c === '\r' && p === '\n') i++; } else campo += c; } if (campo || linha.length) { linha.push(campo); linhas.push(linha); } return linhas; }
    function splitValores(val) { if (!val) return []; return val.split(',').map(function(v) { return v.trim(); }).filter(function(v) { return v !== ''; }); }
    function valorAtendeFiltro(cel, filtro) { var vals = splitValores(cel); return vals.indexOf(filtro) !== -1; }
    function calcularDistancia(lat1, lon1, lat2, lon2) { var R = 6371; var dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180; var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2); return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); }
    function formatarDistancia(km) { return km < 1 ? Math.round(km*1000) + ' m' : km.toFixed(1) + ' km'; }
    function isClosedValue(valor) { if (!valor) return true; var str = String(valor).trim().toLowerCase(); return str === '' || str === 'não' || str === 'nao'; }
    function gerarURLQRCode(nome, urlBase) { return urlBase + '?qr=' + Core.gerarSlug(nome); }
    function gerarImagemQRCode(nome, urlBase, tamanho) { tamanho = tamanho || 200; return 'https://api.qrserver.com/v1/create-qr-code/?size=' + tamanho + 'x' + tamanho + '&data=' + encodeURIComponent(gerarURLQRCode(nome, urlBase)); }
    return { parseCSV:parseCSV, splitValores:splitValores, valorAtendeFiltro:valorAtendeFiltro, calcularDistancia:calcularDistancia, formatarDistancia:formatarDistancia, isClosedValue:isClosedValue, gerarURLQRCode:gerarURLQRCode, gerarImagemQRCode:gerarImagemQRCode };
})();

// ============================================================
// MÓDULO HORARIO
// ============================================================
Economizei.Horario = (function() {
    var Utils = Economizei.Utils;
    var COLUNAS = {
        NOME:0, CATEGORIA:1, SUBCATEGORIA:2, DISTRITO:3, IMAGEM:4, WHATSAPP:5, MAPS:6,
        HORARIO:7, DELIVERY:8, CONSUMO:9, OBSERVACAO:10, CARDAPIO:11, ATIVO:12,
        ID_UNICO:13, SLUG:14, URL_QR_CODE:15, LATITUDE:16, LONGITUDE:17,
        VERIFICADO:18, DATA_VERIFICACAO:19, SITE:20, FACEBOOK:21, INSTAGRAM:22, PROMOCAO:23,
        HORARIO_SEG:24, HORARIO_TER:25, HORARIO_QUA:26, HORARIO_QUI:27,
        HORARIO_SEX:28, HORARIO_SAB:29, HORARIO_DOM:30,
        ESTILO:31 /* NOVO: qual módulo essa linha usa ('pedido','loja','transporte' ou vazio) */
    };

    function getHorarioParaDia(est, dia) {
        var col;
        switch (dia) {
            case 0: col = COLUNAS.HORARIO_DOM; break;
            case 1: col = COLUNAS.HORARIO_SEG; break;
            case 2: col = COLUNAS.HORARIO_TER; break;
            case 3: col = COLUNAS.HORARIO_QUA; break;
            case 4: col = COLUNAS.HORARIO_QUI; break;
            case 5: col = COLUNAS.HORARIO_SEX; break;
            case 6: col = COLUNAS.HORARIO_SAB; break;
            default: return null;
        }
        var val = est[col];
        if (!Utils.isClosedValue(val)) return val.trim();
        return null;
    }
    function getHorarioPorDia(est) { var hoje = new Date().getDay(); var esp = getHorarioParaDia(est, hoje); if (esp !== null) return esp; var gen = est[COLUNAS.HORARIO]; return Utils.isClosedValue(gen) ? null : gen.trim(); }
    function formatHorarioDisplay(est) {
        var dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
        var hrs = [];
        for (var i = 0; i <= 6; i++) { var h = getHorarioParaDia(est, i); if (h) hrs.push(dias[i] + ': ' + h); }
        if (hrs.length === 0) { var g = est[COLUNAS.HORARIO]; return (!g || Utils.isClosedValue(g)) ? 'Horário não informado' : g.trim(); }
        return hrs.join(' | ');
    }
    function analisarHorario(hr) {
        if (!hr) return null;
        var h = hr.trim().toLowerCase();
        if (h.indexOf('marcado') !== -1 || h.indexOf('agendamento') !== -1 || h.indexOf('consultar') !== -1 || h.indexOf('combinar') !== -1 || h.indexOf('agendar') !== -1) return { isMarcado:true, aberto:null, fechaEmBreve:false, horarioFechamento:null };
        if (h === '24h' || h === '0h-24h' || h === '0:00-24:00') return { is24h:true, aberto:true, fechaEmBreve:false, horarioFechamento:null };
        var agora = new Date(); var agoraMin = agora.getHours()*60 + agora.getMinutes();
        var turnos = hr.split('/').map(function(t) { return t.trim(); });
        for (var i = 0; i < turnos.length; i++) {
            var match = turnos[i].match(/(\d{1,2})(?:h|:)?(\d{0,2})\s*-\s*(\d{1,2})(?:h|:)?(\d{0,2})/);
            if (!match) continue;
            var iniH = parseInt(match[1],10), iniM = match[2] ? parseInt(match[2],10) : 0;
            var fimH = parseInt(match[3],10), fimM = match[4] ? parseInt(match[4],10) : 0;
            var iniMin = iniH*60 + iniM; var fimMin = fimH*60 + fimM;
            if (fimH === 0 && fimM === 0) fimMin = 24*60;
            var aberto = false, rest = Infinity, fechamento = null;
            if (iniMin <= fimMin) { if (agoraMin >= iniMin && agoraMin <= fimMin) { aberto = true; rest = fimMin - agoraMin; fechamento = String(fimH).padStart(2,'0') + ':' + String(fimM).padStart(2,'0'); } }
            else { if (agoraMin >= iniMin || agoraMin <= fimMin) { aberto = true; rest = (agoraMin >= iniMin) ? ((24*60 - agoraMin) + fimMin) : (fimMin - agoraMin); fechamento = String(fimH === 0 ? 0 : fimH).padStart(2,'0') + ':' + String(fimM).padStart(2,'0'); } }
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
        if (res.fechaEmBreve) return { status:'breve', texto:'Fecha em breve ('+res.horarioFechamento+')', cor:'status-breve' };
        return { status:'aberto', texto:'Aberto agora', cor:'status-aberto' };
    }
    return { COLUNAS:COLUNAS, getHorarioPorDia:getHorarioPorDia, formatHorarioDisplay:formatHorarioDisplay, getStatusHorario:getStatusHorario, isClosedValue:Utils.isClosedValue };
})();

// ============================================================
// MÓDULO UI
// ============================================================
Economizei.UI = (function() {
    var Core = Economizei.Core;
    var lastFocusedElement = null;

    function mostrarToast(msg) { var t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; t.setAttribute('role','alert'); t.setAttribute('aria-live','assertive'); document.body.appendChild(t); setTimeout(function() { t.remove(); }, 2400); }

    function abrirModalWhatsapp(index) {
        var card = Economizei.Cards.getCardByIndex(index);
        if (!card) return;
        var wData = JSON.parse(card.dataset.whatsapp || '[]');
        if (!wData.length) return;
        var modal = document.getElementById('modalWhatsapp');
        document.getElementById('modalWhatsappTitulo').textContent = 'WhatsApp - ' + card.dataset.nome;
        var lista = document.getElementById('listaWhatsapp'); lista.innerHTML = '';
        wData.forEach(function(w) { var a = document.createElement('a'); a.href = 'https://wa.me/' + w.numero; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.className = 'item-whatsapp'; a.textContent = w.nome ? w.nome : Core.formatarTelefone(w.numero); a.setAttribute('aria-label', 'WhatsApp ' + (w.nome ? w.nome : Core.formatarTelefone(w.numero))); lista.appendChild(a); });
        modal.style.display = 'flex';
        trapFocus(modal);
    }

    function trapFocus(modal) { lastFocusedElement = document.activeElement; var focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'); if (focusable.length > 0) focusable[0].focus(); }
    function restoreFocus() { if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') lastFocusedElement.focus(); lastFocusedElement = null; }

    return { mostrarToast:mostrarToast, abrirModalWhatsapp:abrirModalWhatsapp, trapFocus:trapFocus, restoreFocus:restoreFocus };
})();

// ============================================================
// MÓDULO CARDS
// (mapeamentoExato, TIPOS_FILTRO_VISIVEIS, paginaCategorias, csvUrl
//  e cacheKey continuam configuráveis por página — ver Economizei.Cards.configurar)
// ============================================================
Economizei.Cards = (function() {
    var Core = Economizei.Core;
    var Utils = Economizei.Utils;
    var Horario = Economizei.Horario;
    var UI = Economizei.UI;
    var COLUNAS = Horario.COLUNAS;

    // Config default; cada página chama Economizei.Cards.configurar({...})
    // ANTES de Economizei.Cards.carregarDados() para personalizar.
    var cfg = {
        csvUrl: '',
        cacheKey: 'economizeiCacheGrupo',
        cacheDuration: 3600000,
        paginaCategorias: 'https://www.economizeirioclaro.com.br/p/categorias.html',
        paginaCadastro: 'https://www.economizeirioclaro.com.br/p/cadastro.html',
        paginaAtualUrl: '', // usada para montar o link do QR Code (?qr=slug)
        favoritosKey: 'economizeiFavoritosGrupo',
        mapeamentoExato: {},
        tiposFiltroVisiveis: {
            SUBCATEGORIA: { id:'subcategoria', nome:'Subcategoria', coluna:COLUNAS.SUBCATEGORIA },
            DISTRITO: { id:'distrito', nome:'Distrito', coluna:COLUNAS.DISTRITO },
            DELIVERY: { id:'delivery', nome:'Delivery', coluna:COLUNAS.DELIVERY },
            CONSUMO: { id:'consumo', nome:'Consumo Local', coluna:COLUNAS.CONSUMO }
        },
        imagemFallback: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&h=300&fit=crop'
    };
    function configurar(opcoes) { Object.assign(cfg, opcoes || {}); }

    var dadosProcessados = [];
    var todosCardsRenderizados = [];
    var listaFiltradaIndices = [];
    var filtrosAtivos = new Map();
    var categoriaGlobal = null;
    var estabelecimentoViaQR = null;
    var pertoMimAtivo = false;
    var usuarioPosicao = null;
    var ordenarPorMedia = false;
    var cardsPorPagina = 20;
    var paginaAtual = 1;
    var vigiaScroll = null;
    var estatisticasGlobais = {};
    var avaliacoesUsuarioGlobais = {};

    var dadosResolvidos;
    var dadosProntos = new Promise(function(resolve) { dadosResolvidos = resolve; }); // usado por módulos (ex. Pedido.abrirModal aguarda isso)

    function getFavoritos() { try { return JSON.parse(localStorage.getItem(cfg.favoritosKey)) || []; } catch(e) { return []; } }
    function toggleFavorito(nome) { var fav = getFavoritos(); var idx = fav.indexOf(nome); if (idx > -1) fav.splice(idx,1); else fav.push(nome); localStorage.setItem(cfg.favoritosKey, JSON.stringify(fav)); return fav.indexOf(nome) !== -1; }
    function estaVerificado(c) { var v = c[COLUNAS.VERIFICADO] && c[COLUNAS.VERIFICADO].toLowerCase() === 'sim'; var dataStr = c[COLUNAS.DATA_VERIFICACAO]; if (!v || !dataStr) return false; var data = null; if (dataStr.indexOf('/') !== -1) { var partes = dataStr.split('/'); if (partes.length === 3) data = new Date(parseInt(partes[2],10), parseInt(partes[1],10)-1, parseInt(partes[0],10)); } else if (dataStr.indexOf('-') !== -1) data = new Date(dataStr + 'T00:00:00'); if (!data || isNaN(data.getTime())) return false; return (new Date() - data) < 365*24*60*60*1000; }
    function getDataVerificacao(c) { var dataStr = c[COLUNAS.DATA_VERIFICACAO]; if (!dataStr) return null; if (dataStr.indexOf('/') !== -1) { var partes = dataStr.split('/'); if (partes.length === 3) return new Date(parseInt(partes[2],10), parseInt(partes[1],10)-1, parseInt(partes[0],10)); } else if (dataStr.indexOf('-') !== -1) return new Date(dataStr + 'T00:00:00'); return null; }
    function compararPorDataVerificacao(a, b) { var da = getDataVerificacao(dadosProcessados[a]); var db_ = getDataVerificacao(dadosProcessados[b]); if (!da && !db_) return 0; if (!da) return 1; if (!db_) return -1; return da - db_; }
    function colunaTemValores(col) { var filt = categoriaGlobal ? dadosProcessados.filter(function(it) { return it[COLUNAS.CATEGORIA] === categoriaGlobal; }) : dadosProcessados; return filt.some(function(it) { var v = it[col]; return v && Utils.splitValores(v).length > 0; }); }
    function obterOpcoesFiltro(tipoInfo) { var set = new Set(); var filt = categoriaGlobal ? dadosProcessados.filter(function(it) { return it[COLUNAS.CATEGORIA] === categoriaGlobal; }) : dadosProcessados; filt.forEach(function(it) { var v = it[tipoInfo.coluna]; if (v) Utils.splitValores(v).forEach(function(item) { set.add(item); }); }); return Array.from(set).sort(); }
    function criarIndicadorCategoria(cat) { document.getElementById('indicadorCategoriaContainer').innerHTML = '<div class="indicador-categoria-selecionada"><div class="categoria-info"><div class="categoria-icone" aria-hidden="true">📋</div><div class="categoria-texto"><span class="categoria-titulo">Você está explorando</span><span class="categoria-nome">' + Core.sanitize(cat) + '</span></div></div><a href="' + cfg.paginaCategorias + '" class="botao-voltar-categorias">← Voltar para página de categorias</a></div>'; }
    function criarIndicadorQRCode(nome, categoria) { document.getElementById('indicadorQRCodeContainer').innerHTML = '<div class="indicador-qr-code"><div class="qr-code-info"><div class="qr-code-icone" aria-hidden="true">📱</div><div class="qr-code-texto"><span class="qr-code-titulo">Você escaneou um QR Code</span><span class="qr-code-nome">' + Core.sanitize(nome) + '</span></div></div><button class="botao-fechar-qr" onclick="Economizei.Cards.fecharQRCode(\'' + Core.jsEscape(categoria) + '\')">← Voltar para ' + Core.sanitize(categoria) + '</button></div>'; }
    function fecharQRCode(categoria) { document.getElementById('indicadorQRCodeContainer').innerHTML = ''; estabelecimentoViaQR = null; document.getElementById('busca').value = ''; var url = new URL(window.location); url.searchParams.delete('qr'); window.history.replaceState({}, '', url); if (categoria) { document.getElementById('indicadorCategoriaContainer').innerHTML = ''; categoriaGlobal = categoria; criarIndicadorCategoria(categoria); } else { categoriaGlobal = null; document.getElementById('indicadorCategoriaContainer').innerHTML = ''; } aplicarFiltrosEOrdenacao(); }

    function mostrarMensagemSemResultados() {
        var lista = document.getElementById('lista');
        if (lista.querySelector('.sem-resultados')) return;
        var params = new URLSearchParams(location.search);
        var hasCat = !!categoriaGlobal || params.has('cat');
        var temBusca = document.getElementById('busca').value.trim() !== '';
        var temOutrosFiltros = filtrosAtivos.size > 0;

        if (hasCat && !temBusca && !temOutrosFiltros) {
            lista.innerHTML += '<div class="sem-resultados sem-resultados-cadastro">' +
                '<div style="font-size:2rem;margin-bottom:0.5rem;" aria-hidden="true">🍽️</div>' +
                '<h3>Ainda não há estabelecimentos cadastrados nesta categoria</h3>' +
                '<p>Se você tem um negócio nesta categoria em Rio Claro, seja o primeiro a aparecer aqui!</p>' +
                '<a href="' + cfg.paginaCadastro + '" target="_blank" rel="noopener noreferrer" class="btn-cadastro-cta">📋 Cadastrar meu estabelecimento</a><br>' +
                '<button onclick="window.location.href=\'' + cfg.paginaCategorias + '\'" class="btn-adicionar-filtro" style="border-radius:2rem; border:none; padding:0.5rem 1rem; cursor:pointer;">← Voltar para categorias</button>' +
                '</div>';
            return;
        }

        var botao = hasCat
            ? '<button onclick="window.location.href=\'' + cfg.paginaCategorias + '\'" class="btn-adicionar-filtro" style="border-radius:2rem; border:none; padding:0.5rem 1rem; cursor:pointer;">← Voltar para categorias</button>'
            : '<button onclick="Economizei.Cards.limparTodosFiltros()" class="btn-adicionar-filtro" style="border-radius:2rem; border:none; padding:0.5rem 1rem; cursor:pointer;">↺ Limpar Filtros</button>';
        lista.innerHTML += '<div class="sem-resultados"><div style="font-size:2rem;margin-bottom:0.5rem;color:#d97706;" aria-hidden="true">🔍</div><h3>Nenhum estabelecimento encontrado</h3><p>Tente alterar os filtros de busca.</p>' + botao + '</div>';
    }

    function renderizarPagina() { var lista = document.getElementById('lista'); lista.innerHTML = ''; var fim = paginaAtual * cardsPorPagina; var indices = listaFiltradaIndices.slice(0, fim); indices.forEach(function(idx) { var item = todosCardsRenderizados[idx]; if (item) { lista.appendChild(item.card); lista.appendChild(item.expanded); } }); ativarInteracoesCards(); if (fim < listaFiltradaIndices.length) colocarEspiao(); else if (vigiaScroll) { vigiaScroll.disconnect(); vigiaScroll = null; } if (listaFiltradaIndices.length === 0) mostrarMensagemSemResultados(); }
    function colocarEspiao() { if (vigiaScroll) { vigiaScroll.disconnect(); vigiaScroll = null; } var espiao = document.createElement('div'); espiao.id = 'espiao'; espiao.style.height = '10px'; espiao.style.width = '100%'; espiao.setAttribute('aria-hidden','true'); document.getElementById('lista').appendChild(espiao); vigiaScroll = new IntersectionObserver(function(entries) { if (entries[0].isIntersecting) { paginaAtual++; renderizarPagina(); } }); vigiaScroll.observe(espiao); }

    function aplicarFiltrosEOrdenacao() {
        if (!dadosProcessados.length || !todosCardsRenderizados.length) return;
        var indicesFiltrados = [];
        var busca = document.getElementById('busca').value.toLowerCase().trim();
        dadosProcessados.forEach(function(est, idx) {
            if (estabelecimentoViaQR) { if (est[COLUNAS.NOME] === estabelecimentoViaQR[COLUNAS.NOME]) indicesFiltrados.push(idx); return; }
            if (busca && !est[COLUNAS.NOME].toLowerCase().includes(busca)) return;
            if (categoriaGlobal && est[COLUNAS.CATEGORIA] !== categoriaGlobal) return;
            var ok = true;
            filtrosAtivos.forEach(function(valor, tipo) { var info = Object.values(cfg.tiposFiltroVisiveis).find(function(t) { return t.id === tipo; }); if (info) { var cel = est[info.coluna] || ''; if (!Utils.valorAtendeFiltro(cel, valor)) ok = false; } });
            if (!ok) return;
            indicesFiltrados.push(idx);
        });

        if (ordenarPorMedia) {
            indicesFiltrados.sort(function(a, b) { var ma = (estatisticasGlobais[dadosProcessados[a][COLUNAS.NOME]] || {}).media || 0; var mb = (estatisticasGlobais[dadosProcessados[b][COLUNAS.NOME]] || {}).media || 0; return mb - ma; });
            listaFiltradaIndices = indicesFiltrados; paginaAtual = 1; if (vigiaScroll) { vigiaScroll.disconnect(); vigiaScroll = null; } renderizarPagina(); return;
        }

        var indicesVerificados = indicesFiltrados.filter(function(idx) { return estaVerificado(dadosProcessados[idx]); }).sort(function(a,b) { return compararPorDataVerificacao(a,b); });
        var indicesNaoVerificados = indicesFiltrados.filter(function(idx) { return !estaVerificado(dadosProcessados[idx]); });
        var favoritos = getFavoritos();
        var verFav = indicesVerificados.filter(function(idx) { return favoritos.indexOf(dadosProcessados[idx][COLUNAS.NOME]) !== -1; });
        var verNaoFav = indicesVerificados.filter(function(idx) { return favoritos.indexOf(dadosProcessados[idx][COLUNAS.NOME]) === -1; });
        var naoVerFav = indicesNaoVerificados.filter(function(idx) { return favoritos.indexOf(dadosProcessados[idx][COLUNAS.NOME]) !== -1; });
        var naoVerNaoFav = indicesNaoVerificados.filter(function(idx) { return favoritos.indexOf(dadosProcessados[idx][COLUNAS.NOME]) === -1; });

        if (pertoMimAtivo && usuarioPosicao) {
            var ordenarDist = function(l) { return l.map(function(idx) { var est = dadosProcessados[idx]; var lat = parseFloat(est[COLUNAS.LATITUDE]), lng = parseFloat(est[COLUNAS.LONGITUDE]); var dist = Infinity; if (!isNaN(lat) && !isNaN(lng)) dist = Utils.calcularDistancia(usuarioPosicao.lat, usuarioPosicao.lng, lat, lng); return { idx:idx, dist:dist }; }).sort(function(a,b) { return a.dist-b.dist; }).map(function(item) { return item.idx; }); };
            listaFiltradaIndices = [].concat(ordenarDist(verFav), ordenarDist(verNaoFav), ordenarDist(naoVerFav), ordenarDist(naoVerNaoFav));
        } else {
            listaFiltradaIndices = [].concat(verFav, verNaoFav, naoVerFav, naoVerNaoFav);
        }
        paginaAtual = 1; if (vigiaScroll) { vigiaScroll.disconnect(); vigiaScroll = null; } renderizarPagina();
    }

    function atualizarFichasFiltros() { var lista = document.getElementById('filtrosAtivosLista'); lista.innerHTML = ''; filtrosAtivos.forEach(function(valor, tipo) { if (tipo === 'categoria') return; var info = Object.values(cfg.tiposFiltroVisiveis).find(function(t) { return t.id === tipo; }); if (!info) return; var f = document.createElement('div'); f.className = 'ficha-filtro'; f.setAttribute('role','button'); f.setAttribute('tabindex','0'); f.setAttribute('aria-label', 'Remover filtro ' + info.nome + ': ' + valor); f.innerHTML = '<span class="ficha-filtro-tipo">' + info.nome + '</span>: ' + Core.sanitize(valor) + '<button class="ficha-filtro-remover" data-tipo="' + tipo + '" aria-label="Remover filtro ' + valor + '">×</button>'; f.querySelector('.ficha-filtro-remover').onclick = function(e) { e.stopPropagation(); removerFiltro(tipo); }; f.onclick = function(e) { if (!e.target.classList.contains('ficha-filtro-remover')) abrirModalOpcoesFiltro(tipo); }; f.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); f.click(); } }); lista.appendChild(f); }); }
    function adicionarFiltro(tipo, valor) { if (tipo === 'categoria') { categoriaGlobal = valor; criarIndicadorCategoria(valor); } else { filtrosAtivos.set(tipo, valor); } atualizarFichasFiltros(); aplicarFiltrosEOrdenacao(); }
    function removerFiltro(tipo) { if (tipo === 'categoria') return; filtrosAtivos.delete(tipo); atualizarFichasFiltros(); aplicarFiltrosEOrdenacao(); }
    function limparTodosFiltros() { filtrosAtivos.clear(); categoriaGlobal = null; document.getElementById('indicadorCategoriaContainer').innerHTML = ''; estabelecimentoViaQR = null; document.getElementById('busca').value = ''; var btnLimparBusca = document.getElementById('btnLimparBusca'); if (btnLimparBusca) btnLimparBusca.classList.remove('visible'); document.getElementById('indicadorQRCodeContainer').innerHTML = ''; if (pertoMimAtivo) { pertoMimAtivo = false; usuarioPosicao = null; document.getElementById('btnPertoMim').classList.remove('ativo'); document.getElementById('btnPertoMim').innerHTML = '📍 Perto de Mim'; } ordenarPorMedia = false; atualizarFichasFiltros(); aplicarFiltrosEOrdenacao(); }
    function abrirModalTiposFiltro() { var modal = document.getElementById('modalAdicionarFiltro'); var lista = document.getElementById('listaTiposFiltro'); lista.innerHTML = ''; Object.values(cfg.tiposFiltroVisiveis).forEach(function(tipo) { if (colunaTemValores(tipo.coluna)) { var item = document.createElement('div'); item.className = 'item-tipo-filtro'; item.textContent = tipo.nome; item.setAttribute('role','option'); item.setAttribute('tabindex','0'); item.onclick = function() { document.getElementById('modalAdicionarFiltro').style.display = 'none'; abrirModalOpcoesFiltro(tipo.id); }; item.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); } }); lista.appendChild(item); } }); modal.style.display = 'flex'; UI.trapFocus(modal); }
    function abrirModalOpcoesFiltro(tipoId) { var info = Object.values(cfg.tiposFiltroVisiveis).find(function(t) { return t.id === tipoId; }); if (!info) return; var opcoes = obterOpcoesFiltro(info); var modalOpcoes = document.getElementById('modalOpcoesFiltro'); document.getElementById('tituloOpcoesFiltro').textContent = 'Selecionar ' + info.nome; var lista = document.getElementById('listaOpcoesFiltro'); lista.innerHTML = ''; var todos = document.createElement('div'); todos.className = 'item-opcao-filtro'; todos.textContent = 'Todos'; todos.setAttribute('role','option'); todos.setAttribute('tabindex','0'); todos.onclick = function() { removerFiltro(tipoId); modalOpcoes.style.display = 'none'; UI.restoreFocus(); }; todos.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); todos.click(); } }); lista.appendChild(todos); opcoes.forEach(function(op) { var item = document.createElement('div'); item.className = 'item-opcao-filtro'; item.textContent = op; item.setAttribute('role','option'); item.setAttribute('tabindex','0'); item.onclick = function() { adicionarFiltro(tipoId, op); modalOpcoes.style.display = 'none'; UI.restoreFocus(); }; item.addEventListener('keydown', function(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); } }); lista.appendChild(item); }); modalOpcoes.style.display = 'flex'; UI.trapFocus(modalOpcoes); }
    function aplicarFiltroURL() { var params = new URLSearchParams(location.search); if (!params.has('cat')) return; var slug = params.get('cat').toLowerCase().trim(); slug = slug.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); var catEncontrada = null; for (var key in cfg.mapeamentoExato) { if (key === slug) { catEncontrada = cfg.mapeamentoExato[key]; break; } } if (!catEncontrada && dadosProcessados.length > 0) { var catsMap = new Map(); dadosProcessados.forEach(function(c) { var orig = c[COLUNAS.CATEGORIA]; if (orig) { var norm = orig.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); catsMap.set(norm, orig); } }); if (catsMap.has(slug)) catEncontrada = catsMap.get(slug); else { for (var entry of catsMap.entries()) { if (entry[0].includes(slug) || slug.includes(entry[0])) { catEncontrada = entry[1]; break; } } } } if (catEncontrada) adicionarFiltro('categoria', catEncontrada); }

    function obterLocalizacaoUsuario() { return new Promise(function(resolve, reject) { if (!navigator.geolocation) { reject('Geolocalização não suportada'); return; } navigator.geolocation.getCurrentPosition(function(pos) { usuarioPosicao = { lat: pos.coords.latitude, lng: pos.coords.longitude }; resolve(usuarioPosicao); }, function(err) { var msg = 'Erro ao obter localização'; if (err.code === 1) msg = 'Permissão negada. Habilite a localização nas configurações do navegador.'; else if (err.code === 2) msg = 'Localização indisponível'; else if (err.code === 3) msg = 'Tempo esgotado'; reject(msg); }, { enableHighAccuracy:true, timeout:10000, maximumAge:0 }); }); }
    function ativarPertoDeMim() { var btn = document.getElementById('btnPertoMim'); btn.classList.add('ativo'); btn.innerHTML = '📍 Buscando...'; obterLocalizacaoUsuario().then(function() { pertoMimAtivo = true; btn.innerHTML = '📍 Ativo'; renderizarCardsGaveta(estatisticasGlobais, avaliacoesUsuarioGlobais); aplicarFiltrosEOrdenacao(); }).catch(function(erro) { btn.classList.remove('ativo'); btn.innerHTML = '📍 Perto de Mim'; UI.mostrarToast(erro); }); }
    function desativarPertoDeMim() { pertoMimAtivo = false; usuarioPosicao = null; document.getElementById('btnPertoMim').classList.remove('ativo'); document.getElementById('btnPertoMim').innerHTML = '📍 Perto de Mim'; renderizarCardsGaveta(estatisticasGlobais, avaliacoesUsuarioGlobais); aplicarFiltrosEOrdenacao(); }
    function togglePertoDeMim() { if (pertoMimAtivo) desativarPertoDeMim(); else ativarPertoDeMim(); }

    function abrirQRCode(event, nome, qrCodeURL, urlQRCode) {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay'; modal.setAttribute('role','dialog'); modal.setAttribute('aria-modal','true'); modal.setAttribute('aria-label', 'QR Code de ' + nome); modal.style.display = 'flex';
        modal.innerHTML = '<div class="modal-conteudo qr-modal-conteudo"><div class="modal-header"><h3>QR Code</h3><button class="modal-close-btn" onclick="this.closest(\'.modal-overlay\').remove()" aria-label="Fechar QR Code">&times;</button></div><div class="modal-body" style="text-align:center;"><div class="qr-modal-img-wrap"><img src="' + qrCodeURL + '" alt="QR Code para ' + Core.sanitize(nome) + '"></div><p class="qr-modal-nome">' + Core.sanitize(nome) + '</p><div class="qr-modal-acoes"><button class="qr-btn-secondary" onclick="navigator.share ? navigator.share({title:\'' + Core.jsEscape(nome) + '\', url:\'' + urlQRCode + '\'}) : Economizei.UI.mostrarToast(\'Compartilhamento não suportado\')"><i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Compartilhar</button><button class="qr-btn-primary" onclick="navigator.clipboard.writeText(\'' + urlQRCode + '\').then(function(){ Economizei.UI.mostrarToast(\'URL copiada!\'); })"><i class="fa-solid fa-copy" aria-hidden="true"></i> Copiar</button></div></div></div>';
        document.body.appendChild(modal);
        modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
        UI.trapFocus(modal);
    }

    // NOVO: monta o(s) botão(ões) de módulo para um estabelecimento, de
    // forma genérica. Cada arquivo de módulo (economizei-pedidos.js etc.)
    // se registra aqui chamando Economizei.Cards.registrarModulo(...).
    // Se o módulo não estiver carregado na página, o botão simplesmente
    // não aparece — mesmo comportamento de antes, sem if/else por página.
    var modulosRegistrados = {}; // { estilo: { label, className, onClick(idx) } }
    function registrarModulo(estilo, definicao) { modulosRegistrados[estilo] = definicao; }
    function montarBotaoModulo(estilo, idx) {
        var def = modulosRegistrados[(estilo || '').toLowerCase().trim()];
        if (!def) return '';
        return '<button class="btn-acao btn-modulo" onclick="' + def.onClick(idx) + '" aria-label="' + Core.sanitize(def.ariaLabel || def.label) + '">' + def.label + '</button>';
    }

    function renderizarCardsGaveta(estatisticas, avaliacoesUsuario) {
        var favoritos = getFavoritos();
        var lista = document.getElementById('lista'); lista.innerHTML = ''; todosCardsRenderizados = [];
        dadosProcessados.forEach(function(c, idx) {
            var nome = c[COLUNAS.NOME] || '';
            var categoria = c[COLUNAS.CATEGORIA] || '';
            var subcategoria = c[COLUNAS.SUBCATEGORIA] || '';
            var distrito = c[COLUNAS.DISTRITO] || '';
            var imagem = Core.ensureHttps(c[COLUNAS.IMAGEM]) || cfg.imagemFallback;
            var whatsappRaw = c[COLUNAS.WHATSAPP] || '';
            var maps = c[COLUNAS.MAPS] || '';
            var horarioDisplay = Horario.formatHorarioDisplay(c);
            var horarioStatus = Horario.getHorarioPorDia(c);
            var status = Horario.getStatusHorario(horarioStatus);
            var delivery = c[COLUNAS.DELIVERY] || '';
            var consumo = c[COLUNAS.CONSUMO] || '';
            var observacao = c[COLUNAS.OBSERVACAO] || '';
            var cardapio = c[COLUNAS.CARDAPIO] || '';
            var site = c[COLUNAS.SITE] || '';
            var facebook = c[COLUNAS.FACEBOOK] || '';
            var instagram = c[COLUNAS.INSTAGRAM] || '';
            var promocao = c[COLUNAS.PROMOCAO] || '';
            var idUnico = c[COLUNAS.ID_UNICO] || '';
            var slug = c[COLUNAS.SLUG] || '';
            var latitude = c[COLUNAS.LATITUDE] || '';
            var longitude = c[COLUNAS.LONGITUDE] || '';
            var estilo = (c[COLUNAS.ESTILO] || '').toLowerCase().trim();

            var verificado = estaVerificado(c);
            var dataVerif = '';
            if (verificado && c[COLUNAS.DATA_VERIFICACAO]) { var d = getDataVerificacao(c); if (d) dataVerif = d.getDate().toString().padStart(2,'0') + '/' + (d.getMonth()+1).toString().padStart(2,'0') + '/' + d.getFullYear(); }

            var isFav = favoritos.indexOf(nome) !== -1;
            var avUser = avaliacoesUsuario[nome] || 0;
            var stats = estatisticas[nome] || { media:0, total:0 };
            var mediaF = stats.media > 0 ? stats.media.toFixed(1) : '0.0';
            var totalV = stats.total || 0;
            var estrelasHTML = Array.from({length:5}, function(_,i) { return '<span aria-hidden="true">' + (i < Math.round(stats.media) ? '★' : '☆') + '</span>'; }).join('');
            var qrCodeURL = Utils.gerarImagemQRCode(nome, cfg.paginaAtualUrl);
            var urlQRCode = Utils.gerarURLQRCode(nome, cfg.paginaAtualUrl);

            var distanciaHTML = '';
            if (pertoMimAtivo && usuarioPosicao) { var lat = parseFloat(latitude), lng = parseFloat(longitude); if (!isNaN(lat) && !isNaN(lng)) { var dist = Utils.calcularDistancia(usuarioPosicao.lat, usuarioPosicao.lng, lat, lng); distanciaHTML = '<div class="card-distancia"><span aria-hidden="true">📍</span> ' + Utils.formatarDistancia(dist) + '</div>'; } }

            var whatsappData = [];
            if (whatsappRaw) { var partes = whatsappRaw.split(/[,\n;]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s !== ''; }); partes.forEach(function(parte) { if (parte.indexOf('|') !== -1) { var split = parte.split('|').map(function(s) { return s.trim(); }); var num = Core.sanitizarWhatsapp(split[1]); if (num) whatsappData.push({ nome: split[0], numero: num }); } else { var num2 = Core.sanitizarWhatsapp(parte); if (num2) whatsappData.push({ nome: null, numero: num2 }); } }); }

            var card = document.createElement('div');
            card.className = 'card' + (isFav ? ' card-favorito' : '');
            card.setAttribute('role','button'); card.setAttribute('tabindex','0');
            card.setAttribute('aria-label', nome + (verificado ? ', verificado' : '') + (isFav ? ', favorito' : '') + ', ' + status.texto);
            card.dataset.nome = nome; card.dataset.categoria = categoria; card.dataset.subcategoria = subcategoria; card.dataset.distrito = distrito;
            card.dataset.delivery = delivery; card.dataset.consumo = consumo; card.dataset.idUnico = idUnico; card.dataset.slug = slug;
            card.dataset.latitude = latitude; card.dataset.longitude = longitude; card.dataset.index = idx; card.dataset.verificado = verificado ? 'true' : 'false';
            card.dataset.whatsapp = JSON.stringify(whatsappData); card.dataset.estilo = estilo;

            var separadorHtml = (categoria && subcategoria) ? '<span class="card-categoria-separador">|</span>' : '';

            card.innerHTML =
                '<div class="card-img-container"><img class="card-img" src="' + imagem + '" alt="' + Core.sanitize(nome) + '" loading="' + (idx < 8 ? 'eager' : 'lazy') + '" onerror="this.src=\'' + cfg.imagemFallback + '\'"></div>' +
                '<div class="card-status ' + status.cor + '"><span class="status-texto">' + status.texto + '</span></div>' +
                '<button class="btn-favorito ' + (isFav ? 'ativo' : '') + '" data-nome="' + Core.sanitize(nome) + '" data-index="' + idx + '" aria-label="' + (isFav ? 'Remover' : 'Adicionar') + ' ' + Core.sanitize(nome) + ' dos favoritos">' + (isFav ? '♥' : '♡') + '</button>' +
                '<div class="card-content">' + (verificado ? '<div class="badge-verificado-container"><span class="badge-tooltip" data-tooltip="Verificado em ' + dataVerif + '" tabindex="0">✅ Verificado</span></div>' : '') +
                '<h3 class="card-title">' + Core.sanitize(nome) + '</h3><div class="card-categoria-container">' + (categoria ? '<span class="card-categoria">' + Core.sanitize(categoria) + '</span>' : '') + separadorHtml + (subcategoria ? '<span class="card-subcategoria">' + Core.sanitize(subcategoria) + '</span>' : '') + '</div>' +
                (distrito ? '<div class="card-distrito">' + Core.sanitize(distrito) + '</div>' : '') + distanciaHTML +
                '<div class="card-avaliacao-header"><div class="estrelas-header" aria-label="Avaliação: ' + mediaF + ' estrelas, ' + totalV + ' ' + (totalV === 1 ? 'voto' : 'votos') + '">' + estrelasHTML + '</div><div class="nota-header">' + mediaF + ' (' + totalV + ' ' + (totalV === 1 ? 'voto' : 'votos') + ')</div></div>' +
                '<button class="card-toggle" data-index="' + idx + '" aria-expanded="false">Ver detalhes</button></div>';

            var expanded = document.createElement('div');
            expanded.className = 'card-expanded-container'; expanded.dataset.index = idx; expanded.dataset.parent = nome;
            expanded.setAttribute('aria-label', 'Detalhes de ' + nome);

            var authHTML = gerarAuthHTML(idx);

            var botoes = [];
            if (whatsappData.length === 1) { var w = whatsappData[0]; botoes.push('<a href="https://wa.me/' + w.numero + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-whatsapp" aria-label="WhatsApp ' + Core.sanitize(w.nome ? w.nome : Core.formatarTelefone(w.numero)) + '">WhatsApp</a>'); }
            else if (whatsappData.length > 1) { botoes.push('<button class="btn-acao btn-whatsapp" data-index="' + idx + '" onclick="Economizei.UI.abrirModalWhatsapp(' + idx + ')" aria-label="Opções de WhatsApp para ' + Core.sanitize(nome) + '">WhatsApp</button>'); }
            if (maps) botoes.push('<a href="' + maps + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-mapa" aria-label="Localização de ' + Core.sanitize(nome) + '">Localização</a>');
            if (cardapio) botoes.push('<a href="' + cardapio + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-cardapio" aria-label="Cardápio de ' + Core.sanitize(nome) + '">Cardápio</a>');
            if (site) botoes.push('<a href="' + site + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-site-pedido" aria-label="Site/Pedido de ' + Core.sanitize(nome) + '">Site/Pedido</a>');
            if (facebook) botoes.push('<a href="' + facebook + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-facebook" aria-label="Facebook de ' + Core.sanitize(nome) + '">Facebook</a>');
            if (instagram) botoes.push('<a href="' + instagram + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-instagram" aria-label="Instagram de ' + Core.sanitize(nome) + '">Instagram</a>');
            if (promocao) botoes.push('<a href="' + promocao + '" target="_blank" rel="noopener noreferrer" class="btn-acao btn-promocao" aria-label="Promoção de ' + Core.sanitize(nome) + '">🔥 Promoção</a>');
            if (estilo) botoes.push(montarBotaoModulo(estilo, idx)); // NOVO: genérico via registrarModulo
            botoes.push('<button class="btn-acao btn-qrcode" onclick="Economizei.Cards.abrirQRCode(event, \'' + Core.jsEscape(nome) + '\', \'' + qrCodeURL + '\', \'' + urlQRCode + '\')" aria-label="QR Code de ' + Core.sanitize(nome) + '">📱 QR Code</button>');

            expanded.innerHTML =
                '<div class="card-expanded"><div class="detalhes-grid">' + (horarioDisplay ? '<div class="detalhe-item"><strong>Horário:</strong> ' + Core.sanitize(horarioDisplay) + '</div>' : '') + (delivery ? '<div class="detalhe-item"><strong>Delivery:</strong> ' + Core.sanitize(delivery) + '</div>' : '') + (consumo ? '<div class="detalhe-item"><strong>Consumo Local:</strong> ' + Core.sanitize(consumo) + '</div>' : '') + (observacao ? '<div class="detalhe-item"><strong>Observações:</strong> ' + Core.sanitize(observacao) + '</div>' : '') + (idUnico ? '<div class="detalhe-item"><strong>ID Único:</strong> ' + Core.sanitize(idUnico) + '</div>' : '') + '</div>' +
                '<div class="avaliacao-section"><div class="avaliacao-topo" data-index="' + idx + '" data-nome="' + Core.sanitize(nome) + '">' + authHTML + '</div><div class="avaliacao-estrelas" data-nome="' + Core.sanitize(nome) + '" data-index="' + idx + '" role="radiogroup" aria-label="Avaliar ' + Core.sanitize(nome) + '">' + Array.from({length:5}, function(_, i) { var ativa = i < avUser ? 'ativa' : ''; return '<button class="estrela-btn ' + ativa + '" data-rating="' + (i+1) + '" data-index="' + idx + '" aria-label="' + (i+1) + ' estrela' + (i+1 > 1 ? 's' : '') + '" role="radio" aria-checked="' + (ativa ? 'true' : 'false') + '">★</button>'; }).join('') + '</div><div class="avaliacao-mensagem" data-index="' + idx + '">' + (avUser ? 'Sua nota: ' + avUser + ' estrela' + (avUser > 1 ? 's' : '') : '') + '</div></div>' +
                '<div class="card-acoes">' + botoes.join('') + '</div></div>';

            todosCardsRenderizados.push({ card:card, expanded:expanded, index:idx });
        });
        document.getElementById('loading').style.display = 'none';
        var listaEl = document.getElementById('lista');
        listaEl.style.display = window.innerWidth <= 768 ? 'flex' : 'grid';
        if (window.innerWidth <= 768) listaEl.style.flexDirection = 'column';
        ativarInteracoesCards();
        dadosResolvidos();
    }

    function ativarInteracoesCards() {
        document.querySelectorAll('.card').forEach(function(c) { c.removeEventListener('click', handleCardClick); c.addEventListener('click', handleCardClick); c.removeEventListener('keydown', handleCardKeydown); c.addEventListener('keydown', handleCardKeydown); });
        document.querySelectorAll('.card-toggle').forEach(function(b) { b.removeEventListener('click', handleToggleClick); b.addEventListener('click', handleToggleClick); });
        document.querySelectorAll('.btn-favorito').forEach(function(b) { b.removeEventListener('click', handleFavoritoClick); b.addEventListener('click', handleFavoritoClick); });
        document.querySelectorAll('.estrela-btn').forEach(function(b) { b.removeEventListener('click', handleEstrelaClick); b.addEventListener('click', handleEstrelaClick); });
        document.querySelectorAll('.avaliacao-estrelas').forEach(function(container) { container.removeEventListener('mouseover', handleEstrelasMouseOver); container.addEventListener('mouseover', handleEstrelasMouseOver); container.removeEventListener('mouseout', handleEstrelasMouseOut); container.addEventListener('mouseout', handleEstrelasMouseOut); container.removeEventListener('focusin', handleEstrelasMouseOver); container.addEventListener('focusin', handleEstrelasMouseOver); container.removeEventListener('focusout', handleEstrelasMouseOut); container.addEventListener('focusout', handleEstrelasMouseOut); });
        document.querySelectorAll('.card-expanded-container').forEach(function(ex) { ex.removeEventListener('click', handleExpandedClick); ex.addEventListener('click', handleExpandedClick); });
        document.querySelectorAll('.link-entrar').forEach(function(link) { link.removeEventListener('click', handleLinkEntrarClick); link.addEventListener('click', handleLinkEntrarClick); });
        document.querySelectorAll('.link-sair').forEach(function(link) { link.removeEventListener('click', handleLinkSairClick); link.addEventListener('click', handleLinkSairClick); });
    }

    function handleCardClick(e) { if (e.target.closest('.btn-favorito, .card-toggle, .btn-qrcode, .btn-whatsapp, .btn-mapa, .btn-cardapio, .btn-site-pedido, .btn-facebook, .btn-instagram, .btn-promocao, .btn-modulo, .badge-tooltip, .link-entrar, .link-sair')) return; toggleCardExpand(this); }
    function handleCardKeydown(e) { if (e.key === 'Enter' || e.key === ' ') { if (e.target.closest('.btn-favorito, .card-toggle, .btn-qrcode, .btn-whatsapp, .btn-mapa, .btn-cardapio, .btn-site-pedido, .btn-facebook, .btn-instagram, .btn-promocao, .btn-modulo, .badge-tooltip, .link-entrar, .link-sair')) return; e.preventDefault(); toggleCardExpand(this); } }
    function toggleCardExpand(card) { var expanded = card.nextElementSibling; if (!expanded || !expanded.classList.contains('card-expanded-container')) return; var btn = card.querySelector('.card-toggle'); var isActive = expanded.classList.contains('active'); if (isActive) { expanded.classList.remove('active'); if (btn) { btn.textContent = 'Ver detalhes'; btn.setAttribute('aria-expanded','false'); } return; } document.querySelectorAll('.card-expanded-container.active').forEach(function(ex) { if (ex !== expanded) { ex.classList.remove('active'); var otherCard = ex.previousElementSibling; if (otherCard) { var otherBtn = otherCard.querySelector('.card-toggle'); if (otherBtn) { otherBtn.textContent = 'Ver detalhes'; otherBtn.setAttribute('aria-expanded','false'); } } } }); expanded.classList.add('active'); if (btn) { btn.textContent = 'Ocultar detalhes'; btn.setAttribute('aria-expanded','true'); } setTimeout(function() { expanded.scrollIntoView({ behavior:'smooth', block:'nearest' }); }, 50); }
    function handleToggleClick(e) { e.stopPropagation(); var card = this.closest('.card'); if (card) toggleCardExpand(card); }
    function handleFavoritoClick(e) { e.stopPropagation(); toggleFav(this); }
    function toggleFav(btn) { var nome = btn.dataset.nome; var card = btn.closest('.card'); var isFav = toggleFavorito(nome); btn.classList.toggle('ativo', isFav); btn.innerHTML = isFav ? '♥' : '♡'; btn.setAttribute('aria-label', (isFav ? 'Remover' : 'Adicionar') + ' ' + nome + ' dos favoritos'); card.classList.toggle('card-favorito', isFav); var idx = parseInt(card.dataset.index); if (todosCardsRenderizados[idx]) { var cardGaveta = todosCardsRenderizados[idx].card; cardGaveta.classList.toggle('card-favorito', isFav); var btnGaveta = cardGaveta.querySelector('.btn-favorito'); if (btnGaveta) { btnGaveta.classList.toggle('ativo', isFav); btnGaveta.innerHTML = isFav ? '♥' : '♡'; btnGaveta.setAttribute('aria-label', (isFav ? 'Remover' : 'Adicionar') + ' ' + nome + ' dos favoritos'); } } aplicarFiltrosEOrdenacao(); }
    function handleEstrelaClick(e) { e.stopPropagation(); rateEstrela(this); }
    function handleEstrelasMouseOver(e) { var btn = e.target.closest('.estrela-btn'); if (!btn) return; var container = this; var hoverRating = parseInt(btn.dataset.rating); container.querySelectorAll('.estrela-btn').forEach(function(s, i) { s.classList.toggle('preview', (i + 1) <= hoverRating); }); }
    function handleEstrelasMouseOut(e) { var container = this; if (container.contains(e.relatedTarget)) return; container.querySelectorAll('.estrela-btn').forEach(function(s) { s.classList.remove('preview'); }); }
    function gerarAuthHTML(idx, userOverride) {
        var user = (typeof userOverride !== 'undefined') ? userOverride : Core.getCurrentUser();
        if (user) {
            var nomeExibicao = user.displayName || (user.email ? user.email.split('@')[0] : 'Usuário');
            var primeiroNome = Core.sanitize(nomeExibicao.split(' ')[0]);
            var foto = user.photoURL ? '<img src="' + user.photoURL + '" class="foto-perfil" alt="Foto de perfil de ' + primeiroNome + '">' : '';
            return '<div style="display:flex;align-items:center;">' + foto + '<span style="margin:0 4px;">olá ' + primeiroNome + '</span><span class="link-sair" data-index="' + idx + '" style="cursor:pointer;" role="button" tabindex="0">Sair</span></div>';
        }
        return '<span class="link-entrar" data-index="' + idx + '" style="cursor:pointer;" role="button" tabindex="0">Entrar</span>';
    }
    var notasEmSalvamento = {};
    function rateEstrela(btn) { var rating = parseInt(btn.dataset.rating); var idx = parseInt(btn.dataset.index); if (notasEmSalvamento[idx]) return; var container = btn.closest('.avaliacao-estrelas'); var nome = container.dataset.nome; var user = Core.getCurrentUser(); if (!user) { abrirLoginParaAcao({ idx:idx, nome:nome, rating:rating }); return; } aplicarNotaLocal(idx, rating); salvarNota(idx, nome, rating); }
    function aplicarNotaLocal(idx, rating) { var item = todosCardsRenderizados[idx]; if (!item) return; var container = item.expanded.querySelector('.avaliacao-estrelas'); if (container) { container.querySelectorAll('.estrela-btn').forEach(function(star, i) { star.classList.toggle('ativa', i < rating); star.setAttribute('aria-checked', i < rating ? 'true' : 'false'); }); } var msg = item.expanded.querySelector('.avaliacao-mensagem'); if (msg) msg.textContent = 'Sua nota: ' + rating + ' estrela' + (rating > 1 ? 's' : ''); }
    function atualizarExibicaoEstatisticas(idx, stats) { var item = todosCardsRenderizados[idx]; if (!item) return; var mediaF = stats.media > 0 ? stats.media.toFixed(1) : '0.0'; var totalV = stats.total || 0; var estrelasHTML = Array.from({length:5}, function(_,i) { return '<span aria-hidden="true">' + (i < Math.round(stats.media) ? '★' : '☆') + '</span>'; }).join(''); var estrelasEl = item.card.querySelector('.estrelas-header'); var notaEl = item.card.querySelector('.nota-header'); if (estrelasEl) { estrelasEl.innerHTML = estrelasHTML; estrelasEl.setAttribute('aria-label', 'Avaliação: ' + mediaF + ' estrelas, ' + totalV + ' ' + (totalV === 1 ? 'voto' : 'votos')); } if (notaEl) notaEl.textContent = mediaF + ' (' + totalV + ' ' + (totalV === 1 ? 'voto' : 'votos') + ')'; }
    function salvarNota(idx, nome, rating) { notasEmSalvamento[idx] = true; var notaAnterior = avaliacoesUsuarioGlobais[nome] || 0; Core.salvarAvaliacaoFirebase(nome, rating).then(function() { var stats = estatisticasGlobais[nome] || { media:0, total:0 }; var soma = stats.media * stats.total; if (notaAnterior > 0) { soma = soma - notaAnterior + rating; } else { soma = soma + rating; stats.total = stats.total + 1; } stats.media = stats.total > 0 ? soma / stats.total : 0; estatisticasGlobais[nome] = stats; avaliacoesUsuarioGlobais[nome] = rating; atualizarExibicaoEstatisticas(idx, stats); UI.mostrarToast('Avaliação salva. Obrigado!'); }).catch(function(err) { UI.mostrarToast('Erro ao salvar avaliação: ' + err.message); }).finally(function() { notasEmSalvamento[idx] = false; }); }
    function abrirLoginParaAcao(pending) { var modal = document.getElementById('modalAvisoLogin'); modal.style.display = 'flex'; UI.trapFocus(modal); document.getElementById('btnContinuarGoogle').onclick = function() { modal.style.display = 'none'; Core.showLoginOverlay(); Core.auth.signInWithPopup(Core.provider).then(function(result) { Core.hideLoginOverlay(); finalizarLogin(result.user, pending); }).catch(function(err) { Core.hideLoginOverlay(); if (err.code === 'auth/popup-blocked') UI.mostrarToast('O pop-up foi bloqueado. Permita pop-ups para este site.'); else UI.mostrarToast('Erro ao fazer login: ' + err.message); }); }; document.getElementById('btnCancelarAviso').onclick = function() { modal.style.display = 'none'; UI.restoreFocus(); }; }
    function finalizarLogin(user, pending) { document.querySelectorAll('.avaliacao-topo').forEach(function(topo) { var idx = topo.dataset.index; topo.innerHTML = gerarAuthHTML(idx, user); }); ativarInteracoesCards(); Core.getAvaliacoesUsuario(user.uid).then(function(map) { avaliacoesUsuarioGlobais = map; document.querySelectorAll('.avaliacao-estrelas').forEach(function(container) { var nome = container.dataset.nome; var rating = avaliacoesUsuarioGlobais[nome] || 0; container.querySelectorAll('.estrela-btn').forEach(function(s, i) { var ativa = i < rating; s.classList.toggle('ativa', ativa); s.setAttribute('aria-checked', ativa ? 'true' : 'false'); }); var msg = container.parentElement.querySelector('.avaliacao-mensagem'); if (msg) msg.textContent = rating ? ('Sua nota: ' + rating + ' estrela' + (rating > 1 ? 's' : '')) : ''; }); if (pending) { aplicarNotaLocal(pending.idx, pending.rating); salvarNota(pending.idx, pending.nome, pending.rating); } UI.mostrarToast(pending ? 'Login realizado! Salvando sua avaliação...' : 'Login realizado com sucesso!'); }); }
    function handleExpandedClick(e) { if (e.target.closest('.btn-acao, .estrela-btn, .card-toggle, a, .link-entrar, .link-sair')) return; e.stopPropagation(); }
    function handleLinkEntrarClick(e) { e.stopPropagation(); abrirLoginParaAcao(null); }
    function handleLinkSairClick(e) { e.stopPropagation(); Core.auth.signOut().then(function() { avaliacoesUsuarioGlobais = {}; document.querySelectorAll('.avaliacao-topo').forEach(function(topo) { var idx = topo.dataset.index; topo.innerHTML = gerarAuthHTML(idx, null); }); document.querySelectorAll('.avaliacao-estrelas').forEach(function(container) { container.querySelectorAll('.estrela-btn').forEach(function(s) { s.classList.remove('ativa'); s.setAttribute('aria-checked','false'); }); var msg = container.parentElement.querySelector('.avaliacao-mensagem'); if (msg) msg.textContent = ''; }); ativarInteracoesCards(); UI.mostrarToast('Você saiu da sua conta.'); }).catch(function(err) { UI.mostrarToast('Erro ao sair: ' + err.message); }); }
    function getCardByIndex(idx) { var item = todosCardsRenderizados[idx]; return item ? item.card : null; }

    function carregarDados() {
        var loading = document.getElementById('loading');
        loading.style.display = 'flex';
        loading.innerHTML = '<div class="spinner" aria-hidden="true"></div><span>Carregando estabelecimentos...</span>';

        function finalizarComDados(dados) {
            dadosProcessados = dados;
            Core.authReady.then(function() {
                return Promise.all([Core.getEstatisticasAvaliacoes(), Core.getCurrentUser() ? Core.getAvaliacoesUsuario() : {}]);
            }).then(function(results) {
                estatisticasGlobais = results[0]; avaliacoesUsuarioGlobais = results[1] || {};
                renderizarCardsGaveta(estatisticasGlobais, avaliacoesUsuarioGlobais);
                tratarQRCodeURL();
                aplicarFiltroURL();
                aplicarFiltrosEOrdenacao();
                atualizarFichasFiltros();
                Core.restaurarPosicao();
                loading.style.display = 'none';
            });
        }

        var cached = localStorage.getItem(cfg.cacheKey);
        var ts = localStorage.getItem(cfg.cacheKey + '_timestamp');
        if (cached && ts && (Date.now() - ts < cfg.cacheDuration)) {
            try { var dados = JSON.parse(cached); if (dados && dados.length) { finalizarComDados(dados); return; } } catch(e) {}
        }

        fetch(cfg.csvUrl).then(function(response) {
            if (!response.ok) throw new Error('Erro HTTP ' + response.status);
            return response.text();
        }).then(function(texto) {
            var dadosCompletos = Utils.parseCSV(texto).slice(1);
            var ativos = dadosCompletos.filter(function(c) { return c[COLUNAS.ATIVO] && c[COLUNAS.ATIVO].toLowerCase() === 'sim'; });
            localStorage.setItem(cfg.cacheKey, JSON.stringify(ativos));
            localStorage.setItem(cfg.cacheKey + '_timestamp', Date.now());
            finalizarComDados(ativos);
        }).catch(function(err) {
            console.error('Erro no carregamento:', err);
            if (cached) { try { var dadosFallback = JSON.parse(cached); if (dadosFallback && dadosFallback.length) { finalizarComDados(dadosFallback); UI.mostrarToast('⚠️ Dados desatualizados. Verifique sua conexão.'); return; } } catch(e) {} }
            loading.innerHTML = '<div class="estado-erro"><div class="estado-erro-icone" aria-hidden="true">⚠️</div><h3>Não foi possível carregar os estabelecimentos</h3><p>' + Core.sanitize(err.message) + '</p><button class="retry-button" onclick="Economizei.Cards.carregarDados()">Tentar novamente</button></div>';
        });
    }

    function tratarQRCodeURL() {
        if (!dadosProcessados.length) return;
        var params = new URLSearchParams(location.search);
        if (!params.has('qr')) return;
        var qrValue = params.get('qr').toLowerCase().trim().replace(/-+$/, '');
        var mesaParam = params.get('mesa'); // usado por módulos como Pedidos (mesa via QR)
        var est = dadosProcessados.find(function(e) { return e[COLUNAS.ID_UNICO] && e[COLUNAS.ID_UNICO].toLowerCase().trim() === qrValue; });
        if (!est) est = dadosProcessados.find(function(e) { if (e[COLUNAS.SLUG]) { var s = e[COLUNAS.SLUG].toLowerCase().trim().replace(/-+$/, ''); return s === qrValue; } return false; });
        if (!est) est = dadosProcessados.find(function(e) { var slugNome = Core.gerarSlug(e[COLUNAS.NOME]); return slugNome === qrValue || slugNome.replace(/-+$/, '') === qrValue; });
        if (!est) return;
        estabelecimentoViaQR = est;
        var categoriaEscaneada = est[COLUNAS.CATEGORIA];
        categoriaGlobal = categoriaEscaneada;
        criarIndicadorCategoria(categoriaEscaneada);
        criarIndicadorQRCode(est[COLUNAS.NOME], categoriaEscaneada);
        document.getElementById('busca').value = est[COLUNAS.NOME];
        var idx = dadosProcessados.findIndex(function(e) { return e[COLUNAS.NOME] === est[COLUNAS.NOME]; });
        if (idx !== -1 && todosCardsRenderizados[idx]) {
            var cardElement = todosCardsRenderizados[idx].card; var expandedContainer = todosCardsRenderizados[idx].expanded;
            if (cardElement && expandedContainer) {
                var toggleBtn = cardElement.querySelector('.card-toggle');
                if (toggleBtn) { toggleBtn.textContent = 'Ocultar detalhes'; toggleBtn.setAttribute('aria-expanded','true'); }
                expandedContainer.classList.add('active');
                setTimeout(function() { expandedContainer.scrollIntoView({ behavior:'smooth', block:'start' }); }, 200);
            }
            // Se veio ?mesa=N junto do QR e o módulo Pedidos está carregado,
            // abre o modal de pedido direto (fluxo "escaneei o QR da mesa").
            if (mesaParam && window.Economizei.UI && window.Economizei.UI.setMesaQR) { window.Economizei.UI.setMesaQR(mesaParam); }
            if (mesaParam && window.Economizei.Pedido) { setTimeout(function() { Economizei.Pedido.abrirModal(idx); }, 500); }
        }
    }

    return {
        configurar:configurar, registrarModulo:registrarModulo,
        get dadosProcessados() { return dadosProcessados; },
        dadosProntos:dadosProntos,
        getFavoritos:getFavoritos, toggleFavorito:toggleFavorito, estaVerificado:estaVerificado,
        criarIndicadorCategoria:criarIndicadorCategoria, criarIndicadorQRCode:criarIndicadorQRCode, fecharQRCode:fecharQRCode,
        mostrarMensagemSemResultados:mostrarMensagemSemResultados, renderizarPagina:renderizarPagina,
        aplicarFiltrosEOrdenacao:aplicarFiltrosEOrdenacao, atualizarFichasFiltros:atualizarFichasFiltros,
        adicionarFiltro:adicionarFiltro, removerFiltro:removerFiltro, limparTodosFiltros:limparTodosFiltros,
        abrirModalTiposFiltro:abrirModalTiposFiltro, abrirModalOpcoesFiltro:abrirModalOpcoesFiltro, aplicarFiltroURL:aplicarFiltroURL,
        togglePertoDeMim:togglePertoDeMim, abrirQRCode:abrirQRCode, renderizarCardsGaveta:renderizarCardsGaveta,
        ativarInteracoesCards:ativarInteracoesCards, getCardByIndex:getCardByIndex, carregarDados:carregarDados
    };
})();

// ============================================================
// INICIALIZAÇÃO COMUM (IDs padronizados em toda página de grupo)
// Cada página só precisa chamar Economizei.Cards.configurar({...})
// e depois Economizei.Cards.carregarDados() no fim do seu próprio
// script — este bloco cuida do resto (busca, filtros, modais, Esc).
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    var buscaInput = document.getElementById('busca');
    var btnLimparBusca = document.getElementById('btnLimparBusca');
    if (buscaInput && btnLimparBusca) {
        function toggleLimparBusca() { if (buscaInput.value.length > 0) btnLimparBusca.classList.add('visible'); else btnLimparBusca.classList.remove('visible'); }
        buscaInput.addEventListener('input', function() { toggleLimparBusca(); Economizei.Cards.aplicarFiltrosEOrdenacao(); });
        btnLimparBusca.addEventListener('click', function() { buscaInput.value = ''; toggleLimparBusca(); Economizei.Cards.aplicarFiltrosEOrdenacao(); buscaInput.focus(); });
        buscaInput.addEventListener('keypress', function(e) { if (e.key === 'Enter') { e.preventDefault(); this.blur(); } });
    }

    var el;
    if ((el = document.getElementById('btnAdicionarFiltro'))) el.addEventListener('click', function() { Economizei.Cards.abrirModalTiposFiltro(); });
    if ((el = document.getElementById('btnLimparFiltros'))) el.addEventListener('click', function() { Economizei.Cards.limparTodosFiltros(); });
    if ((el = document.getElementById('btnPertoMim'))) el.addEventListener('click', function() { Economizei.Cards.togglePertoDeMim(); });
    if ((el = document.getElementById('btnFecharModal'))) el.addEventListener('click', function() { document.getElementById('modalAdicionarFiltro').style.display = 'none'; Economizei.UI.restoreFocus(); });
    if ((el = document.getElementById('btnFecharModalOpcoes'))) el.addEventListener('click', function() { document.getElementById('modalOpcoesFiltro').style.display = 'none'; Economizei.UI.restoreFocus(); });
    if ((el = document.getElementById('btnFecharModalWhatsapp'))) el.addEventListener('click', function() { document.getElementById('modalWhatsapp').style.display = 'none'; Economizei.UI.restoreFocus(); });
    if ((el = document.getElementById('btnMelhoresAvaliados'))) el.addEventListener('click', function() { Economizei.Cards.ordenarPorMedia = !Economizei.Cards.ordenarPorMedia; Economizei.Cards.aplicarFiltrosEOrdenacao(); });

    document.querySelectorAll('.modal-overlay').forEach(function(m) { m.addEventListener('click', function(e) { if (e.target === this) { this.style.display = 'none'; Economizei.UI.restoreFocus(); } }); });

    // CORRIGIDO: Esc agora fecha também modais dinâmicos criados por
    // módulos (imagem em tela cheia, popup de confirmação de pedido),
    // não só os ".modal-overlay" fixos da página.
    document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        var modalsAbertos = document.querySelectorAll(
            '.modal-overlay[style*="display: flex"], .modal-overlay[style*="display:flex"], ' +
            '.modal-imagem-full, .popup-confirmacao'
        );
        if (modalsAbertos.length === 0) return;
        var ultimoModal = modalsAbertos[modalsAbertos.length - 1];
        if (ultimoModal.classList.contains('modal-imagem-full') || ultimoModal.classList.contains('popup-confirmacao')) {
            ultimoModal.remove();
        } else if (ultimoModal.id === 'modalPedidoRest' && window.Economizei.Pedido) {
            Economizei.Pedido.fecharModalPedido();
        } else {
            ultimoModal.style.display = 'none';
        }
        Economizei.UI.restoreFocus();
    });

    window.addEventListener('resize', function() {
        var lista = document.getElementById('lista');
        if (lista) lista.style.display = window.innerWidth <= 768 ? 'flex' : 'grid';
    });
});
