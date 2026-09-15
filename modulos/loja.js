/* ============================================================
   MÓDULO LOJA — Registro + lógica + HTML do modal
   Depende de: economizei-core.js, comum/modulos.js (opcional),
               modais.css, componentes.css, _base.css, loja.css
   Carregar DEPOIS do core.
   ============================================================ */
(function () {
  'use strict';
  if (!window.Economizei) window.Economizei = {};
  if (!Economizei.Cards) { console.error('[loja] Core não carregado.'); return; }

  var Core = Economizei.Core;
  var UI = Economizei.UI;
  var Cards = Economizei.Cards;
  var COLUNAS = Economizei.Horario.COLUNAS;

  // ============================================================
  // REGISTRO NO CORE (o botão aparece automaticamente nos cards)
  // ============================================================
  Cards.registrarModulo('loja', {
    label: '🛍️ Ver produtos',
    ariaLabel: 'Ver produtos da loja',
    onClick: function (idx) { return 'Economizei.Loja.abrirModal(' + idx + ')'; }
  });

  // ============================================================
  // IDENTIFICAÇÃO DO MÓDULO NOS CARDS (badge visual)
  // ============================================================
  (function instalarBadgeModulos() {
    if (window.__economizeiBadgeModulos) return;
    window.__economizeiBadgeModulos = true;

    var configs = {
      pedidos:     { label: 'Módulo Pedidos',     icone: 'fa-utensils',            desc: 'Este cadastro permite fazer pedidos online.' },
      loja:        { label: 'Módulo Loja',        icone: 'fa-store',               desc: 'Este estabelecimento oferece uma vitrine digital para você comprar online.' },
      transporte:  { label: 'Módulo Transporte',  icone: 'fa-taxi',                desc: 'Este cadastro permite solicitar corridas/fretes online.' },
      orcamentos:  { label: 'Módulo Orçamentos',  icone: 'fa-file-invoice-dollar', desc: 'Este cadastro permite solicitar orçamentos online.' },
      agendamentos:{ label: 'Módulo Agendamentos',icone: 'fa-calendar-check',      desc: 'Este cadastro permite realizar agendamentos online.' },
      hospedagem:  { label: 'Módulo Hospedagem',  icone: 'fa-bed',                 desc: 'Este cadastro permite fazer reservas de hospedagem online.' }
    };
    var aliases = {
      pedido: 'pedidos', pedidos: 'pedidos',
      loja: 'loja', 'loja online': 'loja', ecommerce: 'loja',
      transporte: 'transporte', taxi: 'transporte', taxis: 'transporte',
      orcamento: 'orcamentos', orcamentos: 'orcamentos',
      agendamento: 'agendamentos', agendamentos: 'agendamentos',
      hospedagem: 'hospedagem'
    };
    var tooltipAberto = null;

    function normalizar(v) {
      return String(v || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    function obterModulo(card) {
      var estilo = normalizar(card.dataset.estilo);
      return aliases[estilo] || '';
    }
    function fecharTooltip() {
      if (!tooltipAberto) return;
      if (tooltipAberto.botao) {
        tooltipAberto.botao.classList.remove('tooltip-aberto');
        tooltipAberto.botao.setAttribute('aria-expanded', 'false');
        tooltipAberto.botao.removeAttribute('aria-describedby');
      }
      if (tooltipAberto.elemento && tooltipAberto.elemento.parentNode) tooltipAberto.elemento.remove();
      tooltipAberto = null;
    }
    function posicionarTooltip() {
      if (!tooltipAberto || !tooltipAberto.botao || !tooltipAberto.elemento) return;
      var b = tooltipAberto.botao, t = tooltipAberto.elemento;
      var r = b.getBoundingClientRect(), m = 8;
      var l = Math.max(m, Math.min(r.left + r.width / 2 - t.offsetWidth / 2, window.innerWidth - t.offsetWidth - m));
      var top = r.top - t.offsetHeight - m;
      if (top < m) top = r.bottom + m;
      t.style.left = l + 'px';
      t.style.top = Math.max(m, top) + 'px';
    }
    function abrirTooltip(botao, modulo) {
      fecharTooltip();
      var meta = configs[modulo];
      if (!meta) return;
      var tt = document.createElement('div');
      tt.className = 'tooltip-modulo-flutuante';
      tt.id = 'tooltip-' + modulo + '-' + Date.now();
      tt.setAttribute('role', 'tooltip');
      tt.textContent = meta.desc;
      document.body.appendChild(tt);
      botao.classList.add('tooltip-aberto');
      botao.setAttribute('aria-expanded', 'true');
      tt._ref = { botao: botao, elemento: tt };
      tooltipAberto = tt._ref;
      botao.setAttribute('aria-describedby', tt.id);
      posicionarTooltip();
      requestAnimationFrame(function () {
        if (tooltipAberto && tooltipAberto.elemento === tt) tt.classList.add('visivel');
      });
    }
    function vincularBotao(botao, modulo) {
      botao.addEventListener('mouseenter', function () { abrirTooltip(botao, modulo); });
      botao.addEventListener('mouseleave', fecharTooltip);
      botao.addEventListener('focus', function () { abrirTooltip(botao, modulo); });
      botao.addEventListener('blur', fecharTooltip);
      botao.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); abrirTooltip(botao, modulo); });
      botao.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') e.stopPropagation(); });
    }
    function renderizarSelos() {
      document.querySelectorAll('.card').forEach(function (card) {
        var content = card.querySelector('.card-content');
        if (!content) return;
        var slot = content.querySelector('.badge-modulo-slot');
        if (!slot) {
          slot = document.createElement('div');
          slot.className = 'badge-modulo-slot';
          slot.setAttribute('aria-hidden', 'true');
          var titulo = content.querySelector('.card-title');
          if (titulo) content.insertBefore(slot, titulo); else content.appendChild(slot);
        }
        var modulo = obterModulo(card);
        var existente = slot.querySelector('.badge-modulo-card');
        if (!modulo) { if (existente) existente.remove(); return; }
        if (existente && existente.dataset.modulo === modulo) return;
        if (existente) existente.remove();
        var meta = configs[modulo];
        var aria = card.getAttribute('aria-label') || '';
        if (aria.indexOf(meta.label) === -1) card.setAttribute('aria-label', aria + ', ' + meta.label);
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'badge-modulo-card';
        btn.dataset.modulo = modulo;
        btn.title = meta.desc;
        btn.setAttribute('aria-label', meta.label + '. Clique para saber mais.');
        btn.setAttribute('aria-expanded', 'false');
        btn.innerHTML = '<i class="fas ' + meta.icone + '" aria-hidden="true"></i><span>' + meta.label + '</span>';
        slot.appendChild(btn);
        vincularBotao(btn, modulo);
      });
    }
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.badge-modulo-card')) fecharTooltip();
    }, true);
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') fecharTooltip(); }, true);
    window.addEventListener('resize', fecharTooltip);
    window.addEventListener('scroll', fecharTooltip, true);
    var lista = document.getElementById('lista') || document.body;
    if (window.MutationObserver) {
      var obs = new MutationObserver(renderizarSelos);
      obs.observe(lista, { childList: true, subtree: true });
    }
    renderizarSelos();
  })();

  // ============================================================
  // LÓGICA DO MODAL DA LOJA
  // ============================================================
  function abrirModal(idx) {
    var est = Cards.dadosProcessados[idx];
    if (!est) { UI.mostrarToast('Estabelecimento não encontrado.'); return; }

    var nomeEstab = est[COLUNAS.NOME];
    var logoEstab = est[COLUNAS.IMAGEM] || '';
    var estId = est[COLUNAS.ID_UNICO];

    var carrinho = [];
    var cupomDesconto = 0;
    var cupomAtual = null;
    var promocoesCache = [];
    var currentLojistaId = null;
    var produtosCache = [];
    var fretesCache = [];
    var statusLojaAtual = 'aberta';
    var unsubscribeCardapio = null;
    var unsubscribeFretes = null;
    var unsubscribeStatusLoja = null;

    // ---------- HELPERS ----------
    function normalizarImagens(imgs) {
      var lista = Array.isArray(imgs) ? imgs : (typeof imgs === 'string' ? imgs.split(',') : []);
      return lista.map(function (s) { return String(s || '').trim(); }).filter(function (s, i, a) { return s !== '' && a.indexOf(s) === i; });
    }
    function estoqueSemLimite(v) { return v === undefined || v === null || String(v).trim() === ''; }
    function obterEstoqueNumerico(v) { if (estoqueSemLimite(v)) return null; var n = parseInt(v, 10); return Number.isFinite(n) ? n : null; }
    function textoEstoque(v) { var n = obterEstoqueNumerico(v); return n === null ? 'Ilimitado' : String(n); }
    function estoqueDisponivel(v, q) { var n = obterEstoqueNumerico(v); return n === null || q <= n; }
    function obterLogoDoCadastro(data) {
      var c = [data && data.logoUrl, data && data.logo, data && data.imagemLogo, data && data.imagem];
      for (var i = 0; i < c.length; i++) if (typeof c[i] === 'string' && /^https?:\/\//i.test(c[i].trim())) return c[i].trim();
      return '';
    }
    function gerarIniciais(nome) {
      var p = String(nome || 'Loja').trim().split(/\s+/).filter(Boolean);
      return (p.slice(0, 2).map(function (x) { return x.charAt(0); }).join('') || 'L').toUpperCase();
    }
    function obterImagensBase(p) {
      if (p && p.__imagemFallbackVariacao) return normalizarImagens(p.imagens);
      var imgs = [];
      if (p && p.imagem) imgs.push(String(p.imagem).trim());
      imgs = imgs.concat(normalizarImagens(p && p.imagens));
      return normalizarImagens(imgs);
    }
    function obterImagensVariacao(v) {
      if (!v) return [];
      var imgs = [];
      if (v.imagem) imgs.push(String(v.imagem).trim());
      imgs = imgs.concat(normalizarImagens(v.imagens || v.imagensAdicionais || v.fotos));
      return normalizarImagens(imgs);
    }
    function obterImagensProduto(p) { return obterGaleria(p).map(function (x) { return x.url; }); }
    function obterGaleria(p) {
      var g = [], vistos = {};
      function add(url, v) { url = String(url || '').trim(); if (!url || vistos[url]) return; vistos[url] = true; g.push({ url: url, variacao: v || null }); }
      obterImagensBase(p).forEach(function (u) { add(u, null); });
      (p && Array.isArray(p.variacoes) ? p.variacoes : []).forEach(function (v) { obterImagensVariacao(v).forEach(function (u) { add(u, v); }); });
      return g;
    }
    function obterImagemPrincipal(p) {
      var b = obterImagensBase(p); if (b.length) return b[0];
      var a = obterImagensProduto(p); return a.length ? a[0] : null;
    }
    function formatarValor(v) { return 'R$ ' + (Math.max(0, parseFloat(v) || 0)).toFixed(2).replace('.', ','); }
    function assinaturaAtributos(a) { if (!a || typeof a !== 'object') return ''; return Object.keys(a).sort().map(function (k) { return k + '=' + String(a[k]); }).join('|'); }
    function obterIdsVariacao(v) {
      if (!v) return [];
      var vals = [];
      ['variacaoId', 'sku', 'id'].forEach(function (c) { if (v[c] !== undefined && v[c] !== null && String(v[c]) !== '') vals.push(String(v[c])); });
      var a = assinaturaAtributos(v.atributos); if (a) vals.push(a);
      var ids = [];
      vals.forEach(function (x) { if (ids.indexOf(x) === -1) ids.push(x); });
      return ids;
    }
    function obterIdVariacao(v) { var i = obterIdsVariacao(v); return i.length ? i[0] : null; }
    function promocaoValida(p) {
      if (!p || p.ativo !== 'sim') return false;
      var hoje = new Date(); hoje.setHours(0, 0, 0, 0);
      if (p.inicio && new Date(p.inicio + 'T00:00:00') > hoje) return false;
      if (p.fim && new Date(p.fim + 'T23:59:59') < new Date()) return false;
      if (p.validade && new Date(p.validade + 'T23:59:59') < new Date()) return false;
      return true;
    }
    function limiteUsos(c) { var n = parseInt(c && c.limiteUsos, 10); return Number.isInteger(n) && n > 0 ? n : null; }
    function usosCupom(c) { var n = parseInt(c && c.usosTotal, 10); return Number.isInteger(n) && n >= 0 ? n : 0; }
    function promocaoAplica(p, item) {
      if (!promocaoValida(p)) return false;
      if (!Array.isArray(p.produtoIds) || !p.produtoIds.some(function (id) { return String(id) === String(item.id); })) return false;
      if (p.aplicacao === 'especificas') {
        var ids = obterIdsVariacao(item);
        return Array.isArray(p.variacoes) && p.variacoes.some(function (v) {
          if (String(v.produtoId) !== String(item.id)) return false;
          var ip = obterIdsVariacao(v);
          return ids.some(function (i) { return ip.indexOf(i) !== -1; });
        });
      }
      return true;
    }
    function faixaAplicada(p, preco, q) {
      if (!p || p.tipo !== 'quantidade' || !Array.isArray(p.faixas)) return null;
      var sub = preco * q, melhor = null;
      if (p.quantidadeModo === 'a_partir') {
        p.faixas.forEach(function (f) {
          var qf = parseInt(f.quantidade) || 0, pf = Math.max(0, parseFloat(f.preco) || 0);
          if (qf <= 0 || q < qf) return;
          var total = pf * q;
          if (total < sub && (!melhor || pf < melhor.preco || (pf === melhor.preco && qf > melhor.quantidade))) melhor = { quantidade: qf, preco: pf, pacotes: 0, restante: 0, subtotalPromocional: total };
        });
        return melhor;
      }
      p.faixas.forEach(function (f) {
        var qf = parseInt(f.quantidade) || 0, pf = Math.max(0, parseFloat(f.preco) || 0);
        if (qf <= 0 || q < qf) return;
        var pac = Math.floor(q / qf), rest = q % qf, total = pac * pf + rest * preco;
        if (total < sub && (!melhor || total < melhor.subtotalPromocional)) melhor = { quantidade: qf, preco: pf, pacotes: pac, restante: rest, subtotalPromocional: total };
      });
      return melhor;
    }
    function proximaFaixa(p, q) {
      if (!p || p.tipo !== 'quantidade' || !Array.isArray(p.faixas)) return null;
      return p.faixas.map(function (f) { return { quantidade: parseInt(f.quantidade) || 0, preco: Math.max(0, parseFloat(f.preco) || 0) }; })
        .filter(function (f) { return f.quantidade > q; })
        .sort(function (a, b) { return a.quantidade - b.quantidade; })[0] || null;
    }
    function subtotalPromocao(p, preco, q) {
      var sub = preco * q;
      if (!p) return sub;
      if (p.tipo === 'preco') return Math.min(sub, Math.max(0, parseFloat(p.valor) || 0) * q);
      if (p.tipo === 'percentual') { var pc = Math.min(100, Math.max(0, parseFloat(p.valor) || 0)); return sub * (1 - pc / 100); }
      if (p.tipo === 'quantidade') { var f = faixaAplicada(p, preco, q); return f ? f.subtotalPromocional : sub; }
      return sub;
    }
    function resumoCondicao(p, f, preco) {
      if (!p) return '';
      if (p.tipo === 'quantidade' && f) {
        if (p.quantidadeModo === 'a_partir') return 'A partir de ' + f.quantidade + ' unidades: ' + formatarValor(f.preco) + ' por peça';
        var partes = [];
        if (f.pacotes > 0) partes.push(f.pacotes + ' pacote' + (f.pacotes === 1 ? '' : 's') + ' de ' + f.quantidade + ' por ' + formatarValor(f.preco));
        if (f.restante > 0) partes.push(f.restante + ' unidade' + (f.restante === 1 ? '' : 's') + ' por ' + formatarValor(preco));
        return partes.join(' + ');
      }
      if (p.tipo === 'quantidade') {
        var primeira = Array.isArray(p.faixas) ? p.faixas.map(function (x) { return { quantidade: parseInt(x.quantidade) || 0, preco: Math.max(0, parseFloat(x.preco) || 0) }; })
          .filter(function (x) { return x.quantidade > 0; }).sort(function (a, b) { return a.quantidade - b.quantidade; })[0] : null;
        return primeira ? primeira.quantidade + ' por ' + formatarValor(primeira.preco) : 'Oferta por quantidade';
      }
      if (p.tipo === 'percentual') return (parseFloat(p.valor) || 0) + '% de desconto';
      return 'Preço promocional: ' + formatarValor(p.valor);
    }
    function calcularOfertaItem(item) {
      var q = Math.max(1, parseInt(item.quantidade) || 1);
      var preco = Math.max(0, parseFloat(item.preco) || 0);
      var subOrig = preco * q, subPromo = subOrig, promocao = null, promocaoDisp = null, proxima = null;
      promocoesCache.forEach(function (c) {
        if (!promocaoAplica(c, item)) return;
        var subCand = subtotalPromocao(c, preco, q);
        if (c.tipo === 'quantidade' && subCand >= subOrig) {
          var fs = proximaFaixa(c, q);
          if (fs && !proxima) { promocaoDisp = c; proxima = fs; }
        }
        if (subCand < subPromo) { subPromo = subCand; promocao = c; }
      });
      var subFinal = Math.max(0, subPromo);
      var fAplic = promocao && promocao.tipo === 'quantidade' ? faixaAplicada(promocao, preco, q) : null;
      var pExib = promocao || promocaoDisp;
      var fExib = fAplic || proxima;
      return {
        promocao: promocao, promocaoDisponivel: promocaoDisp,
        faixaAplicada: fAplic, faixaSeguinte: proxima,
        precoOriginal: preco, quantidade: q,
        subtotalOriginal: subOrig, subtotalPromocional: subFinal,
        desconto: Math.max(0, subOrig - subFinal),
        precoUnitarioPromocional: q ? subFinal / q : preco,
        condicaoPromocao: resumoCondicao(pExib, fExib, preco)
      };
    }
    function resumoPromocoes() {
      return carrinho.reduce(function (r, item) {
        var o = calcularOfertaItem(item);
        r.subtotalOriginal += o.subtotalOriginal;
        r.subtotalPromocional += o.subtotalPromocional;
        r.descontoPromocoes += o.desconto;
        if (o.promocao) r.promocoesAplicadas.push({ id: o.promocao.id || null, nome: o.promocao.nome || 'Promoção', itemId: item.id, variacaoId: item.variacaoId || null, desconto: o.desconto });
        return r;
      }, { subtotalOriginal: 0, subtotalPromocional: 0, descontoPromocoes: 0, promocoesAplicadas: [] });
    }
    function obterOfertaProduto(p) {
      var cand = promocoesCache.filter(function (x) { return promocaoValida(x) && Array.isArray(x.produtoIds) && x.produtoIds.some(function (id) { return String(id) === String(p.id); }); });
      if (!cand.length) return null;
      var base = p.tipo === 'variavel' && Array.isArray(p.variacoes) && p.variacoes.length ? Math.min.apply(null, p.variacoes.map(function (v) { return parseFloat(v.preco) || 0; })) : (parseFloat(p.preco) || 0);
      var melhor = null, melhorPreco = base;
      cand.forEach(function (c) {
        if (c.aplicacao === 'especificas') { if (!melhor) melhor = c; return; }
        var pc = subtotalPromocao(c, base, 1);
        if (!melhor || pc < melhorPreco) { melhor = c; melhorPreco = pc; }
      });
      var prom = melhor || cand[0];
      if (prom.aplicacao === 'especificas') return { promocao: prom, precoOriginal: base, precoPromocional: base, texto: 'Oferta em algumas variações', apenasAlgumas: true };
      if (prom.tipo === 'preco' || prom.tipo === 'percentual') {
        var pp = subtotalPromocao(prom, base, 1);
        var txt = prom.tipo === 'percentual' ? (parseFloat(prom.valor) || 0) + '% OFF' : 'Oferta';
        return { promocao: prom, precoOriginal: base, precoPromocional: pp, texto: txt };
      }
      var pf = Array.isArray(prom.faixas) ? prom.faixas.map(function (x) { return { quantidade: parseInt(x.quantidade) || 0, preco: Math.max(0, parseFloat(x.preco) || 0) }; })
        .filter(function (x) { return x.quantidade > 0; }).sort(function (a, b) { return a.quantidade - b.quantidade; })[0] : null;
      var tq = pf ? (prom.quantidadeModo === 'a_partir' ? 'A partir de ' + pf.quantidade + ' un.: ' + formatarValor(pf.preco) + '/peça' : 'A cada ' + pf.quantidade + ' un.: ' + formatarValor(pf.preco) + '/grupo') : 'Oferta por quantidade';
      return { promocao: prom, precoOriginal: base, precoPromocional: base, texto: tq };
    }
    function carregarPromocoes() {
      if (!currentLojistaId) return Promise.resolve();
      return Core.db.collection('lojistas').doc(currentLojistaId).collection('promocoes').get().then(function (snap) {
        promocoesCache = [];
        snap.forEach(function (d) { promocoesCache.push(Object.assign({ id: d.id }, d.data())); });
        var c = document.getElementById('produtosContainer');
        if (c && produtosCache.length) c.innerHTML = renderizarProdutos(produtosCache);
        atualizarCarrinho();
      }).catch(function (e) { promocoesCache = []; console.error(e); });
    }
    function calcularDescontoCupom(sub, frete) {
      if (!cupomAtual || !promocaoValida(Object.assign({ ativo: 'sim' }, cupomAtual))) return 0;
      var lim = limiteUsos(cupomAtual);
      if (lim !== null && usosCupom(cupomAtual) >= lim) return 0;
      var total = sub + frete;
      if (cupomAtual.minimoPedido && total < parseFloat(cupomAtual.minimoPedido)) return 0;
      var v = parseFloat(cupomAtual.valor) || 0;
      var desc = cupomAtual.tipo === 'percentual' ? total * v / 100 : v;
      return Math.min(total, Math.max(0, desc));
    }

    // ---------- CARRINHO ----------
    function atualizarCarrinho() {
      var cont = document.getElementById('carrinhoLista');
      if (!cont) return;
      if (carrinho.length === 0) { cont.innerHTML = '<p style="text-align:center;padding:1rem;">Carrinho vazio</p>'; recalcularTotal(); atualizarBadge(); return; }
      var sub = 0;
      cont.innerHTML = carrinho.map(function (it) {
        var sItem = it.preco * it.quantidade; sub += sItem;
        var of = calcularOfertaItem(it);
        var ph = '<div>Preço unitário: ' + formatarValor(it.preco) + '</div>';
        if (of.desconto > 0) {
          ph += '<div style="color:#059669;font-size:.72rem;"><strong>Promoção:</strong> ' + of.condicaoPromocao + '<br><strong>Desconto:</strong> -' + formatarValor(of.desconto) + '</div>';
          ph += '<strong style="color:#059669;">Total do item: ' + formatarValor(of.subtotalPromocional) + '</strong>';
        } else {
          ph += '<strong>Total do item: ' + formatarValor(of.subtotalOriginal) + '</strong>';
        }
        return '<div class="item-carrinho">' +
          '<img src="' + (it.imagem || 'https://via.placeholder.com/40') + '" class="item-carrinho-imagem" onerror="this.style.display=\'none\'">' +
          '<div style="flex:1"><strong>' + Core.sanitize(it.nome) + '</strong><br>' + ph + '</div>' +
          '<input type="number" min="1" value="' + it.quantidade + '" class="qtd-item" data-id="' + it.id + '" data-variacao="' + (it.variacaoId || '') + '" onchange="Economizei.Loja.alterarQuantidade(\'' + Core.jsEscape(it.id) + '\', this.value, \'' + (it.variacaoId || '') + '\')">' +
          '<button class="btn-pequeno" onclick="Economizei.Loja.removerDoCarrinho(\'' + Core.jsEscape(it.id) + '\', \'' + (it.variacaoId || '') + '\')">✕</button>' +
          '</div>';
      }).join('');
      document.getElementById('carrinhoSubtotal').innerText = sub.toFixed(2);
      recalcularTotal(); atualizarBadge();
    }
    function recalcularTotal() {
      var r = resumoPromocoes();
      var frete = parseFloat(document.getElementById('selectFreteLoja') && document.getElementById('selectFreteLoja').value) || 0;
      cupomDesconto = calcularDescontoCupom(r.subtotalPromocional, frete);
      var total = Math.max(0, r.subtotalPromocional + frete - cupomDesconto);
      var tEl = document.getElementById('totalLoja');
      var sEl = document.getElementById('carrinhoSubtotal');
      var pEl = document.getElementById('promocaoLojaResumo');
      if (sEl) sEl.innerText = r.subtotalPromocional.toFixed(2);
      if (pEl) pEl.innerHTML = r.descontoPromocoes > 0 ? '<span style="color:#059669;">Promoções: - R$ ' + r.descontoPromocoes.toFixed(2) + '</span>' : '';
      if (tEl) tEl.innerText = total.toFixed(2);
    }
    function atualizarBadge() {
      var total = carrinho.reduce(function (a, i) { return a + i.quantidade; }, 0);
      var b = document.getElementById('cartBadgeLoja');
      if (b) { if (total > 0) { b.textContent = total; b.style.display = 'inline-block'; b.setAttribute('aria-label', total + ' itens no carrinho'); } else b.style.display = 'none'; }
    }
    function adicionarAoCarrinho(prodId) {
      if (statusLojaAtual !== 'aberta') { UI.mostrarToast('A loja está fechada ou pausada no momento.', 'erro'); return; }
      var p = produtosCache.find(function (x) { return x.id === prodId; });
      if (!p) return;
      if (p.tipo === 'variavel' && p.variacoes && p.variacoes.length) { abrirModalVariacoes(p); return; }
      var est = obterEstoqueNumerico(p.estoque);
      if (est !== null && est <= 0) { UI.mostrarToast('Produto esgotado.', 'erro'); return; }
      var q = document.getElementById('qtd_simples_' + prodId);
      var qt = q ? parseInt(q.value) : 1; if (isNaN(qt) || qt < 1) qt = 1;
      var ex = carrinho.find(function (i) { return i.id === prodId && !i.variacaoId; });
      if (ex) ex.quantidade += qt;
      else carrinho.push({ id: p.id, nome: p.nome, preco: parseFloat(p.preco) || 0, quantidade: qt, imagem: p.imagem || null, variacaoId: null, estoque: p.estoque });
      atualizarCarrinho(); UI.mostrarToast('Produto adicionado ao carrinho');
    }
    function removerDoCarrinho(id, vId) {
      if (!confirm('Remover este item do carrinho?')) return;
      carrinho = carrinho.filter(function (i) { if (vId) return !(i.id === id && i.variacaoId === vId); return i.id !== id; });
      atualizarCarrinho();
    }
    function alterarQuantidade(id, q, vId) {
      q = parseInt(q); if (isNaN(q) || q < 1) q = 1;
      var it = carrinho.find(function (i) { if (vId) return i.id === id && i.variacaoId === vId; return i.id === id && !i.variacaoId; });
      if (it) {
        var est = obterEstoqueNumerico(it.estoque);
        if (est !== null && q > est) { UI.mostrarToast('Estoque insuficiente. Disponível: ' + est, 'erro'); atualizarCarrinho(); return; }
        it.quantidade = q; atualizarCarrinho();
      }
    }
    function aplicarCupom() {
      var cod = document.getElementById('cupomLoja').value.trim().toUpperCase();
      var st = document.getElementById('cupomLojaStatus');
      if (!cod) { cupomAtual = null; st.innerHTML = 'Digite um código.'; recalcularTotal(); return; }
      Core.db.collection('lojistas').where('estabelecimentoId', '==', estId).limit(1).get()
        .then(function (s) { if (s.empty) throw new Error('lojista_nao_encontrado'); return Core.db.collection('lojistas').doc(s.docs[0].id).collection('cupons').where('codigo', '==', cod).where('ativo', '==', 'sim').limit(1).get(); })
        .then(function (s) {
          if (s.empty) throw new Error('cupom_invalido');
          cupomAtual = Object.assign({ id: s.docs[0].id }, s.docs[0].data());
          var lim = limiteUsos(cupomAtual);
          if (lim !== null && usosCupom(cupomAtual) >= lim) throw new Error('cupom_limite');
          if (cupomAtual.validade && new Date(cupomAtual.validade + 'T23:59:59') < new Date()) throw new Error('cupom_invalido');
          var r = resumoPromocoes();
          var fr = parseFloat(document.getElementById('selectFreteLoja') && document.getElementById('selectFreteLoja').value) || 0;
          var d = calcularDescontoCupom(r.subtotalPromocional, fr);
          if (cupomAtual.minimoPedido && d <= 0) throw new Error('pedido_minimo');
          st.innerHTML = '<span style="color:#10b981;">✅ Cupom aplicado! Desconto de ' + (cupomAtual.tipo === 'percentual' ? cupomAtual.valor + '%' : 'R$ ' + (parseFloat(cupomAtual.valor) || 0).toFixed(2)) + '</span>';
          recalcularTotal();
        })
        .catch(function (err) {
          var min = cupomAtual && cupomAtual.minimoPedido;
          cupomAtual = null;
          var m = err.message === 'pedido_minimo' ? '❌ Pedido mínimo: R$ ' + (parseFloat(min) || 0).toFixed(2) : (err.message === 'cupom_invalido' ? '❌ Cupom inválido ou expirado' : '❌ Erro ao validar cupom');
          st.innerHTML = '<span style="color:#dc3545;">' + m + '</span>';
          recalcularTotal();
        });
    }
    function toggleTroco() {
      var val = (document.getElementById('formaPagamentoLoja') || {}).value;
      var w = document.getElementById('trocoParaWrapperLoja');
      var ti = document.getElementById('trocoParaLoja');
      var cb = document.getElementById('semTrocoCheckbox');
      if (cb && !cb.dataset.la) { cb.dataset.la = '1'; cb.addEventListener('change', toggleTroco); }
      var din = val === 'Dinheiro';
      if (w) w.style.display = din ? 'block' : 'none';
      if (ti) { ti.disabled = !din || (cb && cb.checked); if (cb && cb.checked) ti.value = ''; }
    }
    function salvarPedidoComCupom(pedido) {
      var ref = Core.db.collection('pedidos');
      if (!cupomAtual || !cupomAtual.id) return ref.add(pedido);
      var cupRef = Core.db.collection('lojistas').doc(currentLojistaId).collection('cupons').doc(cupomAtual.id);
      var pedRef = ref.doc();
      return Core.db.runTransaction(function (t) {
        return t.get(cupRef).then(function (d) {
          if (!d.exists) throw new Error('cupom_invalido');
          var c = d.data() || {};
          var lim = limiteUsos(c), us = usosCupom(c);
          if (lim !== null && us >= lim) throw new Error('cupom_limite');
          t.set(pedRef, pedido);
          t.update(cupRef, { usosTotal: us + 1 });
        });
      });
    }
    function finalizarPedido() {
      if (statusLojaAtual !== 'aberta') { UI.mostrarToast('A loja está fechada ou pausada no momento.', 'erro'); return; }
      if (carrinho.length === 0) { UI.mostrarToast('Adicione itens ao carrinho.', 'erro'); return; }
      var nome = document.getElementById('clienteNomeLoja').value.trim();
      var tel = document.getElementById('clienteTelLoja').value.trim();
      var end = document.getElementById('enderecoLoja').value.trim();
      if (!nome || nome.length < 2) { UI.mostrarToast('Informe seu nome completo.', 'erro'); return; }
      var tn = tel.replace(/\D/g, '');
      if (!tn || tn.length < 10) { UI.mostrarToast('Telefone inválido. Informe DDD + número.', 'erro'); return; }
      if (!end) { UI.mostrarToast('Informe o endereço para entrega.', 'erro'); return; }
      var selF = document.getElementById('selectFreteLoja');
      var fSel = selF ? String(selF.value || '').trim() : '';
      var fCarregado = !!selF && selF.dataset.freteCarregado === 'true';
      if (selF && !fCarregado) { UI.mostrarToast('Aguarde o carregamento das opções de frete.', 'erro'); selF.focus(); return; }
      var fObrig = !!selF && fretesCache.length > 0;
      if (fObrig && !fSel) { UI.mostrarToast('Selecione o frete antes de confirmar.', 'erro'); selF.focus(); selF.setAttribute('aria-invalid', 'true'); return; }
      if (selF) selF.removeAttribute('aria-invalid');
      var forma = document.getElementById('formaPagamentoLoja').value;
      var cb = document.getElementById('semTrocoCheckbox');
      var ti = document.getElementById('trocoParaLoja');
      var semTroco = !!(cb && cb.checked);
      var tv = ti ? ti.value.trim() : '';
      if (forma === 'Dinheiro' && !semTroco && !tv) { UI.mostrarToast('Informe o valor para troco ou marque "Não preciso de troco".', 'erro'); return; }
      salvarDadosClienteLocal(nome, tn, end);

      var r = resumoPromocoes();
      var sub = r.subtotalPromocional;
      var frete = fSel !== '' ? (parseFloat(fSel) || 0) : 0;
      cupomDesconto = calcularDescontoCupom(sub, frete);
      var total = Math.max(0, sub + frete - cupomDesconto);
      var itens = carrinho.map(function (i) {
        var o = calcularOfertaItem(i);
        return { nome: i.nome, quantidade: i.quantidade, precoUnitario: o.precoUnitarioPromocional, precoUnitarioOriginal: i.preco, variacaoId: i.variacaoId || null, atributos: i.atributos || null, promocao: o.promocao ? o.promocao.nome : null };
      });
      var cod = Math.random().toString(36).substring(2, 8).toUpperCase();
      var pedido = {
        estabelecimentoId: estId, estabelecimentoNome: nomeEstab,
        clienteId: Core.getCurrentUser() ? Core.getCurrentUser().uid : null,
        clienteNome: nome, clienteTelefone: tn, endereco: end,
        itens: itens, subtotal: sub, subtotalOriginal: r.subtotalOriginal,
        descontoPromocoes: r.descontoPromocoes, promocoesAplicadas: r.promocoesAplicadas,
        cupomCodigo: cupomAtual ? cupomAtual.codigo : null,
        descontoAplicado: cupomDesconto, taxaEntrega: frete, total: total,
        formaPagamento: forma, trocoPara: forma === 'Dinheiro' && !semTroco ? tv : '',
        semTroco: forma === 'Dinheiro' ? semTroco : false,
        observacao: document.getElementById('obsLoja').value,
        status: 'pendente', codigoCurto: cod,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      };
      if (!currentLojistaId) { UI.mostrarToast('Erro: lojista não identificado.', 'erro'); return; }
      salvarPedidoComCupom(pedido).then(function () {
        gerarComprovante(pedido, cod);
        mostrarPopupConfirmacao({
          titulo: '✅ Pedido Confirmado!', codigo: cod,
          botoes: '<button class="btn-adicionar-filtro" onclick="document.getElementById(\'consultaRastreio\').value=\'' + cod + '\'; document.querySelector(\'#modalLoja .modal-tab[data-tab=acompanhar]\').click(); this.closest(\'.popup-confirmacao\').remove();">🔍 Acompanhar</button>' +
                  '<button class="btn-adicionar-filtro" style="background:#2c3e50;" onclick="Economizei.Loja.verComprovante(\'' + cod + '\'); this.closest(\'.popup-confirmacao\').remove();">🖨️ Comprovante</button>',
          onClose: 'document.querySelector(\'#modalLoja .modal-tab[data-tab=produtos]\').click();'
        });
        carrinho = []; cupomAtual = null; cupomDesconto = 0;
        atualizarCarrinho();
      }).catch(function (err) {
        if (err.message === 'cupom_limite') { cupomAtual = null; cupomDesconto = 0; recalcularTotal(); UI.mostrarToast('O limite de usos deste cupom já foi atingido.', 'erro'); return; }
        UI.mostrarToast('Erro ao finalizar pedido: ' + err.message, 'erro');
      });
    }
    function consultarPedido() {
      var cod = document.getElementById('consultaRastreio').value.trim().toUpperCase();
      var res = document.getElementById('resultadoRastreio');
      if (!cod) { res.innerHTML = '<p style="color:#dc3545;">Digite o código do pedido.</p>'; return; }
      Core.db.collection('pedidos').where('codigoCurto', '==', cod).limit(1).get().then(function (s) {
        if (s.empty) { res.innerHTML = '<p style="color:#dc3545;">🔍 Pedido não encontrado.</p>'; return; }
        var p = s.docs[0].data();
        var map = { pendente: { l: 'Aguardando Loja', i: '⏳', c: '#f59e0b' }, confirmado: { l: 'Confirmado', i: '✅', c: '#10b981' }, em_preparo: { l: 'Em Preparação', i: '📦', c: '#6366f1' }, saiu_entrega: { l: 'Saiu para Entrega', i: '🚚', c: '#3b82f6' }, concluido: { l: 'Entregue', i: '✅', c: '#10b981' }, cancelado: { l: 'Cancelado', i: '❌', c: '#ef4444' } };
        var st = map[p.status] || map.pendente;
        res.innerHTML = '<div style="background:' + st.c + '10;border:2px solid ' + st.c + ';border-radius:1rem;padding:1rem;">' +
          '<div style="text-align:center;"><span style="font-size:2rem;">' + st.i + '</span><h3 style="color:' + st.c + ';">' + st.l + '</h3></div>' +
          '<p><strong>Data:</strong> ' + (p.criadoEm ? new Date(p.criadoEm.toDate()).toLocaleString() : '---') + '</p>' +
          '<p><strong>Total:</strong> R$ ' + p.total.toFixed(2) + '</p>' +
          '<p><strong>Itens:</strong> ' + (p.itens ? p.itens.map(function (i) { return i.quantidade + 'x ' + i.nome; }).join(', ') : '') + '</p>' +
          '<p><strong>Pagamento:</strong> ' + p.formaPagamento + (p.trocoPara ? ' (Troco para R$ ' + parseFloat(p.trocoPara).toFixed(2) + ')' : '') + '</p></div>';
      });
    }
    function carregarHistorico(estIdLocal) {
      if (!Core.getCurrentUser()) return;
      var c = document.getElementById('listaHistoricoLoja');
      if (!c) return;
      Core.db.collection('pedidos').where('clienteId', '==', Core.getCurrentUser().uid).where('estabelecimentoId', '==', estIdLocal).orderBy('criadoEm', 'desc').limit(20).get().then(function (s) {
        if (s.empty) { c.innerHTML = '<p>Nenhum pedido anterior.</p>'; return; }
        var h = '';
        s.forEach(function (d) {
          var p = d.data();
          var cod = p.codigoCurto || d.id.slice(0, 6).toUpperCase();
          h += '<div style="border:1px solid var(--gray-200);border-radius:.75rem;padding:.75rem;margin-bottom:.5rem;background:#fff;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;">' +
            '<div><strong>#' + cod + '</strong> <span style="background:' + (p.status === 'pendente' ? '#fff7ed' : p.status === 'concluido' ? '#ecfdf5' : '#f1f5f9') + ';padding:.2rem .5rem;border-radius:1rem;font-size:.7rem;">' + (p.status || 'pendente') + '</span></div>' +
            '<div>' + (p.criadoEm ? new Date(p.criadoEm.toDate()).toLocaleString() : '---') + '</div></div>' +
            '<div><strong>Total:</strong> R$ ' + p.total.toFixed(2) + '</div>' +
            '<button class="btn-acao btn-qrcode" style="margin-top:.5rem;" onclick="Economizei.Loja.verComprovante(\'' + cod + '\')">🖨️ Ver comprovante</button>' +
            '</div>';
        });
        c.innerHTML = h;
      });
    }
    function atualizarLogoUI(data) {
      var box = document.querySelector('#modalLoja .modal-estabelecimento-logo');
      if (!box) return;
      var url = obterLogoDoCadastro(data) || logoEstab;
      if (!url) { box.textContent = gerarIniciais(nomeEstab); return; }
      if (box.getAttribute('data-logo-url') === url) return;
      box.setAttribute('data-logo-url', url);
      box.innerHTML = '';
      var img = document.createElement('img');
      img.src = url; img.alt = 'Logo de ' + nomeEstab; img.loading = 'eager'; img.referrerPolicy = 'no-referrer';
      img.onerror = function () { box.removeAttribute('data-logo-url'); box.textContent = gerarIniciais(nomeEstab); };
      box.appendChild(img);
    }
    function atualizarStatusUI(status, msg) {
      var m = document.getElementById('statusLojaMsgLoja');
      var b = document.getElementById('statusLojaBadgeLoja');
      var btn = document.getElementById('btnFinalizarCompra');
      var bloq = status === 'fechada' || status === 'pausada';
      var stt = status === 'fechada' ? 'Loja fechada' : status === 'pausada' ? 'Pedidos pausados' : 'Aceitando pedidos';
      var msm = String(msg || '').trim();
      statusLojaAtual = status;
      if (b) { b.className = 'modal-estabelecimento-status status-' + status; b.textContent = stt; }
      if (m) {
        var mostrar = bloq || msm !== '';
        m.className = 'status-' + status;
        m.style.display = mostrar ? 'flex' : 'none';
        m.innerHTML = '<span class="modal-status-label">Aviso da loja:</span><span class="modal-status-text">' + Core.sanitize(msm || (status === 'fechada' ? 'A loja está fechada no momento.' : 'Os pedidos estão pausados no momento.')) + '</span>';
        m.setAttribute('role', 'alert');
      }
      if (btn) { btn.disabled = bloq; btn.style.opacity = bloq ? '.5' : '1'; btn.style.pointerEvents = bloq ? 'none' : 'auto'; }
    }

    // ---------- COMPROVANTE / POPUP ----------
    function gerarComprovante(pedido, cod) {
      function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
      function txt(v, f) { var s = String(v === undefined || v === null ? '' : v).trim(); return Core.sanitize(s || f || ''); }
      function m(v) { return 'R$ ' + num(v).toFixed(2).replace('.', ','); }
      var itens = Array.isArray(pedido.itens) ? pedido.itens : [];
      var itensHTML = itens.length ? '<ul>' + itens.map(function (i) {
        var n = String(i.nome || 'Item');
        if (i.atributos) n += ' (' + Object.keys(i.atributos).map(function (k) { return k + ': ' + i.atributos[k]; }).join(', ') + ')';
        return '<li><span class="item-quantidade">' + num(i.quantidade) + 'x</span><span class="item-nome">' + txt(n, 'Item') + '</span><strong>' + m(num(i.precoUnitario) * num(i.quantidade)) + '</strong></li>';
      }).join('') + '</ul>' : '<p class="vazio">Nenhum item informado.</p>';
      var pag = txt(pedido.formaPagamento, 'Não informado');
      if (pag === 'Dinheiro' && pedido.trocoPara) pag += ' · Troco para ' + m(pedido.trocoPara);
      else if (pag === 'Dinheiro') pag += ' · Não precisa de troco';
      var dataP = pedido.criadoEm && typeof pedido.criadoEm.toDate === 'function' ? pedido.criadoEm.toDate() : new Date();
      var dados = '<header class="comprovante-cabecalho"><h1>Comprovante de pedido</h1><p><strong>Pedido #' + txt(cod, '---') + '</strong><span>' + dataP.toLocaleString() + '</span></p></header>' +
        '<section class="info"><div><strong>Estabelecimento</strong><span>' + txt(pedido.estabelecimentoNome, 'Não informado') + '</span></div><div><strong>Cliente</strong><span>' + txt(pedido.clienteNome, 'Não informado') + '</span></div><div><strong>Endereço</strong><span>' + txt(pedido.endereco, 'Não informado') + '</span></div><div><strong>Telefone</strong><span>' + txt(pedido.clienteTelefone, 'Não informado') + '</span></div></section>' +
        '<section class="itens"><h2>Itens do pedido</h2>' + itensHTML + '</section>' +
        '<section class="resumo"><div><span>Subtotal</span><strong>' + m(pedido.subtotal) + '</strong></div><div><span>Frete</span><strong>' + m(pedido.taxaEntrega) + '</strong></div>' +
        (num(pedido.descontoPromocoes) > 0 ? '<div class="desconto"><span>Promoções</span><strong>- ' + m(pedido.descontoPromocoes) + '</strong></div>' : '') +
        (num(pedido.descontoAplicado) > 0 ? '<div class="desconto"><span>Cupom</span><strong>- ' + m(pedido.descontoAplicado) + '</strong></div>' : '') +
        '<div class="total"><span>Total</span><strong>' + m(pedido.total) + '</strong></div></section>' +
        '<section class="detalhes-finais"><p><strong>Pagamento</strong><span>' + pag + '</span></p><p><strong>Observação</strong><span>' + txt(pedido.observacao, 'Nenhuma') + '</span></p></section>';
      var html = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Comprovante #' + txt(cod, '') + '</title><style>' +
        '*{box-sizing:border-box}html{background:#eef2f7}body{font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;margin:0;padding:clamp(.75rem,3vw,2rem);background:#eef2f7;color:#172033;min-width:0}.comprovante{width:100%;max-width:760px;margin:0 auto;background:#fff;border:1px solid #dbe3ee;border-radius:clamp(.75rem,2vw,1.25rem);padding:clamp(1rem,4vw,2rem);box-shadow:0 8px 28px rgba(15,23,42,.1);overflow:hidden}.comprovante-cabecalho{border-bottom:2px solid #e6edf5;padding-bottom:1rem;margin-bottom:1rem}.comprovante-cabecalho h1{margin:0 0 .65rem;color:#0a66c2;font-size:clamp(1.25rem,4vw,1.75rem);line-height:1.2}.comprovante-cabecalho p{display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin:0;color:#526174;font-size:clamp(.78rem,2.5vw,.9rem)}.comprovante-cabecalho p strong{color:#172033}.info{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;background:#f7f9fc;border:1px solid #e5ebf3;border-radius:.85rem;padding:clamp(.8rem,3vw,1.1rem);margin-bottom:1.25rem}.info div{min-width:0}.info strong,.detalhes-finais strong{display:block;color:#526174;font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;margin-bottom:.2rem}.info span,.detalhes-finais span{display:block;overflow-wrap:anywhere;font-size:clamp(.82rem,2.5vw,.95rem);line-height:1.4}.itens{margin:0 0 1.25rem}.itens h2{font-size:1rem;margin:0 0 .5rem;color:#172033}.itens ul{list-style:none;padding:0;margin:0;border-top:1px solid #e5ebf3}.itens li{display:grid;grid-template-columns:2.5rem minmax(0,1fr) auto;align-items:start;gap:.5rem;padding:.7rem 0;border-bottom:1px solid #edf1f5;font-size:clamp(.82rem,2.6vw,.95rem)}.item-quantidade{color:#526174;font-weight:700}.item-nome{overflow-wrap:anywhere}.itens li strong{white-space:nowrap;color:#172033}.vazio{color:#64748b;font-size:.9rem}.resumo{border-top:1px solid #dbe3ee;padding-top:.75rem;margin-left:auto;width:min(100%,360px)}.resumo>div{display:flex;justify-content:space-between;gap:1rem;padding:.28rem 0;font-size:clamp(.82rem,2.5vw,.95rem)}.resumo .desconto{color:#15803d}.resumo .total{margin-top:.45rem;padding-top:.65rem;border-top:2px solid #dbe3ee;color:#0a66c2;font-size:clamp(1rem,3.5vw,1.25rem)}.detalhes-finais{display:grid;gap:.75rem;margin-top:1.25rem;padding-top:1rem;border-top:1px solid #e5ebf3}.detalhes-finais p{margin:0}.obrigado{text-align:center;margin:1.5rem 0 0;color:#64748b;font-size:.82rem}@media(max-width:560px){body{padding:.5rem}.comprovante{border-radius:.75rem;padding:1rem}.info{grid-template-columns:1fr;gap:.65rem}.comprovante-cabecalho p{display:block}.comprovante-cabecalho p span{display:block;margin-top:.25rem}.itens li{grid-template-columns:2.25rem minmax(0,1fr);gap:.4rem}.itens li strong{grid-column:2;text-align:right;margin-top:.15rem}.resumo{width:100%}}@media print{html,body{background:#fff}.comprovante{max-width:none;border:0;box-shadow:none;border-radius:0;padding:0}}' +
        '</style></head><body><main class="comprovante">' + dados + '<p class="obrigado">Obrigado pela preferência!</p></main></body></html>';
      var w = window.open('', '_blank');
      if (!w) { UI.mostrarToast('Permita a abertura do comprovante.'); return; }
      w.document.open(); w.document.write(html); w.document.close();
    }
    function mostrarPopupConfirmacao(o) {
      var ov = document.createElement('div');
      ov.className = 'popup-confirmacao';
      ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', o.titulo);
      ov.innerHTML = '<div class="popup-confirmacao-card"><div class="popup-confirmacao-header"><h3>' + o.titulo + '</h3><button type="button" class="modal-close-btn popup-confirmacao-close" onclick="this.closest(\'.popup-confirmacao\').remove()" aria-label="Fechar">×</button></div><div class="popup-confirmacao-body"><p>Seu pedido foi enviado com sucesso!</p><div class="popup-confirmacao-codigo"><p class="label">Código</p><p class="valor">#' + o.codigo + '</p><button class="btn-adicionar-filtro" style="background:#fff;color:var(--primary);border:1px solid var(--primary);padding:.5rem 1rem;margin-top:.5rem;" onclick="navigator.clipboard.writeText(\'' + o.codigo + '\').then(function(){ Economizei.UI.mostrarToast(\'Código copiado!\'); })">📋 Copiar</button></div><div class="popup-confirmacao-botoes">' + o.botoes + '</div></div><div class="popup-confirmacao-footer"><button class="btn-modal-fechar" onclick="this.closest(\'.popup-confirmacao\').remove(); ' + (o.onClose || '') + '">Fechar</button></div></div>';
      document.body.appendChild(ov);
      UI.trapFocus(ov);
    }

    // ---------- RENDERIZAÇÃO ----------
    function renderizarProdutos(produtos) {
      if (!produtos || !produtos.length) return '<p style="text-align:center;padding:2rem;">Nenhum produto disponível.</p>';
      var cats = {};
      produtos.forEach(function (p) { var c = p.categoria || 'Geral'; if (!cats[c]) cats[c] = []; cats[c].push(p); });
      var h = '';
      for (var c in cats) {
        h += '<div class="categoria-group"><div class="categoria-titulo-modal" role="button" tabindex="0" aria-expanded="true" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === \'none\' ? \'grid\' : \'none\';">' + Core.sanitize(c) + ' ▼</div><div class="produtos-grid">';
        cats[c].forEach(function (p) { h += gerarHTMLProduto(p); });
        h += '</div></div>';
      }
      return h;
    }
    function gerarHTMLProduto(p) {
      var tipo = p.tipo || 'simples';
      var temV = tipo === 'variavel' && p.variacoes && p.variacoes.length > 0;
      var esgotado = false;
      var imgs = obterImagensProduto(p);
      var imgPrinc = imgs[0] || null;
      if (tipo === 'variavel') {
        var ilim = p.variacoes.some(function (v) { return estoqueSemLimite(v.estoque); });
        var tot = p.variacoes.reduce(function (a, v) { var e = obterEstoqueNumerico(v.estoque); return a + (e === null ? 0 : e); }, 0);
        esgotado = !ilim && tot <= 0;
      } else {
        var e = parseInt(p.estoque);
        if (!isNaN(e) && e !== null && e !== undefined) esgotado = e <= 0;
      }
      var imgHtml = imgPrinc ? '<img src="' + imgPrinc + '" loading="lazy" alt="' + Core.sanitize(p.nome) + '" onclick="Economizei.Loja.abrirImagemFull(' + JSON.stringify(p).replace(/"/g, '&quot;') + ')" style="cursor:pointer;">' : '<div style="width:100%;aspect-ratio:1;background:#f1f5f9;border-radius:.5rem;display:flex;align-items:center;justify-content:center;">📷</div>';
      var precoTxt = '';
      if (temV) {
        var ps = p.variacoes.map(function (v) { return parseFloat(v.preco) || 0; });
        var mi = Math.min.apply(null, ps), ma = Math.max.apply(null, ps);
        precoTxt = mi === ma ? 'R$ ' + mi.toFixed(2) : 'A partir de R$ ' + mi.toFixed(2);
      } else precoTxt = 'R$ ' + (parseFloat(p.preco) || 0).toFixed(2);
      var of = obterOfertaProduto(p);
      var promH = of ? '<div style="font-size:.68rem;color:#059669;font-weight:800;margin-top:.2rem;">' + of.texto + '</div>' : '';
      var estH = '';
      if (tipo === 'variavel') {
        var il2 = p.variacoes.some(function (v) { return estoqueSemLimite(v.estoque); });
        var t2 = p.variacoes.reduce(function (a, v) { var e = obterEstoqueNumerico(v.estoque); return a + (e === null ? 0 : e); }, 0);
        estH = il2 ? '<div style="font-size:.65rem;color:#64748b;">Estoque: Ilimitado</div>' : '<div style="font-size:.65rem;color:' + (t2 <= 5 ? '#dc3545' : '#64748b') + ';">Estoque total: ' + t2 + '</div>';
      } else {
        var eg = obterEstoqueNumerico(p.estoque);
        estH = eg === null ? '<div style="font-size:.65rem;color:#64748b;">Estoque: Ilimitado</div>' : '<div style="font-size:.65rem;color:' + (eg <= 5 ? '#dc3545' : '#64748b') + ';">Estoque: ' + eg + '</div>';
      }
      var btn = '';
      if (temV) btn = '<button class="btn-escolher" data-prod-id="' + p.id + '" data-tipo="variavel" ' + (esgotado ? 'disabled' : '') + '>' + (esgotado ? 'Indisponível' : 'Escolher') + '</button>';
      else btn = '<div class="produto-quantidade-simples"><button class="qtd-btn-simples" data-prod-id="' + p.id + '" data-delta="-1" aria-label="Diminuir">−</button><input type="number" id="qtd_simples_' + p.id + '" value="1" min="1" style="width:3rem;text-align:center;" aria-label="Quantidade"><button class="qtd-btn-simples" data-prod-id="' + p.id + '" data-delta="1" aria-label="Aumentar">+</button></div><button class="btn-adicionar-simples" data-prod-id="' + p.id + '" data-preco="' + (parseFloat(p.preco) || 0) + '" ' + (esgotado ? 'disabled' : '') + '>' + (esgotado ? 'Indisponível' : 'Adicionar') + '</button>';
      return '<div class="produto-card" data-prod-id="' + p.id + '">' + imgHtml +
        '<div class="card-content-produto"><div class="produto-nome">' + Core.sanitize(p.nome) + '</div><div class="produto-preco">' + (of && !of.apenasAlgumas && of.promocao.tipo !== 'quantidade' ? '<s style="color:#94a3b8;font-size:.72rem;margin-right:.25rem;">' + precoTxt + '</s> R$ ' + of.precoPromocional.toFixed(2) : precoTxt) + '</div>' + promH + estH + '</div>' + btn + '</div>';
    }

    // ---------- IMAGEM FULL + VARIAÇÕES ----------
    function abrirImagemFull(p) {
      var gal = obterGaleria(p);
      var imgs = gal.map(function (x) { return x.url; });
      if (!imgs.length) { UI.mostrarToast('Sem imagem para este produto.'); return; }
      var cur = 0;
      var m = document.createElement('div');
      m.className = 'modal-imagem-full loja-padronizada';
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Imagem de ' + p.nome);
      m.style.cssText = 'position:fixed;inset:0;background:#000;z-index:20000;display:flex;align-items:center;justify-content:center;width:100vw;height:100vh;margin:0;padding:0;';
      function navegar(d) { if (imgs.length < 2) return; cur = (cur + d + imgs.length) % imgs.length; atualizar(); }
      function atualizar() {
        var vImg = gal[cur] && gal[cur].variacao;
        var precoVar = vImg ? parseFloat(vImg.preco) : NaN;
        var pSel = !isNaN(precoVar) ? precoVar : (p.__precoSelecionado !== undefined && p.__precoSelecionado !== null ? parseFloat(p.__precoSelecionado) : NaN);
        var pBase = !isNaN(pSel) ? pSel : (parseFloat(p.preco) || 0);
        var eImg = vImg ? vImg.estoque : p.__estoqueSelecionado;
        var en = obterEstoqueNumerico(eImg);
        var estH = en === null ? '<div style="font-size:.8rem;color:#cbd5e1;">Estoque: Ilimitado</div>' : '<div style="font-size:.8rem;color:#cbd5e1;">Estoque: ' + en + '</div>';
        m.innerHTML = '<div style="display:flex;flex-wrap:wrap;justify-content:center;align-items:center;width:100%;height:100%;background:#000;position:relative;">' +
          '<button type="button" class="modal-close-btn fechar" onclick="this.closest(\'.modal-imagem-full\').remove()" aria-label="Fechar" style="position:absolute;top:1rem;right:1rem;color:#fff;background:rgba(0,0,0,.5);border:1px solid rgba(255,255,255,.35);width:2.25rem;height:2.25rem;border-radius:50%;display:flex;align-items:center;justify-content:center;z-index:10;">×</button>' +
          '<div style="flex:2;min-width:200px;text-align:center;padding:1rem;display:flex;flex-direction:column;justify-content:center;height:100%;position:relative;">' +
          (imgs.length > 1 ? '<button type="button" id="imgAnt" class="imagem-navegacao" style="position:absolute;top:50%;left:.75rem;transform:translateY(-50%);width:42px;height:58px;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font-size:42px;border:1px solid rgba(255,255,255,.35);cursor:pointer;">‹</button><button type="button" id="imgSeg" class="imagem-navegacao" style="position:absolute;top:50%;right:.75rem;transform:translateY(-50%);width:42px;height:58px;border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font-size:42px;border:1px solid rgba(255,255,255,.35);cursor:pointer;">›</button>' : '') +
          '<img src="' + imgs[cur] + '" alt="' + Core.sanitize(p.nome) + '" style="max-width:100%;max-height:70vh;object-fit:contain;margin:auto;">' +
          (imgs.length > 1 ? '<div style="display:flex;gap:.5rem;justify-content:center;margin-top:.5rem;flex-wrap:wrap;">' + imgs.map(function (u, i) { return '<img src="' + u + '" data-idx="' + i + '" alt="Miniatura ' + (i + 1) + '" style="width:40px;height:40px;object-fit:cover;border-radius:.5rem;cursor:pointer;border:2px solid ' + (i === cur ? '#0a66c2' : 'transparent') + ';">'; }).join('') + '</div>' : '') +
          '</div>' +
          '<div style="flex:1;padding:1rem;background:#111;color:#fff;height:100%;display:flex;flex-direction:column;justify-content:center;gap:1rem;">' +
          '<div style="font-size:1rem;font-weight:700;color:#fff;">' + Core.sanitize(p.nome) + '</div>' +
          '<div style="font-size:.8rem;color:#cbd5e1;">' + (p.descricao || 'Sem descrição') + '</div>' +
          estH +
          '<div style="font-size:1rem;font-weight:700;color:var(--primary);">R$ ' + pBase.toFixed(2) + '</div>' +
          '<div style="display:flex;align-items:center;gap:.3rem;justify-content:center;"><button type="button" id="mQ" style="background:#333;color:#fff;border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;">−</button><input type="number" id="qtdImg" value="1" min="1" style="width:60px;text-align:center;border:1px solid #444;border-radius:2rem;background:#222;color:#fff;" aria-label="Quantidade"><button type="button" id="pQ" style="background:#333;color:#fff;border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;">+</button></div>' +
          '<button class="btn-pedido-cta" id="addImg">Adicionar ao carrinho</button>' +
          '</div></div>';
        m.querySelectorAll('[data-idx]').forEach(function (mini) { mini.addEventListener('click', function () { cur = parseInt(mini.dataset.idx); atualizar(); }); });
        var a = m.querySelector('#imgAnt'), s = m.querySelector('#imgSeg');
        if (a) a.addEventListener('click', function () { navegar(-1); });
        if (s) s.addEventListener('click', function () { navegar(1); });
        var qi = m.querySelector('#qtdImg'), mq = m.querySelector('#mQ'), pq = m.querySelector('#pQ');
        mq.addEventListener('click', function () { qi.stepDown(); });
        pq.addEventListener('click', function () { qi.stepUp(); });
        m.querySelector('#addImg').addEventListener('click', function () {
          var q = parseInt(qi.value) || 1;
          if (p.tipo === 'variavel' && p.variacoes && p.variacoes.length) { m.remove(); abrirModalVariacoes(p); return; }
          var en = obterEstoqueNumerico(p.estoque);
          if (en !== null && q > en) { UI.mostrarToast('Estoque insuficiente. Disponível: ' + en); return; }
          var ex = carrinho.find(function (i) { return i.id === p.id && !i.variacaoId; });
          if (ex) ex.quantidade += q;
          else carrinho.push({ id: p.id, nome: p.nome, preco: pBase, quantidade: q, imagem: p.imagem || null, variacaoId: null, estoque: p.estoque });
          atualizarCarrinho(); UI.mostrarToast('Produto adicionado ao carrinho'); m.remove();
        });
      }
      atualizar();
      document.body.appendChild(m);
      UI.trapFocus(m);
    }
    function abrirModalVariacoes(p) {
      var attrs = p.atributos || [];
      var vs = p.variacoes || [];
      if (!vs.length) { UI.mostrarToast('Este produto não possui variações disponíveis.'); return; }
      var prim = null;
      for (var i = 0; i < vs.length; i++) { var e = obterEstoqueNumerico(vs[i].estoque); if (e === null || e > 0) { prim = vs[i]; break; } }
      if (!prim) { UI.mostrarToast('Todas as variações estão esgotadas.'); return; }
      var sel = {};
      for (var a in prim.atributos) sel[a] = prim.atributos[a];
      var m = document.createElement('div');
      m.className = 'modal-overlay'; m.style.display = 'flex';
      m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Escolher variação de ' + p.nome);
      var imgPrim = obterImagensVariacao(prim)[0] || obterImagemPrincipal(p) || 'https://via.placeholder.com/300';
      m.innerHTML = '<div class="modal-conteudo modal-variacao-full">' +
        '<div class="modal-header"><div><span style="display:block;color:#64748b;font-size:.65rem;font-weight:800;letter-spacing:.08em;">ESCOLHA UMA OPÇÃO</span><h3>' + Core.sanitize(p.nome) + '</h3></div><button type="button" class="btn-modal-fechar" onclick="this.closest(\'.modal-overlay\').remove()" aria-label="Fechar">✕</button></div>' +
        '<div class="modal-config-body">' +
        '<main class="modal-config-main"><div class="modal-step"><div class="modal-step-number">1</div><div class="modal-step-content"><div class="modal-step-heading"><div><h4>Escolha a variação</h4><p>Selecione uma opção em cada grupo.</p></div><span class="modal-required">Obrigatório</span></div><div id="attrC" class="modal-options-list"></div></div></div></main>' +
        '<aside class="modal-order-summary"><h4>Resumo</h4><img id="vImg" class="variation-summary-image" src="' + imgPrim + '" alt="' + Core.sanitize(p.nome) + '"><p class="variation-summary-description">' + Core.sanitize(p.descricao || 'Sem descrição') + '</p><div id="vInfo"><strong>Preço unitário:</strong> ' + formatarValor(prim.preco) + '<br><span>Quantidade: 1</span><br><span>Estoque: ' + textoEstoque(prim.estoque) + '</span></div><div class="variation-quantity"><button type="button" id="vMenos" aria-label="Diminuir">−</button><input type="number" id="vQtd" value="1" min="1" aria-label="Quantidade"><button type="button" id="vMais" aria-label="Aumentar">+</button></div></aside>' +
        '</div>' +
        '<div class="modal-config-footer"><div class="modal-total"><span>Total da escolha</span><strong id="vTotal">R$ ' + (parseFloat(prim.preco) || 0).toFixed(2) + '</strong></div><button class="btn-pedido-cta" id="addVar">Adicionar ao carrinho</button></div>' +
        '</div>';
      document.body.appendChild(m);
      UI.trapFocus(m);
      var aC = document.getElementById('attrC'), vI = document.getElementById('vImg'), vN = document.getElementById('vInfo'), qi = document.getElementById('vQtd'), bA = document.getElementById('addVar');
      bA.disabled = false;
      var varSel = prim;
      function getPreco(s, t) {
        if (s.precos && t) {
          if (s.precos[t] !== undefined) return parseFloat(s.precos[t]) || 0;
          var ch = Object.keys(s.precos).find(function (k) { return String(k).trim().toLowerCase() === String(t).trim().toLowerCase(); });
          if (ch !== undefined) return parseFloat(s.precos[ch]) || 0;
        }
        if (s.preco !== undefined) return parseFloat(s.preco) || 0;
        return parseFloat(p.preco) || 0;
      }
      function atualizarVar() {
        var enc = null;
        for (var i = 0; i < vs.length; i++) { var v = vs[i]; var ok = true; for (var a in sel) { if (v.atributos[a] !== sel[a]) { ok = false; break; } } if (ok) { enc = v; break; } }
        if (enc) {
          varSel = enc;
          var pr = parseFloat(enc.preco) || 0, es = obterEstoqueNumerico(enc.estoque);
          var imgs = obterImagensVariacao(enc);
          vI.src = imgs[0] || obterImagemPrincipal(p) || 'https://via.placeholder.com/150';
          if (es === null) qi.removeAttribute('max'); else { qi.max = String(es); if (parseInt(qi.value) > es && es > 0) qi.value = es; }
          var q = Math.max(1, parseInt(qi.value) || 1);
          document.getElementById('vTotal').textContent = 'R$ ' + (pr * q).toFixed(2);
          bA.disabled = es !== null && es <= 0;
        } else { vN.innerHTML = 'Combinação não disponível.'; document.getElementById('vTotal').textContent = 'Indisponível'; vI.src = obterImagemPrincipal(p); bA.disabled = true; }
      }
      aC.innerHTML = '';
      attrs.forEach(function (a) {
        var d = document.createElement('div'); d.className = 'modal-option-group';
        d.innerHTML = '<span class="modal-option-label">' + Core.sanitize(a.nome) + '</span>';
        var ob = document.createElement('div'); ob.className = 'modal-option-buttons';
        (a.opcoes || []).forEach(function (o) {
          var b = document.createElement('button'); b.type = 'button'; b.className = 'btn-tamanho-modal';
          if (sel[a.nome] === o) b.classList.add('ativo');
          b.textContent = o;
          b.addEventListener('click', function () {
            sel[a.nome] = o;
            ob.querySelectorAll('.btn-tamanho-modal').forEach(function (x) { x.classList.toggle('ativo', x.textContent === o); });
            atualizarVar();
          });
          ob.appendChild(b);
        });
        d.appendChild(ob); aC.appendChild(d);
      });
      vI.addEventListener('click', function () {
        var cl = JSON.parse(JSON.stringify(p));
        var enc = varSel;
        var imgs = obterImagensVariacao(enc);
        if (!imgs.length) imgs = obterImagensBase(p);
        cl.imagem = imgs[0] || obterImagemPrincipal(p) || '';
        cl.imagens = imgs.slice(1);
        if (enc) { cl.__precoSelecionado = parseFloat(enc.preco) || 0; cl.__estoqueSelecionado = enc.estoque; cl.__variacaoSelecionada = JSON.parse(JSON.stringify(enc)); }
        abrirImagemFull(cl);
      });
      document.getElementById('vMenos').addEventListener('click', function () { var v = parseInt(qi.value) || 1; if (v > 1) { qi.value = v - 1; atualizarVar(); } });
      document.getElementById('vMais').addEventListener('click', function () { var v = parseInt(qi.value) || 1; var mx = qi.max ? parseInt(qi.max, 10) : Infinity; if (!Number.isFinite(mx) || v < mx) { qi.value = v + 1; atualizarVar(); } });
      qi.addEventListener('input', atualizarVar);
      bA.addEventListener('click', function () {
        if (bA.disabled) return;
        var q = parseInt(qi.value) || 1;
        var es = obterEstoqueNumerico(varSel.estoque);
        if (es !== null && q > es) { UI.mostrarToast('Estoque insuficiente.'); return; }
        var atribs = '';
        for (var a in sel) atribs += (atribs ? ', ' : '') + a + ': ' + sel[a];
        var nomeComp = p.nome + (atribs ? ' (' + atribs + ')' : '');
        var vId = obterIdVariacao(varSel);
        var ex = carrinho.find(function (i) { return i.id === p.id && i.variacaoId === vId; });
        if (ex) ex.quantidade += q;
        else carrinho.push({ id: p.id, nome: nomeComp, preco: parseFloat(varSel.preco) || 0, quantidade: q, imagem: varSel.imagem || p.imagem || null, variacaoId: vId, atributos: JSON.parse(JSON.stringify(sel)), estoque: varSel.estoque });
        atualizarCarrinho(); UI.mostrarToast('Produto adicionado'); m.remove();
      });
      atualizarVar();
    }

    // ---------- ABRIR O MODAL ----------
    var antigo = document.getElementById('modalLoja');
    if (antigo) antigo.remove();
    var logoHtml = logoEstab ? '<img src="' + Core.sanitize(logoEstab) + '" alt="Logo" loading="eager" referrerpolicy="no-referrer">' : '<span aria-hidden="true">🛍️</span>';
    var html = '<div class="modal-overlay loja-padronizada" id="modalLoja" style="display:flex;" role="dialog" aria-modal="true" aria-labelledby="modalLojaTitulo">' +
      '<div class="modal-conteudo fullscreen">' +
      '<div class="modal-header"><div class="modal-estabelecimento-brand"><div class="modal-estabelecimento-logo">' + logoHtml + '</div><div class="modal-estabelecimento-meta"><h3 id="modalLojaTitulo">' + Core.sanitize(nomeEstab) + '</h3><span id="statusLojaBadgeLoja" class="modal-estabelecimento-status status-aberta">Aceitando pedidos</span></div></div>' +
      '<button class="btn-modal-fechar" onclick="Economizei.Loja.fechar()" aria-label="Fechar loja">✕</button></div>' +
      '<div class="modal-tabs">' +
      '<button class="modal-tab active" data-tab="produtos">📦 Produtos</button>' +
      '<button class="modal-tab" data-tab="carrinho">🛒 Carrinho <span class="cart-tab-badge" id="cartBadgeLoja" style="display:none;">0</span></button>' +
      '<button class="modal-tab" data-tab="acompanhar">🔍 Acompanhar</button>' +
      (Core.getCurrentUser() ? '<button class="modal-tab" data-tab="historico">📋 Histórico</button>' : '') +
      '</div>' +
      '<div class="modal-body">' +
      '<div id="tabProdutos" class="modal-tab-content active">' +
      '<div id="statusLojaMsgLoja" style="display:none;background:#fef3c7;border:1px solid #f59e0b;border-radius:.75rem;padding:.75rem;margin-bottom:.75rem;text-align:center;font-weight:600;color:#92400e;" role="alert"></div>' +
      '<div id="produtosContainer">Carregando produtos...</div>' +
      '</div>' +
      '<div id="tabCarrinho" class="modal-tab-content">' +
      '<div class="carrinho-layout">' +
      '<div class="carrinho-col-esquerda" id="carrinhoLista"><p style="text-align:center;padding:1rem;">Carrinho vazio</p></div>' +
      '<div class="carrinho-col-direita">' +
      '<strong>Resumo do pedido</strong>' +
      '<div>Subtotal: R$ <span id="carrinhoSubtotal">0.00</span></div>' +
      '<div id="promocaoLojaResumo" style="font-size:.78rem;margin:.2rem 0 .45rem;"></div>' +
      '<select id="selectFreteLoja" class="input-pedido" data-frete-carregado="false" onchange="this.removeAttribute(\'aria-invalid\'); Economizei.Loja.recalcularTotal()" aria-label="Selecione o frete" required><option value="">Carregando opções de frete...</option></select>' +
      '<div style="display:flex;gap:.5rem;margin:.5rem 0;">' +
      '<input type="text" id="cupomLoja" class="input-pedido" style="margin:0;flex:1;" placeholder="Código do cupom" aria-label="Código do cupom">' +
      '<button class="btn-aplicar-cupom" onclick="Economizei.Loja.aplicarCupom()">Aplicar</button>' +
      '</div>' +
      '<div id="cupomLojaStatus" style="font-size:.75rem;margin-bottom:.5rem;"></div>' +
      '<div><strong>Total: R$ <span id="totalLoja" class="total-loja">0.00</span></strong></div>' +
      '<div style="margin:.75rem 0;"></div>' +
      '<strong>Pagamento</strong>' +
      '<select id="formaPagamentoLoja" class="input-pedido" onchange="Economizei.Loja.toggleTroco()" aria-label="Forma de pagamento">' +
      '<option value="Dinheiro">Dinheiro</option><option value="Cartão na entrega">Cartão na entrega</option><option value="Pix">Pix</option></select>' +
      '<div id="trocoParaWrapperLoja" style="display:block;"><input type="number" id="trocoParaLoja" class="input-pedido" placeholder="Troco para quanto?" aria-label="Troco para quanto"><label class="sem-troco-label"><input type="checkbox" id="semTrocoCheckbox"> Não preciso de troco</label></div>' +
      '<div class="cliente-info">' +
      '<div class="form-row">' +
      '<input type="text" id="clienteNomeLoja" class="input-pedido" placeholder="Seu nome*" value="' + (Core.getUserDisplayName() || '') + '" aria-label="Seu nome" required>' +
      '<input type="tel" id="clienteTelLoja" class="input-pedido" placeholder="Telefone*" maxlength="15" aria-label="Telefone" required>' +
      '</div>' +
      '<input type="text" id="enderecoLoja" class="input-pedido" placeholder="Endereço completo*" aria-label="Endereço completo" required>' +
      '<textarea id="obsLoja" rows="2" class="input-pedido" placeholder="Observações" aria-label="Observações"></textarea>' +
      '<button class="btn-pedido-cta" id="btnFinalizarCompra" onclick="Economizei.Loja.finalizarPedido()">Confirmar Pedido</button>' +
      '</div></div></div></div>' +
      '<div id="tabAcompanhar" class="modal-tab-content">' +
      '<input type="text" id="consultaRastreio" class="input-pedido" placeholder="Código do pedido" aria-label="Código do pedido">' +
      '<div style="display:flex;gap:.5rem;">' +
      '<button class="btn-consultar-pedido" onclick="Economizei.Loja.consultarPedido()" style="flex:1;">Consultar</button>' +
      '<button class="btn-limpar-historico" onclick="document.getElementById(\'consultaRastreio\').value=\'\'; document.getElementById(\'resultadoRastreio\').innerHTML=\'\';">Limpar</button>' +
      '</div>' +
      '<div id="resultadoRastreio" style="margin-top:1rem;"></div>' +
      '</div>' +
      (Core.getCurrentUser() ? '<div id="tabHistorico" class="modal-tab-content"><div id="listaHistoricoLoja"></div></div>' : '') +
      '</div></div></div>';
    document.body.insertAdjacentHTML('beforeend', html);
    UI.trapFocus(document.getElementById('modalLoja'));

    // Carrega dados do lojista
    Core.db.collection('lojistas').where('estabelecimentoId', '==', estId).limit(1).get().then(function (snap) {
      if (snap.empty) { UI.mostrarToast('Estabelecimento não configurado para loja.', 'erro'); return; }
      var ld = snap.docs[0];
      currentLojistaId = ld.id;
      var data = ld.data();
      logoEstab = obterLogoDoCadastro(data) || logoEstab;
      atualizarLogoUI(data);
      atualizarStatusUI(data.statusLoja || 'aberta', data.statusMessage || '');
      unsubscribeStatusLoja = Core.db.collection('lojistas').doc(currentLojistaId).onSnapshot(function (d) {
        if (d.exists) { var dt = d.data(); logoEstab = obterLogoDoCadastro(dt) || logoEstab; atualizarLogoUI(dt); atualizarStatusUI(dt.statusLoja || 'aberta', dt.statusMessage || ''); }
      });
      unsubscribeCardapio = Core.db.collection('lojistas').doc(currentLojistaId).collection('cardapio').onSnapshot(function (s) {
        var ps = [];
        s.forEach(function (d) {
          var dd = d.data();
          if (dd.disponivel === 'nao') return;
          var imgs = normalizarImagens(dd.imagens);
          var vs = Array.isArray(dd.variacoes) ? dd.variacoes.map(function (v) {
            var c = {};
            for (var k in v) c[k] = v[k];
            var iv = obterImagensVariacao(v);
            c.imagens = iv; c.imagem = c.imagem || iv[0] || '';
            return c;
          }) : [];
          var ip = dd.imagem || imgs[0] || null;
          var fb = false;
          if (!ip) for (var i = 0; i < vs.length; i++) { var iv2 = obterImagensVariacao(vs[i]); if (iv2.length) { ip = iv2[0]; fb = true; break; } }
          var p = { id: d.id, nome: dd.nome, preco: parseFloat(dd.preco) || 0, imagem: ip, __imagemFallbackVariacao: fb, descricao: dd.descricao || '', estoque: dd.estoque !== undefined && dd.estoque !== '' ? parseInt(dd.estoque) : null, categoria: dd.categoria || 'Geral', tipo: dd.tipo || 'simples', atributos: dd.atributos || [], variacoes: vs, imagens: imgs };
          if (p.tipo === 'variavel' && p.variacoes.length) p.variacoes = p.variacoes.map(function (v) { if (!v.sku) { var sp = []; for (var a in v.atributos) sp.push(v.atributos[a].substring(0, 3).toUpperCase()); v.sku = p.id.substring(0, 4) + '-' + sp.join('-'); } return v; });
          ps.push(p);
        });
        produtosCache = ps;
        var c = document.getElementById('produtosContainer');
        if (c) c.innerHTML = renderizarProdutos(ps);
      });
      carregarPromocoes();
      unsubscribeFretes = Core.db.collection('lojistas').doc(currentLojistaId).collection('fretes').onSnapshot(function (s) {
        var frs = [];
        s.forEach(function (d) { var dd = d.data(); if (dd.ativo === 'nao') return; frs.push({ localidade: dd.localidade, taxa: parseFloat(dd.taxa) || 0 }); });
        fretesCache = frs;
        var sel = document.getElementById('selectFreteLoja');
        if (sel) {
          sel.innerHTML = '<option value="">' + (frs.length ? 'Selecione o frete' : 'Nenhuma opção de frete cadastrada') + '</option>' + frs.map(function (f) { return '<option value="' + f.taxa + '">' + f.localidade + ' - R$ ' + f.taxa.toFixed(2) + '</option>'; }).join('');
          sel.options[0].disabled = frs.length > 0;
          sel.dataset.freteCarregado = 'true';
        }
      });
    });
    toggleTroco();
    var saved = carregarDadosClienteLocal();
    if (saved) {
      if (saved.nome) document.getElementById('clienteNomeLoja').value = saved.nome;
      if (saved.telefone) document.getElementById('clienteTelLoja').value = saved.telefone;
      if (saved.endereco) document.getElementById('enderecoLoja').value = saved.endereco;
    }
    var telI = document.getElementById('clienteTelLoja');
    if (telI) telI.addEventListener('input', function () {
      var v = this.value.replace(/\D/g, ''); if (v.length > 11) v = v.slice(0, 11);
      var f = ''; if (v.length) { f = '(' + v.slice(0, 2); if (v.length > 2) f += ') ' + v.slice(2, 7); if (v.length > 7) f += '-' + v.slice(7, 11); }
      this.value = f;
    });
    document.querySelectorAll('#modalLoja .modal-tab').forEach(function (t) {
      t.onclick = function () {
        document.querySelectorAll('#modalLoja .modal-tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        document.querySelectorAll('#modalLoja .modal-tab-content').forEach(function (c) { c.classList.remove('active'); });
        var id = 'tab' + t.dataset.tab.charAt(0).toUpperCase() + t.dataset.tab.slice(1);
        document.getElementById(id).classList.add('active');
        if (t.dataset.tab === 'historico') carregarHistorico(estId);
      };
    });
    var pc = document.getElementById('produtosContainer');
    if (pc) pc.addEventListener('click', function (e) {
      var qb = e.target.closest('.qtd-btn-simples');
      if (qb) { var pid = qb.dataset.prodId, d = parseInt(qb.dataset.delta), inp = document.getElementById('qtd_simples_' + pid); if (inp) inp.value = Math.max(1, (parseInt(inp.value) || 1) + d); return; }
      var eb = e.target.closest('.btn-escolher');
      if (eb) { var p2 = produtosCache.find(function (x) { return x.id === eb.dataset.prodId; }); if (p2 && p2.tipo === 'variavel') abrirModalVariacoes(p2); return; }
      var ab = e.target.closest('.btn-adicionar-simples');
      if (ab) adicionarAoCarrinho(ab.dataset.prodId);
    });

    // Expor funções globais
    Economizei.Loja = {
      abrirModal: abrirModal,
      fechar: function () {
        if (unsubscribeCardapio) { unsubscribeCardapio(); unsubscribeCardapio = null; }
        if (unsubscribeFretes) { unsubscribeFretes(); unsubscribeFretes = null; }
        if (unsubscribeStatusLoja) { unsubscribeStatusLoja(); unsubscribeStatusLoja = null; }
        var m = document.getElementById('modalLoja'); if (m) m.remove();
        UI.restoreFocus();
      },
      abrirImagemFull: abrirImagemFull,
      alterarQuantidade: alterarQuantidade,
      removerDoCarrinho: removerDoCarrinho,
      recalcularTotal: recalcularTotal,
      aplicarCupom: aplicarCupom,
      toggleTroco: toggleTroco,
      finalizarPedido: finalizarPedido,
      consultarPedido: consultarPedido,
      verComprovante: function (cod) {
        Core.db.collection('pedidos').where('codigoCurto', '==', cod).limit(1).get().then(function (s) {
          if (!s.empty) { var p = s.docs[0].data(); gerarComprovante(p, cod); }
        });
      }
    };
  }

  window.Economizei.Loja = { abrirModal: abrirModal };

})(window);