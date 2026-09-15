/* ==============================================================
   ECONOMIZEI! RIO CLARO — UTILITÁRIOS COMPARTILHADOS
   Usado por: grupos, vitrine, trilhas, ônibus, eventos, vagas,
              e todos os módulos (loja, pedidos, transporte).
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
      modalEl.style.display = 'flex';
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
      modalAtivoEl.style.display = 'none';
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

  // ---------- DADOS DO CLIENTE (localStorage) ----------
  // Compartilhado entre módulos (Pedidos, Transporte) para lembrar
  // nome/telefone/endereço/mesa sem o cliente redigitar.
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
  // Registra o listener de input num <input type="tel"> e aplica
  // a máscara (99) 99999-9999 conforme digita.
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

  // ---------- JANELA COM HTML (comprovante) ----------
  // Abre uma nova janela do navegador e escreve HTML nela. Usado para
  // comprovantes (Pedidos, Loja, Transporte). Devolve a janela ou null
  // se o navegador bloquear.
  function abrirJanelaHTML(html) {
    var win = window.open('', '_blank');
    if (!win) return null;
    win.document.open();
    win.document.write(html);
    win.document.close();
    return win;
  }

  // ---------- POPUP DE CONFIRMAÇÃO ----------
  // Popup flutuante com código copiável + botões de ação.
  //   mostrarPopupConfirmacao({
  //     titulo:   '✅ Pedido Confirmado!',
  //     mensagem: 'Seu pedido foi enviado com sucesso!',   // opcional
  //     codigo:   'ABC123',                                // opcional
  //     botoes:   '<button>…</button>',                    // opcional
  //     onClose:  'funcaoASerChamada()'                    // opcional (string)
  //   })
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
            'data-popup-copiar="' + sanitize(opcoes.codigo) + '">📋 Copiar código</button>' +
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

    // Acessibilidade: foco preso, Esc fecha
    var ctrl = criarModalAcessivel();
    ctrl.abrir(overlay, function () {
      overlay.remove();
      if (opcoes.onClose) {
        try { new Function(opcoes.onClose).call(window); } catch (e) {}
      }
    });

    // Copiar código
    var btnCopiar = overlay.querySelector('[data-popup-copiar]');
    if (btnCopiar) {
      btnCopiar.addEventListener('click', function () {
        var cod = btnCopiar.dataset.popupCopiar;
        if (navigator.clipboard) {
          navigator.clipboard.writeText(cod).then(function () {
            var t = document.createElement('div');
            t.className = 'toast';
            t.textContent = 'Código copiado!';
            t.setAttribute('role', 'alert');
            document.body.appendChild(t);
            setTimeout(function () { t.remove(); }, 2400);
          });
        }
      });
    }

    // Botões que fecham
    overlay.querySelectorAll('[data-popup-fechar]').forEach(function (b) {
      b.addEventListener('click', function () { ctrl.fechar(); });
    });

    // Clique no overlay (fora do card) fecha
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) ctrl.fechar();
    });

    return { fechar: function () { ctrl.fechar(); }, elemento: overlay };
  }

  // ============================================================
  // EXPORTAÇÃO
  // ============================================================
  global.EconomizeiUtils = {
    // Sanitização e URLs
    sanitize,
    ensureHttps,
    linkSeguro,
    gerarSlug,
    // CSV
    parseCSV,
    criarCacheCSV,
    // Favoritos
    criarGerenciadorFavoritos,
    // QR Code
    gerarURLQRCode,
    gerarImagemQRCode,
    // Modal acessível
    criarModalAcessivel,
    // Compartilhados entre módulos
    salvarDadosClienteLocal,
    carregarDadosClienteLocal,
    aplicarMascaraTelefone,
    abrirJanelaHTML,
    mostrarPopupConfirmacao
  };
})(window);
