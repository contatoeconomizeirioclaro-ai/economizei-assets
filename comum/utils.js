/* ==============================================================
   ECONOMIZEI! RIO CLARO — UTILITÁRIOS COMPARTILHADOS
   Usado por: grupos, vitrine, trilhas, ônibus, eventos, vagas,
              todos os módulos (loja, pedidos, transporte)
              e todo o painel (hub, master, módulos).
   Sem dependências externas. Expõe tudo em window.EconomizeiUtils.
   ============================================================== */
(function (global) {
  'use strict';

  // ---------- SANITIZAÇÃO ----------
  function sanitize(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureHttps(url) {
    if (!url) return '';
    return url.startsWith('http') ? url : 'https://' + url;
  }

  function linkSeguro(url, base) {
    if (!url) return '#';
    try {
      const u = new URL(url, base || global.location.href);
      if (u.protocol === 'http:' || u.protocol === 'https:') return u.href;
    } catch (e) { /* URL inválida */ }
    return '#';
  }

  function gerarSlug(texto) {
    if (!texto) return '';
    return texto.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  // ---------- VALIDAÇÕES E FORMATAÇÕES ----------
  // [NOVO] Valida e-mail no formato padrão.
  function validarEmail(str) {
    if (!str) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(str).trim());
  }

  // [NOVO] Normaliza número de WhatsApp para o formato do wa.me (com 55).
  function formatarWhatsapp(numero) {
    if (!numero) return '';
    var limpo = String(numero).replace(/\D/g, '');
    if (!limpo) return '';
    if (!limpo.startsWith('55')) limpo = '55' + limpo;
    return limpo;
  }

  // [NOVO] Verifica se o id do estabelecimento casa com algum dos prefixos.
  function pertencePrefixo(id, prefixos) {
    if (!id || !Array.isArray(prefixos)) return false;
    return prefixos.some(function (p) { return String(id).startsWith(p); });
  }

  // ---------- PARSER CSV ----------
  function parseCSV(texto) {
    const linhas = [];
    let dentroAspas = false, campo = '', linha = [];
    for (let i = 0; i < texto.length; i++) {
      const c = texto[i], p = texto[i + 1];
      if (c === '"') {
        if (!dentroAspas) dentroAspas = true;
        else if (p === '"') { campo += '"'; i++; }
        else dentroAspas = false;
      } else if (c === ',' && !dentroAspas) {
        linha.push(campo); campo = '';
      } else if ((c === '\n' || c === '\r') && !dentroAspas) {
        if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
        campo = ''; linha = [];
        if (c === '\r' && p === '\n') i++;
      } else {
        campo += c;
      }
    }
    if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
    return linhas;
  }

  // ---------- CACHE DE CSV ----------
  function criarCacheCSV(chave, duracaoMs) {
    return {
      ler() {
        try {
          const cache = localStorage.getItem(chave);
          const ts = localStorage.getItem(chave + '_timestamp');
          if (!cache || !ts) return null;
          if (Date.now() - ts >= duracaoMs) return null;
          return JSON.parse(cache);
        } catch (erro) {
          console.warn('Cache "' + chave + '" corrompido, ignorando.', erro);
          try {
            localStorage.removeItem(chave);
            localStorage.removeItem(chave + '_timestamp');
          } catch (e) { /* ignora */ }
          return null;
        }
      },
      salvar(linhas) {
        try {
          localStorage.setItem(chave, JSON.stringify(linhas));
          localStorage.setItem(chave + '_timestamp', Date.now().toString());
          return true;
        } catch (erro) {
          console.warn('Não foi possível salvar o cache "' + chave + '".', erro);
          return false;
        }
      }
    };
  }

  // ---------- FAVORITOS ----------
  function criarGerenciadorFavoritos(chave) {
    function getTodos() {
      try { return JSON.parse(localStorage.getItem(chave)) || []; }
      catch (e) { return []; }
    }
    function salvar(lista) {
      try { localStorage.setItem(chave, JSON.stringify(lista)); }
      catch (e) { console.warn('Não foi possível salvar favoritos "' + chave + '".', e); }
    }
    return {
      getTodos,
      tem(id) { return getTodos().includes(id); },
      toggle(id) {
        const lista = getTodos();
        const idx = lista.indexOf(id);
        if (idx > -1) lista.splice(idx, 1); else lista.push(id);
        salvar(lista);
        return lista.includes(id);
      }
    };
  }

  // ---------- QR CODE ----------
  function gerarURLQRCode(baseUrl, slugOuParam) {
    return baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'qr=' + encodeURIComponent(slugOuParam);
  }
  function gerarImagemQRCode(urlAlvo, tamanho) {
    tamanho = tamanho || 200;
    return 'https://api.qrserver.com/v1/create-qr-code/?size=' + tamanho + 'x' + tamanho +
      '&data=' + encodeURIComponent(urlAlvo);
  }

  // ---------- MODAL ACESSÍVEL ----------
  function criarModalAcessivel() {
    let elementoFocoAnterior = null;
    let modalAtivoEl = null;
    let onFechar = null;

    function obterFocaveis(modalEl) {
      return Array.from(modalEl.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.disabled && el.offsetParent !== null);
    }

    function trapFocusHandler(e) {
      if (!modalAtivoEl) return;
      if (e.key === 'Escape') { e.preventDefault(); fechar(); return; }
      if (e.key !== 'Tab') return;
      const focaveis = obterFocaveis(modalAtivoEl);
      if (focaveis.length === 0) return;
      const primeiro = focaveis[0], ultimo = focaveis[focaveis.length - 1];
      if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus(); }
      else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus(); }
    }

    function abrir(modalEl, callbackFechar) {
      elementoFocoAnterior = document.activeElement;
      modalAtivoEl = modalEl;
      onFechar = callbackFechar || null;
      modalEl.style.removeProperty('display');
      modalEl.classList.add('active');
      document.addEventListener('keydown', trapFocusHandler);
      const focaveis = obterFocaveis(modalEl);
      if (focaveis.length > 0) focaveis[0].focus();
      else {
        const conteudo = modalEl.querySelector('[tabindex="-1"]');
        if (conteudo) conteudo.focus();
      }
    }

    function fechar() {
      if (!modalAtivoEl) return;
      modalAtivoEl.classList.remove('active');
      modalAtivoEl.style.removeProperty('display');
      if (onFechar) onFechar();
      document.removeEventListener('keydown', trapFocusHandler);
      if (elementoFocoAnterior && typeof elementoFocoAnterior.focus === 'function') {
        elementoFocoAnterior.focus();
      }
      modalAtivoEl = null;
      elementoFocoAnterior = null;
      onFechar = null;
    }

    return { abrir, fechar };
  }

  // ---------- MODAL LOCAL (criar, abrir e fechar por clique-fora/×) ----------
  // Substitui os _abrirModalLocal/_fecharModalLocal antes duplicados por módulo.
  function criarModalLocal(el) {
    if (!el) return null;
    const ctrl = criarModalAcessivel();
    ctrl.abrir(el, function () { if (el.parentNode) el.remove(); });
    el.__ctrl = ctrl;
    el.addEventListener('click', function (e) {
      if (e.target === el) { e.preventDefault(); e.stopPropagation(); ctrl.fechar(); return; }
      const btn = e.target.closest('.modal-close-btn, .btn-modal-fechar, [data-fechar-modal]');
      if (btn) { e.preventDefault(); e.stopPropagation(); ctrl.fechar(); }
    }, true);
    return ctrl;
  }
  function fecharModalLocal(el) {
    if (el && el.__ctrl) el.__ctrl.fechar();
    else if (el) el.remove();
  }

  // ---------- FEEDBACK VISUAL DE "ADICIONADO" NO BOTÃO ----------
  function mostrarFeedbackAdicionar(botao) {
    if (!botao) return;
    var textoOriginal = botao.dataset.textoOriginal || botao.innerHTML;
    botao.dataset.textoOriginal = textoOriginal;
    botao.classList.add('is-added');
    botao.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Adicionado';
    window.setTimeout(function () {
      if (!botao.isConnected) return;
      botao.classList.remove('is-added');
      botao.innerHTML = textoOriginal;
    }, 1300);
  }

  // ---------- DADOS DO CLIENTE (localStorage) ----------
  function salvarDadosClienteLocal(nome, telefone, endereco, mesa) {
    if (!nome && !telefone && !endereco && !mesa) return;
    try {
      localStorage.setItem('ultimoClienteData', JSON.stringify({
        nome: nome || '',
        telefone: telefone || '',
        endereco: endereco || '',
        mesa: mesa || '',
        timestamp: Date.now()
      }));
    } catch (e) { /* localStorage cheio ou bloqueado */ }
  }
  function carregarDadosClienteLocal() {
    try {
      var s = localStorage.getItem('ultimoClienteData');
      if (!s) return null;
      return JSON.parse(s);
    } catch (e) { return null; }
  }

  // ---------- MÁSCARA DE TELEFONE ----------
  function aplicarMascaraTelefone(input) {
    if (!input || input.__mascaraAplicada) return;
    input.__mascaraAplicada = true;
    input.addEventListener('input', function () {
      var value = input.value.replace(/\D/g, '');
      if (value.length > 11) value = value.slice(0, 11);
      var formatted = '';
      if (value.length > 0) {
        formatted = '(' + value.slice(0, 2);
        if (value.length > 2) formatted += ') ' + value.slice(2, 7);
        if (value.length > 7) formatted += '-' + value.slice(7, 11);
      }
      input.value = formatted;
    });
  }

  // ---------- JANELA COM HTML ----------
  function abrirJanelaHTML(html) {
    var win = window.open('', '_blank');
    if (!win) return null;
    win.document.open();
    win.document.write(html);
    win.document.close();
    return win;
  }

  // ---------- COMPROVANTE DE PEDIDO (HTML autocontido, aberto em nova aba) ----------
  function gerarComprovanteHTML(pedido, codigoCurto, opcoes) {
    opcoes = opcoes || {};
    function numero(valor) { var c = parseFloat(valor); return Number.isFinite(c) ? c : 0; }
    function texto(valor, fallback) {
      var c = String(valor === undefined || valor === null ? '' : valor).trim();
      return sanitize(c || fallback || '');
    }
    function moeda(valor) { return 'R$ ' + numero(valor).toFixed(2).replace('.', ','); }

    var itens = Array.isArray(pedido.itens) ? pedido.itens : [];
    var itensHTML = itens.length ? '<ul>' + itens.map(function (i) {
      var nomeItem = String(i.nome || 'Item');
      if (i.atributos && typeof i.atributos === 'object') nomeItem += ' (' + Object.keys(i.atributos).map(function (chave) { return chave + ': ' + i.atributos[chave]; }).join(', ') + ')';
      var totalItem = numero(i.precoUnitario) * numero(i.quantidade);
      return '<li><span class="item-quantidade">' + numero(i.quantidade) + 'x</span><span class="item-nome">' + texto(nomeItem, 'Item') + '</span><strong>' + moeda(totalItem) + '</strong></li>';
    }).join('') + '</ul>' : '<p class="vazio">Nenhum item informado.</p>';

    var pagamento = texto(pedido.formaPagamento, 'Não informado');
    if (pagamento === 'Dinheiro' && pedido.trocoPara) pagamento += ' · Troco para ' + moeda(pedido.trocoPara);
    else if (pagamento === 'Dinheiro') pagamento += ' · Não precisa de troco';
    var dataPedido = pedido.criadoEm && typeof pedido.criadoEm.toDate === 'function' ? pedido.criadoEm.toDate() : new Date();

    var camposExtras = (opcoes.camposExtras || []).map(function (c) {
      return '<div><strong>' + sanitize(c.label) + '</strong><span>' + texto(c.valor, '') + '</span></div>';
    }).join('');

    var dados = '<header class="comprovante-cabecalho"><h1>Comprovante de pedido</h1><p><strong>Pedido #' + texto(codigoCurto, '---') + '</strong><span>' + dataPedido.toLocaleString() + '</span></p></header>' +
      '<section class="info"><div><strong>Estabelecimento</strong><span>' + texto(pedido.estabelecimentoNome, 'Não informado') + '</span></div><div><strong>Cliente</strong><span>' + texto(pedido.clienteNome, 'Não informado') + '</span></div><div><strong>Endereço</strong><span>' + texto(pedido.endereco, 'Não informado') + '</span></div><div><strong>Telefone</strong><span>' + texto(pedido.clienteTelefone, 'Não informado') + '</span></div>' + camposExtras + '</section>' +
      '<section class="itens"><h2>Itens do pedido</h2>' + itensHTML + '</section>' +
      '<section class="resumo"><div><span>Subtotal</span><strong>' + moeda(pedido.subtotal) + '</strong></div><div><span>Frete</span><strong>' + moeda(pedido.taxaEntrega) + '</strong></div>' +
      (numero(pedido.descontoPromocoes) > 0 ? '<div class="desconto"><span>Promoções</span><strong>- ' + moeda(pedido.descontoPromocoes) + '</strong></div>' : '') +
      (numero(pedido.descontoAplicado) > 0 ? '<div class="desconto"><span>Cupom</span><strong>- ' + moeda(pedido.descontoAplicado) + '</strong></div>' : '') +
      '<div class="total"><span>Total</span><strong>' + moeda(pedido.total) + '</strong></div></section>' +
      '<section class="detalhes-finais"><p><strong>Pagamento</strong><span>' + pagamento + '</span></p><p><strong>Observação</strong><span>' + texto(pedido.observacao, 'Nenhuma') + '</span></p></section>';

    var conteudo = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Comprovante de Pedido #' + texto(codigoCurto, '') + '</title><style>' +
      '*{box-sizing:border-box}html{background:#eef2f7}body{font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;margin:0;padding:clamp(.75rem,3vw,2rem);background:#eef2f7;color:#172033;min-width:0}.comprovante{width:100%;max-width:760px;margin:0 auto;background:#fff;border:1px solid #dbe3ee;border-radius:clamp(.75rem,2vw,1.25rem);padding:clamp(1rem,4vw,2rem);box-shadow:0 8px 28px rgba(15,23,42,.1);overflow:hidden}.comprovante-cabecalho{border-bottom:2px solid #e6edf5;padding-bottom:1rem;margin-bottom:1rem}.comprovante-cabecalho h1{margin:0 0 .65rem;color:#0a66c2;font-size:clamp(1.25rem,4vw,1.75rem);line-height:1.2}.comprovante-cabecalho p{display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin:0;color:#526174;font-size:clamp(.78rem,2.5vw,.9rem)}.comprovante-cabecalho p strong{color:#172033}.info{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;background:#f7f9fc;border:1px solid #e5ebf3;border-radius:.85rem;padding:clamp(.8rem,3vw,1.1rem);margin-bottom:1.25rem}.info div{min-width:0}.info strong,.detalhes-finais strong{display:block;color:#526174;font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;margin-bottom:.2rem}.info span,.detalhes-finais span{display:block;overflow-wrap:anywhere;font-size:clamp(.82rem,2.5vw,.95rem);line-height:1.4}.itens{margin:0 0 1.25rem}.itens h2{font-size:1rem;margin:0 0 .5rem;color:#172033}.itens ul{list-style:none;padding:0;margin:0;border-top:1px solid #e5ebf3}.itens li{display:grid;grid-template-columns:2.5rem minmax(0,1fr) auto;align-items:start;gap:.5rem;padding:.7rem 0;border-bottom:1px solid #edf1f5;font-size:clamp(.82rem,2.6vw,.95rem)}.item-quantidade{color:#526174;font-weight:700}.item-nome{overflow-wrap:anywhere}.itens li strong{white-space:nowrap;color:#172033}.vazio{color:#64748b;font-size:.9rem}.resumo{border-top:1px solid #dbe3ee;padding-top:.75rem;margin-left:auto;width:min(100%,360px)}.resumo>div{display:flex;justify-content:space-between;gap:1rem;padding:.28rem 0;font-size:clamp(.82rem,2.5vw,.95rem)}.resumo .desconto{color:#15803d}.resumo .total{margin-top:.45rem;padding-top:.65rem;border-top:2px solid #dbe3ee;color:#0a66c2;font-size:clamp(1rem,3.5vw,1.25rem)}.detalhes-finais{display:grid;gap:.75rem;margin-top:1.25rem;padding-top:1rem;border-top:1px solid #e5ebf3}.detalhes-finais p{margin:0}.obrigado{text-align:center;margin:1.5rem 0 0;color:#64748b;font-size:.82rem}@media(max-width:560px){body{padding:.5rem}.comprovante{border-radius:.75rem;padding:1rem}.info{grid-template-columns:1fr;gap:.65rem}.comprovante-cabecalho p{display:block}.comprovante-cabecalho p span{display:block;margin-top:.25rem}.itens li{grid-template-columns:2.25rem minmax(0,1fr);gap:.4rem}.itens li strong{grid-column:2;text-align:right;margin-top:.15rem}.resumo{width:100%}}@media print{html,body{background:#fff}.comprovante{max-width:none;border:0;box-shadow:none;border-radius:0;padding:0}}' +
      '</style></head><body><main class="comprovante">' + dados + '<p class="obrigado">Obrigado pela preferência!</p></main></body></html>';
    return abrirJanelaHTML(conteudo);
  }

  // ---------- POPUP DE CONFIRMAÇÃO ----------
  function mostrarPopupConfirmacao(opcoes) {
    opcoes = opcoes || {};
    var overlay = document.createElement('div');
    overlay.className = 'popup-confirmacao';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', opcoes.titulo || 'Confirmação');

    var msg = opcoes.mensagem || 'Operação realizada com sucesso!';
    var htmlCodigo = '';
    if (opcoes.codigo) {
      htmlCodigo =
        '<div class="popup-confirmacao-codigo">' +
          '<p class="label">Código</p>' +
          '<p class="valor">#' + sanitize(opcoes.codigo) + '</p>' +
          '<button class="btn-adicionar-filtro" ' +
            'style="background:white;color:var(--primary);border:1px solid var(--primary);padding:0.5rem 1rem;margin-top:0.5rem;" ' +
            'data-popup-copiar="' + sanitize(opcoes.codigo) + '"><i class="fas fa-copy" aria-hidden="true"></i> Copiar código</button>' +
        '</div>';
    }

    overlay.innerHTML =
      '<div class="popup-confirmacao-card">' +
        '<div class="popup-confirmacao-header">' +
          '<h3>' + (opcoes.titulo || '') + '</h3>' +
          '<button type="button" class="modal-close-btn popup-confirmacao-close" data-popup-fechar aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="popup-confirmacao-body">' +
          '<p>' + msg + '</p>' +
          htmlCodigo +
          '<div class="popup-confirmacao-botoes">' + (opcoes.botoes || '') + '</div>' +
        '</div>' +
        '<div class="popup-confirmacao-footer">' +
          '<button class="btn-modal-fechar" data-popup-fechar>Fechar</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var ctrl = criarModalAcessivel();
    ctrl.abrir(overlay, function () {
      overlay.remove();
      if (opcoes.onClose) {
        try { new Function(opcoes.onClose).call(window); } catch (e) {}
      }
    });

    var btnCopiar = overlay.querySelector('[data-popup-copiar]');
    if (btnCopiar) {
      btnCopiar.addEventListener('click', function () {
        var cod = btnCopiar.dataset.popupCopiar;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(cod).then(function () {
            mostrarToast('Código copiado!', 'sucesso');
          });
        }
      });
    }

    overlay.querySelectorAll('[data-popup-fechar]').forEach(function (b) {
      b.addEventListener('click', function () { ctrl.fechar(); });
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) ctrl.fechar();
    });

    return { fechar: function () { ctrl.fechar(); }, elemento: overlay };
  }

  // ---------- CONFIRMAÇÃO VISUAL COMPARTILHADA ----------
  function confirmar(mensagem, opcoes) {
    opcoes = opcoes || {};
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-labelledby', 'economizei-confirmacao-titulo');
      overlay.setAttribute('aria-describedby', 'economizei-confirmacao-mensagem');

      var conteudo = document.createElement('div');
      conteudo.className = 'modal-conteudo modal-sm modal-confirmar';
      conteudo.innerHTML = '<div class="modal-header"><h3 id="economizei-confirmacao-titulo"></h3></div>' +
        '<div class="modal-body"><span class="icone-destaque" aria-hidden="true">!</span><p id="economizei-confirmacao-mensagem"></p></div>' +
        '<div class="modal-footer"><button type="button" class="btn-modal-secundario" data-confirmacao-cancelar></button>' +
        '<button type="button" class="btn-modal-primario btn-modal-perigo" data-confirmacao-ok></button></div>';
      conteudo.querySelector('#economizei-confirmacao-titulo').textContent = opcoes.titulo || 'Confirmar ação';
      conteudo.querySelector('#economizei-confirmacao-mensagem').textContent = mensagem || 'Deseja continuar?';
      conteudo.querySelector('[data-confirmacao-cancelar]').textContent = opcoes.cancelar || 'Cancelar';
      conteudo.querySelector('[data-confirmacao-ok]').textContent = opcoes.confirmar || 'Confirmar';
      overlay.appendChild(conteudo);
      document.body.appendChild(overlay);

      var resultado = false;
      var controle = criarModalAcessivel();
      function encerrar(valor) { resultado = valor; controle.fechar(); }
      conteudo.querySelector('[data-confirmacao-cancelar]').addEventListener('click', function () { encerrar(false); });
      conteudo.querySelector('[data-confirmacao-ok]').addEventListener('click', function () { encerrar(true); });
      overlay.addEventListener('click', function (event) { if (event.target === overlay) encerrar(false); });
      controle.abrir(overlay, function () { overlay.remove(); resolve(resultado); });
    });
  }

  // ============================================================
  // TOAST / LOADING
  // ============================================================
  function mostrarToast(msg, tipo) {
    tipo = tipo || 'info';
    var t = document.createElement('div');
    t.className = 'toast' + (tipo === 'erro' ? ' erro' : tipo === 'sucesso' ? ' sucesso' : '');
    t.setAttribute('role', 'alert');
    t.setAttribute('aria-live', 'assertive');
    t.textContent = msg;
    document.body.appendChild(t);
    window.setTimeout(function () {
      if (!t.isConnected) return;
      t.classList.add('is-leaving');
      window.setTimeout(function () { t.remove(); }, 180);
    }, 2820);
    return t;
  }

  function showLoading(texto, opcoes) {
    opcoes = opcoes || {};
    var overlay = document.getElementById(opcoes.overlayId || 'loadingOverlay');
    if (!overlay) return;
    var textEl = opcoes.textoId === null ? null : document.getElementById(opcoes.textoId || 'loadingText');
    if (textEl && texto) textEl.textContent = texto;
    if (opcoes.modoFlex) overlay.style.display = 'flex';
    else overlay.classList.add('active');
  }

  function hideLoading(opcoes) {
    opcoes = opcoes || {};
    var overlay = document.getElementById(opcoes.overlayId || 'loadingOverlay');
    if (!overlay) return;
    if (opcoes.modoFlex) overlay.style.display = 'none';
    else overlay.classList.remove('active');
  }

  // ============================================================
  // PLACEHOLDER DE LOGO (SVG embutido, sem depender de rede)
  // ============================================================
  var LOGO_PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='150' height='150'%3E%3Crect width='150' height='150' fill='%23e2e8f0'/%3E%3Ctext x='50%25' y='50%25' font-family='sans-serif' font-size='18' fill='%2364748b' text-anchor='middle' dy='.3em'%3ELogo%3C/text%3E%3C/svg%3E";

  // ============================================================
  // EXPORTAÇÃO
  // ============================================================
  global.EconomizeiUtils = {
    // Sanitização e URLs
    sanitize,
    ensureHttps,
    linkSeguro,
    gerarSlug,
    // Validações e formatações
    validarEmail,
    formatarWhatsapp,
    pertencePrefixo,
    // CSV
    parseCSV,
    criarCacheCSV,
    // Favoritos
    criarGerenciadorFavoritos,
    // QR Code
    gerarURLQRCode,
    gerarImagemQRCode,
    // Modal acessível e confirmação visual comum
    criarModalAcessivel,
    criarModalLocal,
    fecharModalLocal,
    mostrarFeedbackAdicionar,
    confirmar,
    // Compartilhados entre módulos
    salvarDadosClienteLocal,
    carregarDadosClienteLocal,
    aplicarMascaraTelefone,
    abrirJanelaHTML,
    gerarComprovanteHTML,
    mostrarPopupConfirmacao,
    // UI geral
    mostrarToast,
    showLoading,
    hideLoading,
    LOGO_PLACEHOLDER
  };
})(window);
