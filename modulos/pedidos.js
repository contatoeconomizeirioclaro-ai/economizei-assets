Economizei.Pedido = (function () {
  (function () {
    if (document.getElementById('css-pedidos')) return;
    var l = document.createElement('link');
    l.id = 'css-pedidos';
    l.rel = 'stylesheet';
    l.href = 'https://cdn.jsdelivr.net/gh/contatoeconomizeirioclaro-ai/economizei-assets@main/modulos/pedidos.css';
    document.head.appendChild(l);
  })();

  var EU = EconomizeiUtils;
  var Core = Economizei.Core;
  var UI = Economizei.UI;
  var Cards = Economizei.Cards;
  var COLUNAS = Economizei.Horario.COLUNAS;
  var carrinho = [];
  var produtosCache = [];
  var fretesCache = [];
  var cupomDesconto = 0;
  var currentEstId = null;
  var currentLojistaId = null;
  var unsubscribePedidos = null, unsubscribeCardapio = null, unsubscribeFretes = null, unsubscribeSabores = null, unsubscribeExtras = null, unsubscribeStatusLoja = null;
  var statusLojaAtual = 'aberta';
  var tamanhoSelecionadoCustom = null;
  var saboresSelecionados = [];
  var extrasSelecionados = [];
  var limiteSaboresPorTamanho = {};
  var saboresGlobais = [];
  var extrasGlobais = [];
  var listenerAtivo = false;
  var mesaQR = null;
  var enviandoPedido = false;

  function _abrirModalLocal(el) {
    if (!el) return null;
    var ctrl = EU.criarModalAcessivel();
    ctrl.abrir(el, function () { if (el.parentNode) el.remove(); });
    el.__ctrl = ctrl;
    el.addEventListener('click', function (e) {
      if (e.target === el) { e.preventDefault(); e.stopPropagation(); ctrl.fechar(); return; }
      var btn = e.target.closest('.modal-close-btn, .btn-modal-fechar, [data-fechar-modal]');
      if (btn) { e.preventDefault(); e.stopPropagation(); ctrl.fechar(); }
    }, true);
    return ctrl;
  }
  function _fecharModalLocal(el) {
    if (el && el.__ctrl) el.__ctrl.fechar();
    else if (el) el.remove();
  }

  Cards.registrarModulo('pedido', {
    label: '🍽️ Fazer pedido',
    ariaLabel: 'Fazer pedido',
    onClick: function (idx) { return 'Economizei.Pedido.abrirModal(' + idx + ')'; }
  });

  function garantirModalScanner() {
    if (document.getElementById('modalScanner')) return;
    var html =
      '<div class="modal-overlay" id="modalScanner" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="modalScannerTitulo">' +
        '<div class="modal-conteudo modal-modulo">' +
          '<div class="modal-header">' +
            '<h3 id="modalScannerTitulo"><i class="fa-solid fa-qrcode" aria-hidden="true"></i> Escanear QR Code da Mesa</h3>' +
            '<button class="modal-close-btn" data-fechar-modal aria-label="Fechar scanner">×</button>' +
          '</div>' +
          '<div class="modal-body" style="flex:1; display:flex; flex-direction:column; min-height:0; padding:0.5rem;">' +
            '<div id="qr-reader" role="region" aria-label="Leitor de QR Code"></div>' +
            '<div id="qr-reader-results" style="margin-top:0.5rem; text-align:center; color:white;" aria-live="polite"></div>' +
            '<div style="text-align:center; margin-top:0.5rem;">' +
              '<button class="btn-pequeno" id="btnScannerRetry" style="color:white; border-color:white; display:none;">Tentar novamente</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.insertAdjacentHTML('beforeend', html);
    var btnRetry = document.getElementById('btnScannerRetry');
    if (btnRetry) btnRetry.addEventListener('click', function () { iniciarScanner(); });
  }

  function getMesaQR() { return mesaQR; }
  function setMesaQR(val) { mesaQR = val; sessionStorage.setItem('mesaQR', val); }
  UI.setMesaQR = setMesaQR;

  var html5QrCode = null;
  function iniciarScanner() {
    if (typeof Html5Qrcode === 'undefined') { UI.mostrarToast('Leitor de QR Code não carregado nesta página.'); return; }
    if (html5QrCode) { html5QrCode.stop().catch(function () {}); html5QrCode = null; }
    var readerElement = document.getElementById('qr-reader');
    if (!readerElement) { UI.mostrarToast('Erro: elemento do leitor não encontrado.'); return; }
    readerElement.innerHTML = '';
    var retryBtn = document.getElementById('btnScannerRetry');
    if (retryBtn) retryBtn.style.display = 'none';
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      readerElement.innerHTML = '<div id="qr-reader-error">Seu navegador não suporta acesso à câmera.</div>';
      if (retryBtn) retryBtn.style.display = 'inline-block';
      return;
    }
    function tentarIniciarComFacing(facingMode) {
      try {
        html5QrCode = new Html5Qrcode('qr-reader');
        var config = { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 };
        return html5QrCode.start({ facingMode: facingMode }, config,
          function (decodedText) {
            var mesaExtraida = null;
            try { var url = new URL(decodedText); mesaExtraida = url.searchParams.get('mesa'); }
            catch (e) { var match = decodedText.match(/[?&]mesa=([^&]+)/); if (match) mesaExtraida = match[1]; }
            if (mesaExtraida) {
              var mesaField = document.getElementById('mesaInput');
              if (mesaField) {
                mesaField.value = mesaExtraida;
                mesaField.readOnly = true;
                mesaField.disabled = true;
                mesaField.style.backgroundColor = '#f0f0f0';
                setMesaQR(mesaExtraida);
                UI.mostrarToast('Mesa ' + mesaExtraida + ' identificada!');
              }
              pararScanner();
              var sc = document.getElementById('modalScanner');
              if (sc && sc.__ctrl) sc.__ctrl.fechar();
              else if (sc) sc.style.display = 'none';
            } else { UI.mostrarToast('QR Code não contém número de mesa.'); }
          },
          function (error) {}
        ).catch(function (err) { return Promise.reject(err); });
      } catch (err) { return Promise.reject(err); }
    }
    tentarIniciarComFacing('environment').catch(function (err) {
      return tentarIniciarComFacing('user').catch(function (err2) {
        var readerEl = document.getElementById('qr-reader');
        if (readerEl) readerEl.innerHTML = '<div id="qr-reader-error">Não foi possível acessar a câmera. Verifique as permissões.<br>Erro: ' + Core.sanitize(err2.message) + '</div>';
        if (retryBtn) retryBtn.style.display = 'inline-block';
        UI.mostrarToast('Erro ao acessar câmera: ' + err2.message);
      });
    });
  }
  function pararScanner() {
    if (html5QrCode) { html5QrCode.stop().catch(function () {}); html5QrCode = null; }
    var reader = document.getElementById('qr-reader');
    if (reader) reader.innerHTML = '';
  }
  UI.iniciarScanner = iniciarScanner;
  UI.pararScanner = pararScanner;

  async function validarCupom(cod, subtotal, frete, estId) {
    if (!cod) return null;
    var snap = await Core.db.collection('lojistas').where('estabelecimentoId', '==', estId).limit(1).get();
    if (snap.empty) return null;
    var lojistaId = snap.docs[0].id;
    var cupSnap = await Core.db.collection('lojistas').doc(lojistaId).collection('cupons').where('codigo', '==', cod.toUpperCase()).where('ativo', '==', 'sim').limit(1).get();
    if (cupSnap.empty) return null;
    var cup = cupSnap.docs[0].data();
    if (cup.validade && new Date(cup.validade) < new Date()) return null;
    var total = subtotal + frete;
    if (cup.minimoPedido && total < cup.minimoPedido) return null;
    var desc = cup.tipo === 'percentual' ? total * cup.valor / 100 : cup.valor;
    if (desc > total) desc = total;
    return Object.assign({}, cup, { desconto: desc, id: cupSnap.docs[0].id });
  }

  function gerarComprovantePedido(pedido, codigoCurto) {
    var itensHTML = pedido.itens ? '<ul>' + pedido.itens.map(function (i) {
      return '<li>' + i.quantidade + 'x ' + Core.sanitize(i.nome) + ' - R$ ' + (i.precoUnitario * i.quantidade).toFixed(2) + '</li>';
    }).join('') + '</ul>' : '';
    var dados =
      '<h2>Comprovante de Pedido</h2>' +
      '<p style="text-align:center;"><strong>Pedido #' + Core.sanitize(codigoCurto) + '</strong><br>Data: ' + new Date().toLocaleString() + '</p>' +
      '<div class="info">' +
        '<p><strong>Estabelecimento:</strong> ' + Core.sanitize(pedido.estabelecimentoNome || '') + '</p>' +
        '<p><strong>Cliente:</strong> ' + Core.sanitize(pedido.clienteNome || '') + '</p>' +
        '<p><strong>Endereço:</strong> ' + Core.sanitize(pedido.endereco || '') + '</p>' +
        (pedido.numeroMesa ? '<p><strong>Mesa:</strong> ' + Core.sanitize(pedido.numeroMesa) + '</p>' : '') +
        '<p><strong>Telefone:</strong> ' + Core.sanitize(pedido.clienteTelefone || '') + '</p>' +
      '</div>' +
      '<div class="itens"><h3>Itens</h3>' + itensHTML + '</div>' +
      '<div class="total">Subtotal: R$ ' + (pedido.subtotal || 0).toFixed(2) + '<br>Frete: R$ ' + (pedido.taxaEntrega || 0).toFixed(2) + '<br>Total: R$ ' + (pedido.total || 0).toFixed(2) + '</div>' +
      '<p><strong>Pagamento:</strong> ' + Core.sanitize(pedido.formaPagamento || '') + (pedido.trocoPara ? ' (Troco para R$ ' + parseFloat(pedido.trocoPara).toFixed(2) + ')' : '') + '</p>' +
      '<p><strong>Observação:</strong> ' + Core.sanitize(pedido.observacao || 'Nenhuma') + '</p>';
    var html =
      '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Comprovante de Pedido</title><style>' +
      'body{font-family:Arial,sans-serif;margin:0;padding:1rem;background:#f2f4f7;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;box-sizing:border-box;}' +
      '.comprovante{width:100%;max-width:600px;background:white;border-radius:1rem;padding:1.5rem;box-shadow:0 2px 10px rgba(0,0,0,0.1);margin:0 auto;}' +
      'h2{color:#0a66c2;text-align:center;font-size:1.3rem;}.info{background:#f8fafc;padding:1rem;border-radius:0.5rem;margin:1rem 0;font-size:0.9rem;}.info p{margin:0.3rem 0;}' +
      '.itens{border-top:1px solid #ddd;margin:1rem 0;padding:0.5rem 0;}.itens ul{list-style:none;padding:0;}.itens li{padding:0.3rem 0;border-bottom:1px solid #eee;font-size:0.9rem;}' +
      '.total{font-weight:bold;font-size:1.2rem;text-align:right;margin-top:1rem;}.obrigado{text-align:center;margin-top:1.5rem;color:#64748b;font-size:0.85rem;}' +
      '@media (max-width:480px){.comprovante{padding:1rem;}h2{font-size:1.1rem;}.info{font-size:0.8rem;}}</style></head><body><div class="comprovante">' + dados + '<p class="obrigado">Obrigado pela preferência!</p></div></body></html>';
    EU.abrirJanelaHTML(html);
  }

  function mostrarPopupConfirmacao(opcoes) {
    return EU.mostrarPopupConfirmacao(opcoes);
  }

  function abrirProdutoPeloCard(prodId) {
    var produto = produtosCache.find(function (p) { return p.id === prodId; });
    if (!produto) { UI.mostrarToast('Produto não encontrado.'); return; }
    if (produto.personalizavel === true || produto.tipo === 'personalizavel') {
      abrirModalCustomizacaoCompleta(produto);
    } else {
      abrirImagemProduto(prodId);
    }
  }

  function abrirImagemProduto(prodId, visualizarImagem) {
    var produto = produtosCache.find(function (p) { return p.id === prodId; });
    if (!produto) { UI.mostrarToast('Produto não encontrado.'); return; }
    if ((produto.personalizavel === true || produto.tipo === 'personalizavel') && !visualizarImagem) {
      abrirModalCustomizacaoCompleta(produto);
      return;
    }
    abrirModalImagemFull(produto);
  }

  function abrirModalImagemFull(produto) {
    var imagens = [produto.imagem];
    if (produto.imagens && produto.imagens.length) imagens = produto.imagens.filter(function (url) { return url && url.trim() !== ''; });
    if (imagens.length === 0) { UI.mostrarToast('Sem imagem para este produto.'); return; }
    var currentIndex = 0;
    var tamanhoSelecionado = null;
    var precoSelecionado = 0;
    var temTamanhos = produto.tamanhos && Array.isArray(produto.tamanhos) && produto.tamanhos.length > 0;
    if (temTamanhos) { tamanhoSelecionado = produto.tamanhos[0].nome; precoSelecionado = parseFloat(produto.tamanhos[0].preco) || 0; }
    else { precoSelecionado = parseFloat(produto.preco) || 0; }

    var modal = document.createElement('div');
    modal.className = 'modal-imagem-full';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Imagem de ' + produto.nome);
    modal.style.cssText = 'position:fixed; inset:0; background:#000; z-index:20000; display:flex; align-items:center; justify-content:center; width:100vw; height:100vh; margin:0; padding:0;';

    function atualizarModal() {
      var html = '<div class="container-imagem" style="display:flex; flex-wrap:wrap; justify-content:center; align-items:center; width:100%; height:100%; background:#000; position:relative;">' +
        '<button type="button" class="modal-close-btn fechar" data-fechar-modal aria-label="Fechar imagem" style="position:absolute; top:1rem; right:1rem; color:white; font-size:2rem; cursor:pointer; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,.35); width:2rem; height:2rem; border-radius:50%; display:flex; align-items:center; justify-content:center; z-index:10;">×</button>' +
        '<div class="lado-esquerdo" style="flex:2; min-width:200px; text-align:center; padding:1rem; display:flex; flex-direction:column; justify-content:center; height:100%;">' +
          '<img src="' + imagens[currentIndex] + '" class="imagem-principal" alt="' + Core.sanitize(produto.nome) + '" style="max-width:100%; max-height:70vh; object-fit:contain; margin:auto;">' +
          (imagens.length > 1 ? '<div class="miniaturas" style="display:flex; gap:0.5rem; justify-content:center; margin-top:1rem; flex-wrap:wrap;">' + imagens.map(function (img, idx) { return '<img src="' + img + '" class="miniatura ' + (idx === currentIndex ? 'ativa' : '') + '" data-idx="' + idx + '" alt="Miniatura ' + (idx + 1) + '" style="width:50px; height:50px; object-fit:cover; border-radius:0.5rem; cursor:pointer; border:' + (idx === currentIndex ? '2px solid #0a66c2' : '2px solid transparent') + ';">'; }).join('') + '</div>' : '') +
        '</div>' +
        '<div class="lado-direito" style="flex:1; padding:1rem; background:#111; color:white; border-radius:0; height:100%; display:flex; flex-direction:column; justify-content:center; gap:1rem;">' +
          '<div class="produto-nome" style="font-size:1.2rem; font-weight:700; color:white;">' + Core.sanitize(produto.nome) + '</div>' +
          (temTamanhos ? '<div class="tamanho-botoes-modal" style="display:flex; flex-wrap:wrap; gap:0.75rem; margin:0.5rem 0;">' + produto.tamanhos.map(function (t) { return '<button class="btn-tamanho-modal" data-tamanho="' + Core.sanitize(t.nome) + '" data-preco="' + t.preco + '" style="background:' + (tamanhoSelecionado === t.nome ? '#0a66c2' : '#eee') + '; color:' + (tamanhoSelecionado === t.nome ? 'white' : '#333') + '; border:none; border-radius:2rem; padding:0.6rem 1.2rem; font-size:0.9rem; font-weight:600; cursor:pointer;">' + Core.sanitize(t.nome) + '</button>'; }).join('') + '</div>' : '') +
          '<div class="preco" style="font-size:1.2rem; font-weight:700; color:#0a66c2;">R$ ' + precoSelecionado.toFixed(2) + '</div>' +
          '<div class="descricao" style="font-size:0.9rem; color:#ccc;">' + Core.sanitize(produto.descricao || 'Sem descrição') + '</div>' +
          '<div class="produto-quantidade-simples" style="display:flex; align-items:center; gap:8px; margin:8px 0;">' +
            '<button id="menosQtdImg" style="background:#333; color:white; border:none; border-radius:50%; width:26px; height:26px; font-size:14px; cursor:pointer;" aria-label="Diminuir quantidade">−</button>' +
            '<input type="number" id="qtdImg" value="1" min="1" style="width:60px; text-align:center; border:1px solid #444; border-radius:2rem; font-size:12px; padding:4px; background:#222; color:white;" aria-label="Quantidade">' +
            '<button id="maisQtdImg" style="background:#333; color:white; border:none; border-radius:50%; width:26px; height:26px; font-size:14px; cursor:pointer;" aria-label="Aumentar quantidade">+</button>' +
          '</div>' +
          '<button class="btn-adicionar-simples" id="addImagem" style="background:#0a66c2; color:white; border:none; border-radius:2rem; padding:10px; font-size:14px; font-weight:600; cursor:pointer;">' + ((produto.personalizavel === true || produto.tipo === 'personalizavel') ? 'Voltar para personalização' : 'Adicionar ao carrinho') + '</button>' +
        '</div>' +
      '</div>';
      modal.innerHTML = html;
      if (temTamanhos) modal.querySelectorAll('.btn-tamanho-modal').forEach(function (btn) {
        btn.addEventListener('click', function () { tamanhoSelecionado = btn.dataset.tamanho; precoSelecionado = parseFloat(btn.dataset.preco); atualizarModal(); });
      });
      modal.querySelectorAll('.miniatura').forEach(function (mini) {
        mini.addEventListener('click', function () { currentIndex = parseInt(mini.dataset.idx); atualizarModal(); });
      });
      var qtdInput = modal.querySelector('#qtdImg');
      var menosBtn = modal.querySelector('#menosQtdImg');
      var maisBtn = modal.querySelector('#maisQtdImg');
      var precoSpan = modal.querySelector('.preco');
      function atualizarPrecoImagem() {
        var qtd = parseInt(qtdInput.value) || 1;
        precoSpan.textContent = 'R$ ' + (precoSelecionado * qtd).toFixed(2);
      }
      menosBtn.addEventListener('click', function () { qtdInput.stepDown(); atualizarPrecoImagem(); });
      maisBtn.addEventListener('click', function () { qtdInput.stepUp(); atualizarPrecoImagem(); });
      qtdInput.addEventListener('change', atualizarPrecoImagem);
      modal.querySelector('#addImagem').addEventListener('click', function () {
        if (produto.personalizavel === true || produto.tipo === 'personalizavel') { _fecharModalLocal(modal); abrirModalCustomizacaoCompleta(produto); return; }
        var qtd = parseInt(qtdInput.value) || 1;
        if (!validarEstoqueAdicao(produto, qtd)) return;
        var nomeCompleto = tamanhoSelecionado ? produto.nome + ' (' + tamanhoSelecionado + ')' : produto.nome;
        var existing = carrinho.find(function (i) { return i.id === produto.id && i.tamanho === tamanhoSelecionado; });
        if (existing) existing.quantidade += qtd;
        else carrinho.push(Object.assign({}, produto, { id: produto.id, nome: nomeCompleto, preco: precoSelecionado, quantidade: qtd, tamanho: tamanhoSelecionado }));
        atualizarCarrinhoVisual();
        recalcularTotal();
        atualizarBadgeCarrinho();
        UI.mostrarToast('Produto adicionado ao carrinho');
        _fecharModalLocal(modal);
      });
    }
    atualizarModal();
    document.body.appendChild(modal);
    _abrirModalLocal(modal);
  }

  function abrirModalCustomizacaoCompleta(produto) {
    var tamanhos = produto.tamanhosDisponiveis || [];
    var temTamanhosCustom = tamanhos.length > 0;
    if (temTamanhosCustom) tamanhoSelecionadoCustom = tamanhos[0].nome;
    else tamanhoSelecionadoCustom = null;

    limiteSaboresPorTamanho = {};
    tamanhos.forEach(function (t) {
      var limiteRaw = t.maxSabores !== undefined ? t.maxSabores : t.max;
      var limite = parseInt(limiteRaw, 10);
      limiteSaboresPorTamanho[t.nome] = isFinite(limite) && limite > 0 ? limite : 1;
    });
    if (!temTamanhosCustom) {
      var limiteSemTamanhoRaw = produto.maxSabores !== undefined ? produto.maxSabores : produto.max;
      var limiteSemTamanho = parseInt(limiteSemTamanhoRaw, 10);
      limiteSaboresPorTamanho.__sem_tamanho__ = isFinite(limiteSemTamanho) && limiteSemTamanho > 0 ? limiteSemTamanho : 1;
    }

    var idsSaboresPermitidos = produto.saboresPermitidos || [];
    var categoriaProduto = produto.categoria || '';
    var saboresDisponiveis = idsSaboresPermitidos.length > 0
      ? saboresGlobais.filter(function (s) { return idsSaboresPermitidos.indexOf(s.id) !== -1; })
      : saboresGlobais.filter(function (s) {
          if (!s.categorias || s.categorias === '') return true;
          return s.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(categoriaProduto) !== -1;
        });

    var idsExtrasPermitidos = produto.extrasPermitidos || [];
    var extrasFiltrados = idsExtrasPermitidos.length > 0
      ? extrasGlobais.filter(function (e) { return idsExtrasPermitidos.indexOf(e.id) !== -1; })
      : extrasGlobais.filter(function (e) {
          if (!e.categorias || e.categorias === '') return true;
          return e.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(categoriaProduto) !== -1;
        });

    saboresSelecionados = [];
    extrasSelecionados = extrasFiltrados.map(function (e) { return Object.assign({}, e, { quantidade: 0 }); });

    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Personalizar ' + produto.nome);

    function formatarBotaoTamanhoCustom(t) {
      var nome = t && t.nome ? t.nome : '';
      var precoRaw = t && (t.preco !== undefined ? t.preco : t.valor);
      var preco = parseFloat(precoRaw);
      var etiquetaPreco = isFinite(preco) && preco > 0 ? ' <span>R$ ' + preco.toFixed(2) + '</span>' : '';
      return '<button type="button" class="btn-tamanho-modal ' + (nome === tamanhoSelecionadoCustom ? 'ativo' : '') + '" data-tamanho="' + Core.sanitize(nome) + '">' + Core.sanitize(nome) + etiquetaPreco + '</button>';
    }

    modal.innerHTML =
      '<div class="modal-conteudo modal-customizacao-full modal-config-padrao">' +
        '<div class="modal-header modal-header-config">' +
          '<div><span class="modal-eyebrow">PERSONALIZE SEU ITEM</span><h3>' + Core.sanitize(produto.nome) + '</h3></div>' +
          '<button type="button" class="modal-close-btn" data-fechar-modal aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="modal-body modal-config-body">' +
          '<div class="modal-config-main">' +
            '<section class="modal-step">' +
              '<div class="modal-step-number">1</div>' +
              '<div class="modal-step-content">' +
                '<div class="modal-step-heading">' +
                  '<div><h4>Escolha o tamanho</h4><p>Selecione uma opção para continuar.</p></div>' +
                  (temTamanhosCustom ? '<span class="modal-required">Obrigatório</span>' : '<span class="modal-optional">Não se aplica</span>') +
                '</div>' +
                '<div class="tamanho-botoes-modal modal-size-options" id="customTamanhos">' +
                  (temTamanhosCustom ? tamanhos.map(formatarBotaoTamanhoCustom).join('') : '<span class="modal-empty-state">Tamanho não se aplica a este produto.</span>') +
                '</div>' +
              '</div>' +
            '</section>' +
            '<section class="modal-step custom-sabores-step">' +
              '<div class="modal-step-number">2</div>' +
              '<div class="modal-step-content">' +
                '<div class="modal-step-heading">' +
                  '<div><h4>Escolha os sabores</h4><p id="precoBaseMsg">' + (produto.saboresObrigatorios === true && saboresDisponiveis.length > 0 ? 'Selecione pelo menos um sabor.' : 'Opcional. Você pode continuar sem sabor.') + '</p></div>' +
                  '<div class="modal-step-heading-actions">' +
                    (produto.saboresObrigatorios === true && saboresDisponiveis.length > 0 ? '<span class="modal-required">Obrigatório</span>' : '<span class="modal-optional">Opcional</span>') +
                    '<button type="button" class="modal-section-toggle" id="btnExpandirSabores" aria-label="Recolher sabores">−</button>' +
                  '</div>' +
                '</div>' +
                '<div class="modal-limit-label">Máximo: <strong id="limiteSaboresLabel">' + (limiteSaboresPorTamanho[tamanhoSelecionadoCustom || '__sem_tamanho__'] || 1) + '</strong></div>' +
                '<div id="saboresLista" class="lista-sabores modal-options-list"></div>' +
              '</div>' +
            '</section>' +
            '<section class="modal-step modal-step-extras custom-extras-step">' +
              '<div class="modal-step-number">3</div>' +
              '<div class="modal-step-content">' +
                '<div class="modal-step-heading">' +
                  '<div><h4>Adicione extras</h4><p>Opcional. Personalize seu pedido como quiser.</p></div>' +
                  '<div class="modal-step-heading-actions">' +
                    '<span class="modal-optional">Opcional</span>' +
                    '<button type="button" class="modal-section-toggle" id="btnExpandirExtras" aria-label="Recolher extras">−</button>' +
                  '</div>' +
                '</div>' +
                '<div id="extrasLista" class="lista-extras modal-options-list"></div>' +
              '</div>' +
            '</section>' +
          '</div>' +
          '<aside class="modal-order-summary" aria-label="Resumo da personalização">' +
            (produto.imagem ? '<img class="custom-summary-image" src="' + produto.imagem + '" alt="' + Core.sanitize(produto.nome) + '">' : '') +
            '<div class="summary-header"><span>Resumo do item</span><span class="summary-live">Atualizado</span></div>' +
            '<div class="summary-row"><span>Produto</span><strong>' + Core.sanitize(produto.nome) + '</strong></div>' +
            '<div class="summary-row"><span>Tamanho</span><strong id="customResumoTamanho">' + (tamanhoSelecionadoCustom ? Core.sanitize(tamanhoSelecionadoCustom) : 'Não se aplica') + '</strong></div>' +
            '<div class="summary-row"><span>Sabores</span><strong id="customResumoSabores">Nenhum sabor</strong></div>' +
            '<div class="summary-row"><span>Extras</span><strong id="customResumoExtras">Nenhum extra</strong></div>' +
            '<div class="summary-tip">Confira suas escolhas aqui antes de adicionar ao carrinho.</div>' +
          '</aside>' +
        '</div>' +
        '<div class="modal-footer modal-config-footer">' +
          '<div class="modal-total"><span>Total do item</span><strong id="precoTotalCustom">Total: —</strong></div>' +
          '<button type="button" class="btn-pedido-cta" id="btnAddCustomizado"><span>Adicionar ao carrinho</span><span class="modal-button-arrow">→</span></button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    _abrirModalLocal(modal);

    var saboresContainer = modal.querySelector('#saboresLista');
    var extrasContainer = modal.querySelector('#extrasLista');

    function getPrecoSabor(sabor, tamanho) {
      if (sabor.precos && tamanho) {
        if (sabor.precos[tamanho] !== undefined) return parseFloat(sabor.precos[tamanho]) || 0;
        var chaveNormalizada = String(tamanho).trim().toLowerCase();
        var chaveEncontrada = Object.keys(sabor.precos).find(function (chave) { return String(chave).trim().toLowerCase() === chaveNormalizada; });
        if (chaveEncontrada !== undefined) return parseFloat(sabor.precos[chaveEncontrada]) || 0;
      }
      if (sabor.preco !== undefined) return parseFloat(sabor.preco) || 0;
      return parseFloat(produto.preco) || 0;
    }

    function obterLimiteSaboresAtual() {
      var chave = tamanhoSelecionadoCustom || '__sem_tamanho__';
      var limite = parseInt(limiteSaboresPorTamanho[chave], 10);
      return isFinite(limite) && limite > 0 ? limite : 1;
    }

    function sincronizarSaboresSelecionados() {
      var normalizados = [];
      saboresSelecionados.forEach(function (selecionado) {
        if (normalizados.length >= obterLimiteSaboresAtual()) return;
        var saborOriginal = saboresDisponiveis.find(function (sabor) { return sabor.id === selecionado.id; });
        if (!saborOriginal || normalizados.some(function (sabor) { return sabor.id === saborOriginal.id; })) return;
        normalizados.push({ id: saborOriginal.id, nome: saborOriginal.nome, preco: getPrecoSabor(saborOriginal, tamanhoSelecionadoCustom) });
      });
      saboresSelecionados = normalizados;
    }

    function atualizarListaSabores() {
      saboresContainer.innerHTML = '';
      if (saboresDisponiveis.length === 0) { saboresContainer.innerHTML = '<p class="modal-empty-state">Nenhum sabor disponível para este produto.</p>'; return; }
      saboresDisponiveis.forEach(function (sabor) {
        var preco = getPrecoSabor(sabor, tamanhoSelecionadoCustom);
        var isSelected = saboresSelecionados.some(function (s) { return s.id === sabor.id; });
        var itemDiv = document.createElement('article');
        itemDiv.className = 'item-sabor modal-option-card' + (isSelected ? ' selecionado' : '');
        itemDiv.dataset.id = sabor.id;
        var main = document.createElement('div'); main.className = 'modal-extra-main';
        if (sabor.imagem) { var img = document.createElement('img'); img.src = sabor.imagem; img.className = 'sabor-imagem extra-imagem'; img.alt = ''; main.appendChild(img); }
        var info = document.createElement('div'); info.className = 'modal-extra-info';
        var titleLine = document.createElement('div'); titleLine.className = 'modal-extra-title-line';
        var nomeSpan = document.createElement('strong'); nomeSpan.className = 'modal-extra-title'; nomeSpan.textContent = sabor.nome;
        var precoSpan = document.createElement('span'); precoSpan.className = 'item-preco modal-extra-price'; precoSpan.textContent = 'R$ ' + preco.toFixed(2);
        titleLine.appendChild(nomeSpan); titleLine.appendChild(precoSpan);
        var descDiv = document.createElement('p'); descDiv.className = 'modal-extra-description'; descDiv.textContent = sabor.descricao || 'Sem descrição';
        info.appendChild(titleLine); info.appendChild(descDiv); main.appendChild(info);
        var action = document.createElement('div'); action.className = 'modal-extra-actions';
        var btnSelect = document.createElement('button');
        btnSelect.type = 'button';
        btnSelect.className = 'btn-selecionar-sabor modal-select-btn' + (isSelected ? ' selecionado' : '');
        btnSelect.dataset.id = sabor.id;
        btnSelect.textContent = isSelected ? 'Selecionado' : 'Selecionar';
        btnSelect.setAttribute('aria-label', (isSelected ? 'Remover' : 'Selecionar') + ' sabor ' + sabor.nome);
        btnSelect.addEventListener('click', function (e) {
          e.stopPropagation();
          var limite = obterLimiteSaboresAtual();
          var selectedNow = saboresSelecionados.some(function (s) { return s.id === sabor.id; });
          if (selectedNow) {
            saboresSelecionados = saboresSelecionados.filter(function (s) { return s.id !== sabor.id; });
            itemDiv.classList.remove('selecionado');
            btnSelect.classList.remove('selecionado');
            btnSelect.textContent = 'Selecionar';
            btnSelect.setAttribute('aria-label', 'Selecionar sabor ' + sabor.nome);
          } else {
            if (saboresSelecionados.length >= limite) { UI.mostrarToast('Máximo de ' + limite + ' sabores permitido.'); return; }
            saboresSelecionados.push({ id: sabor.id, nome: sabor.nome, preco: getPrecoSabor(sabor, tamanhoSelecionadoCustom) });
            itemDiv.classList.add('selecionado');
            btnSelect.classList.add('selecionado');
            btnSelect.textContent = 'Selecionado';
            btnSelect.setAttribute('aria-label', 'Remover sabor ' + sabor.nome);
          }
          sincronizarSaboresSelecionados();
          atualizarPrecoCustom();
        });
        action.appendChild(btnSelect);
        itemDiv.appendChild(main); itemDiv.appendChild(action);
        saboresContainer.appendChild(itemDiv);
      });
    }

    function atualizarCardExtraCustom(extraItem, extraDiv, qtdDiv) {
      var addBtn = qtdDiv.querySelector('.extra-add-btn');
      var minusBtn = qtdDiv.querySelector('button[data-delta="-1"]');
      var plusBtn = qtdDiv.querySelector('button[data-delta="1"]:not(.extra-add-btn)');
      var ativo = extraItem.quantidade > 0;
      extraDiv.classList.toggle('ativo', ativo);
      if (addBtn) { addBtn.textContent = ativo ? 'Adicionado' : 'Adicionar'; addBtn.classList.toggle('ativo', ativo); }
      if (minusBtn) minusBtn.disabled = !ativo;
      if (plusBtn) plusBtn.disabled = !!(extraItem.max && extraItem.quantidade >= extraItem.max);
    }

    function atualizarListaExtras() {
      extrasContainer.innerHTML = '';
      if (extrasSelecionados.length === 0) { extrasContainer.innerHTML = '<p class="modal-empty-state">Nenhum extra disponível para este produto.</p>'; return; }
      extrasSelecionados.forEach(function (extra) {
        var extraDiv = document.createElement('article');
        extraDiv.className = 'item-extra modal-option-card';
        var main = document.createElement('div'); main.className = 'modal-extra-main';
        if (extra.imagem) { var img = document.createElement('img'); img.src = extra.imagem; img.className = 'extra-imagem'; img.alt = ''; main.appendChild(img); }
        var info = document.createElement('div'); info.className = 'modal-extra-info';
        var titleLine = document.createElement('div'); titleLine.className = 'modal-extra-title-line';
        var nomeSpan = document.createElement('strong'); nomeSpan.className = 'modal-extra-title'; nomeSpan.textContent = extra.nome;
        var precoSpan = document.createElement('span'); precoSpan.className = 'item-preco modal-extra-price'; precoSpan.textContent = 'R$ ' + extra.preco.toFixed(2);
        titleLine.appendChild(nomeSpan); titleLine.appendChild(precoSpan);
        var descDiv = document.createElement('p'); descDiv.className = 'modal-extra-description'; descDiv.textContent = extra.descricao || 'Sem descrição';
        info.appendChild(titleLine); info.appendChild(descDiv); main.appendChild(info);
        var qtdDiv = document.createElement('div'); qtdDiv.className = 'modal-extra-actions';
        qtdDiv.innerHTML = '<button type="button" class="extra-add-btn" data-extra-id="' + extra.id + '" data-delta="1" aria-label="Adicionar extra ' + Core.sanitize(extra.nome) + '">' + (extra.quantidade > 0 ? 'Adicionado' : 'Adicionar') + '</button>' +
          '<div class="extra-qtd" aria-label="Quantidade de ' + Core.sanitize(extra.nome) + '">' +
            '<button type="button" data-extra-id="' + extra.id + '" data-delta="-1" aria-label="Diminuir quantidade de ' + Core.sanitize(extra.nome) + '">−</button>' +
            '<span id="extra-custom-qtd-' + extra.id + '">' + extra.quantidade + '</span>' +
            '<button type="button" data-extra-id="' + extra.id + '" data-delta="1" aria-label="Aumentar quantidade de ' + Core.sanitize(extra.nome) + '">+</button>' +
          '</div>';
        extraDiv.appendChild(main); extraDiv.appendChild(qtdDiv);
        extrasContainer.appendChild(extraDiv);
        atualizarCardExtraCustom(extra, extraDiv, qtdDiv);
        qtdDiv.querySelectorAll('button[data-delta]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var extraId = btn.dataset.extraId;
            var delta = parseInt(btn.dataset.delta);
            var extraItem = extrasSelecionados.find(function (ex) { return ex.id === extraId; });
            if (extraItem) {
              var novaQtd = extraItem.quantidade + delta;
              if (novaQtd < 0) novaQtd = 0;
              if (extraItem.max && novaQtd > extraItem.max) novaQtd = extraItem.max;
              extraItem.quantidade = novaQtd;
              var span = qtdDiv.querySelector('#extra-custom-qtd-' + extraId);
              if (span) span.textContent = novaQtd;
              atualizarCardExtraCustom(extraItem, extraDiv, qtdDiv);
              atualizarPrecoCustom();
            }
          });
        });
      });
    }

    function atualizarResumoCustom() {
      var tamanhoEl = modal.querySelector('#customResumoTamanho');
      var saboresEl = modal.querySelector('#customResumoSabores');
      var extrasEl = modal.querySelector('#customResumoExtras');
      if (tamanhoEl) tamanhoEl.textContent = tamanhoSelecionadoCustom || 'Não se aplica';
      if (saboresEl) saboresEl.textContent = saboresSelecionados.length ? saboresSelecionados.map(function (s) { return s.nome; }).join(', ') : 'Nenhum sabor';
      var ativos = extrasSelecionados.filter(function (e) { return e.quantidade > 0; });
      if (extrasEl) extrasEl.textContent = ativos.length ? ativos.map(function (e) { return e.quantidade + 'x ' + e.nome; }).join(', ') : 'Nenhum extra';
    }

    function obterPrecoSaborSelecionado(saborSelecionado) {
      var saborOriginal = saboresDisponiveis.find(function (sabor) { return sabor.id === saborSelecionado.id; });
      var preco = saborOriginal ? getPrecoSabor(saborOriginal, tamanhoSelecionadoCustom) : saborSelecionado.preco;
      return parseFloat(preco) || 0;
    }

    function atualizarPrecoCustom() {
      sincronizarSaboresSelecionados();
      var tamanhoAtual = temTamanhosCustom ? tamanhos.find(function (t) { return t.nome === tamanhoSelecionadoCustom; }) : null;
      var precoBase = tamanhoAtual ? (parseFloat(tamanhoAtual.preco) || 0) : (parseFloat(produto.preco) || 0);
      var totalSabores = precoBase;
      if (saboresSelecionados.length > 0) {
        var somaSabores = saboresSelecionados.reduce(function (acc, s) { return acc + obterPrecoSaborSelecionado(s); }, 0);
        totalSabores = somaSabores / saboresSelecionados.length;
      }
      var totalExtras = extrasSelecionados.reduce(function (acc, e) { return acc + (e.preco * e.quantidade); }, 0);
      var total = totalSabores + totalExtras;
      var precoSpan = modal.querySelector('#precoTotalCustom');
      var msgSpan = modal.querySelector('#precoBaseMsg');
      var exigeSabor = produto.saboresObrigatorios === true && saboresDisponiveis.length > 0;
      if (saboresSelecionados.length === 0 && exigeSabor) {
        if (precoSpan) precoSpan.textContent = 'Total: —';
        if (msgSpan) msgSpan.textContent = 'Selecione pelo menos um sabor.';
      } else {
        if (precoSpan) precoSpan.textContent = 'Total: R$ ' + total.toFixed(2);
        if (msgSpan) msgSpan.textContent = saboresSelecionados.length > 0 ? 'Preço calculado pelos sabores.' : 'Preço base do produto.';
      }
      atualizarResumoCustom();
    }

    var saboresExpanded = true;
    var extrasExpanded = true;
    var btnExpandirSabores = modal.querySelector('#btnExpandirSabores');
    var btnExpandirExtras = modal.querySelector('#btnExpandirExtras');
    btnExpandirSabores.addEventListener('click', function () {
      if (saboresExpanded) { saboresContainer.style.display = 'none'; btnExpandirSabores.textContent = '+'; btnExpandirSabores.setAttribute('aria-label', 'Expandir sabores'); }
      else { saboresContainer.style.display = 'block'; btnExpandirSabores.textContent = '−'; btnExpandirSabores.setAttribute('aria-label', 'Recolher sabores'); }
      saboresExpanded = !saboresExpanded;
    });
    btnExpandirExtras.addEventListener('click', function () {
      if (extrasExpanded) { extrasContainer.style.display = 'none'; btnExpandirExtras.textContent = '+'; btnExpandirExtras.setAttribute('aria-label', 'Expandir extras'); }
      else { extrasContainer.style.display = 'block'; btnExpandirExtras.textContent = '−'; btnExpandirExtras.setAttribute('aria-label', 'Recolher extras'); }
      extrasExpanded = !extrasExpanded;
    });

    atualizarListaSabores();
    atualizarListaExtras();
    atualizarPrecoCustom();

    modal.querySelectorAll('.btn-tamanho-modal').forEach(function (btn) {
      btn.addEventListener('click', function () {
        modal.querySelectorAll('.btn-tamanho-modal').forEach(function (b) { b.classList.remove('ativo'); });
        btn.classList.add('ativo');
        tamanhoSelecionadoCustom = btn.dataset.tamanho;
        var limiteLabel = modal.querySelector('#limiteSaboresLabel');
        if (limiteLabel) limiteLabel.textContent = obterLimiteSaboresAtual();
        saboresDisponiveis.forEach(function (sabor) {
          var novoPreco = getPrecoSabor(sabor, tamanhoSelecionadoCustom);
          var itemDiv = Array.from(saboresContainer.children).find(function (div) { return div.dataset && div.dataset.id === sabor.id; });
          if (itemDiv) {
            var precoSpan = itemDiv.querySelector('.item-preco');
            if (precoSpan) precoSpan.textContent = 'R$ ' + novoPreco.toFixed(2);
            var selected = saboresSelecionados.find(function (s) { return s.id === sabor.id; });
            if (selected) selected.preco = novoPreco;
          }
        });
        sincronizarSaboresSelecionados();
        atualizarListaSabores();
        atualizarPrecoCustom();
      });
    });

    modal.querySelector('#btnAddCustomizado').addEventListener('click', function () {
      if (saboresSelecionados.length === 0 && produto.saboresObrigatorios === true && saboresDisponiveis.length > 0) {
        UI.mostrarToast('Selecione pelo menos um sabor.');
        return;
      }
      var quantidade = 1;
      if (!validarEstoqueAdicao(produto, quantidade)) return;
      var totalTexto = modal.querySelector('#precoTotalCustom').textContent || '';
      var totalPreco = parseFloat(totalTexto.replace('Total: R$ ', '').replace('R$ ', '').replace(',', '.'));
      if (isNaN(totalPreco)) totalPreco = parseFloat(produto.preco) || 0;
      var nomeCompleto = produto.nome + (tamanhoSelecionadoCustom ? ' (' + tamanhoSelecionadoCustom + ')' : '') + (saboresSelecionados.length > 0 ? ' - ' + saboresSelecionados.map(function (s) { return s.nome; }).join(' + ') : '');
      var extrasTexto = extrasSelecionados.filter(function (e) { return e.quantidade > 0; }).map(function (e) { return e.quantidade + 'x ' + e.nome; }).join(', ');
      var nomeFinal = extrasTexto ? nomeCompleto + ' [' + extrasTexto + ']' : nomeCompleto;
      var existing = carrinho.find(function (i) { return i.id === produto.id && i.tamanho === tamanhoSelecionadoCustom && JSON.stringify(i.sabores) === JSON.stringify(saboresSelecionados); });
      if (existing) existing.quantidade += quantidade;
      else carrinho.push(Object.assign({}, produto, { id: produto.id, nome: nomeFinal, preco: totalPreco, quantidade: quantidade, tamanho: tamanhoSelecionadoCustom, sabores: saboresSelecionados.slice(), extras: extrasSelecionados.filter(function (e) { return e.quantidade > 0; }) }));
      atualizarCarrinhoVisual();
      recalcularTotal();
      atualizarBadgeCarrinho();
      UI.mostrarToast('Produto adicionado ao carrinho');
      _fecharModalLocal(modal);
    });
  }

  function abrirModalTamanhosExtras(produto) {
    var tamanhos = produto.tamanhos || [];
    if (!tamanhos.length) { UI.mostrarToast('Produto sem variações de tamanho.'); return; }
    var tamanhoSelecionado = tamanhos[0].nome;
    var idsExtrasPermitidos = produto.extrasPermitidos || [];
    var categoriaProduto = produto.categoria || '';
    var extrasDisponiveis = idsExtrasPermitidos.length > 0
      ? extrasGlobais.filter(function (e) { return idsExtrasPermitidos.indexOf(e.id) !== -1; })
      : extrasGlobais.filter(function (e) {
          if (!e.categorias || e.categorias === '') return true;
          return e.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(categoriaProduto) !== -1;
        });
    var selecaoExtras = extrasDisponiveis.map(function (e) { return Object.assign({}, e, { quantidade: 0 }); });

    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Escolher tamanho de ' + produto.nome);

    modal.innerHTML =
      '<div class="modal-conteudo modal-extras-pontual">' +
        '<div class="modal-header modal-header-config">' +
          '<div><span class="modal-eyebrow">PERSONALIZE SEU ITEM</span><h3>' + Core.sanitize(produto.nome) + '</h3></div>' +
          '<button type="button" class="modal-close-btn" data-fechar-modal aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="modal-body modal-config-body">' +
          '<div class="modal-config-main">' +
            '<section class="modal-step">' +
              '<div class="modal-step-number">1</div>' +
              '<div class="modal-step-content">' +
                '<div class="modal-step-heading"><div><h4>Escolha o tamanho</h4><p>Selecione uma opção para continuar.</p></div><span class="modal-required">Obrigatório</span></div>' +
                '<div class="tamanho-botoes-modal modal-size-options" id="tamanhosContainerModal">' + tamanhos.map(function (t, index) { return '<button type="button" class="btn-tamanho-modal ' + (index === 0 ? 'ativo' : '') + '" data-tamanho="' + Core.sanitize(t.nome) + '" data-preco="' + t.preco + '">' + Core.sanitize(t.nome) + ' <span>R$ ' + parseFloat(t.preco).toFixed(2) + '</span></button>'; }).join('') + '</div>' +
              '</div>' +
            '</section>' +
            '<section class="modal-step modal-step-extras">' +
              '<div class="modal-step-number">2</div>' +
              '<div class="modal-step-content">' +
                '<div class="modal-step-heading"><div><h4>Adicione extras</h4><p>Opcional. Personalize seu pedido como quiser.</p></div><span class="modal-optional">Opcional</span></div>' +
                '<div id="extrasContainerModal" class="modal-extras-list">' + (selecaoExtras.length === 0 ? '<p class="modal-empty-state">Nenhum extra disponível para este produto.</p>' : '') + '</div>' +
              '</div>' +
            '</section>' +
          '</div>' +
          '<aside class="modal-order-summary" aria-label="Resumo da personalização">' +
            '<div class="summary-header"><span>Resumo do item</span><span class="summary-live">Atualizado</span></div>' +
            '<div class="summary-row"><span>Produto</span><strong>' + Core.sanitize(produto.nome) + '</strong></div>' +
            '<div class="summary-row"><span>Tamanho</span><strong id="resumoTamanhoSelecionado">' + Core.sanitize(tamanhoSelecionado) + '</strong></div>' +
            '<div class="summary-row summary-row-extras"><span>Extras</span><strong id="resumoExtrasSelecionados">Nenhum extra</strong></div>' +
            '<div class="summary-tip">Você poderá revisar o pedido no carrinho antes de finalizar.</div>' +
          '</aside>' +
        '</div>' +
        '<div class="modal-footer modal-config-footer">' +
          '<div class="modal-total"><span>Total do item</span><strong id="precoTotalTamanho">R$ ' + parseFloat(tamanhos[0].preco).toFixed(2) + '</strong></div>' +
          '<button type="button" class="btn-pedido-cta" id="btnAddTamanhoExtras"><span>Adicionar ao carrinho</span><span class="modal-button-arrow">→</span></button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    _abrirModalLocal(modal);

    var extrasContainer = modal.querySelector('#extrasContainerModal');
    var tamanhosContainer = modal.querySelector('#tamanhosContainerModal');
    var precoTotalEl = modal.querySelector('#precoTotalTamanho');
    var precoTamanhoAtual = parseFloat(tamanhos[0].preco) || 0;

    function atualizarCardExtra(extraItem, extraDiv, qtdDiv) {
      var addBtn = qtdDiv.querySelector('.extra-add-btn');
      var minusBtn = qtdDiv.querySelector('button[data-delta="-1"]');
      var plusBtn = qtdDiv.querySelector('button[data-delta="1"]:not(.extra-add-btn)');
      var ativo = extraItem.quantidade > 0;
      extraDiv.classList.toggle('ativo', ativo);
      if (addBtn) { addBtn.textContent = ativo ? 'Adicionado' : 'Adicionar'; addBtn.classList.toggle('ativo', ativo); }
      if (minusBtn) minusBtn.disabled = !ativo;
      if (plusBtn) plusBtn.disabled = !!(extraItem.max && extraItem.quantidade >= extraItem.max);
    }
    function atualizarResumoTamanhosExtras() {
      var tamanhoEl = modal.querySelector('#resumoTamanhoSelecionado');
      var extrasEl = modal.querySelector('#resumoExtrasSelecionados');
      if (tamanhoEl) tamanhoEl.textContent = tamanhoSelecionado || 'Não definido';
      var ativos = selecaoExtras.filter(function (e) { return e.quantidade > 0; });
      if (extrasEl) extrasEl.textContent = ativos.length ? ativos.map(function (e) { return e.quantidade + 'x ' + e.nome; }).join(', ') : 'Nenhum extra';
    }
    function atualizarPrecoTotalTamanho() {
      var extraTotal = selecaoExtras.reduce(function (acc, e) { return acc + (e.preco * e.quantidade); }, 0);
      precoTotalEl.textContent = 'R$ ' + (precoTamanhoAtual + extraTotal).toFixed(2);
      atualizarResumoTamanhosExtras();
    }
    function renderizarExtras() {
      extrasContainer.innerHTML = '';
      if (selecaoExtras.length === 0) { extrasContainer.innerHTML = '<p class="modal-empty-state">Nenhum extra disponível para este produto.</p>'; atualizarResumoTamanhosExtras(); return; }
      selecaoExtras.forEach(function (extra) {
        var extraDiv = document.createElement('article'); extraDiv.className = 'item-extra modal-extra-card';
        var main = document.createElement('div'); main.className = 'modal-extra-main';
        if (extra.imagem) { var img = document.createElement('img'); img.src = extra.imagem; img.className = 'extra-imagem'; img.alt = ''; main.appendChild(img); }
        var info = document.createElement('div'); info.className = 'modal-extra-info';
        var titleLine = document.createElement('div'); titleLine.className = 'modal-extra-title-line';
        var nomeSpan = document.createElement('strong'); nomeSpan.className = 'modal-extra-title'; nomeSpan.textContent = extra.nome;
        var precoSpan = document.createElement('span'); precoSpan.className = 'modal-extra-price'; precoSpan.textContent = 'R$ ' + extra.preco.toFixed(2);
        titleLine.appendChild(nomeSpan); titleLine.appendChild(precoSpan);
        var descDiv = document.createElement('p'); descDiv.className = 'modal-extra-description'; descDiv.textContent = extra.descricao || 'Sem descrição';
        info.appendChild(titleLine); info.appendChild(descDiv); main.appendChild(info);
        var qtdDiv = document.createElement('div'); qtdDiv.className = 'modal-extra-actions';
        qtdDiv.innerHTML = '<button type="button" class="extra-add-btn" data-extra-id="' + extra.id + '" data-delta="1">' + (extra.quantidade > 0 ? 'Adicionado' : 'Adicionar') + '</button>' +
          '<div class="extra-qtd"><button type="button" data-extra-id="' + extra.id + '" data-delta="-1">−</button><span id="extra-qtd-' + extra.id + '">' + extra.quantidade + '</span><button type="button" data-extra-id="' + extra.id + '" data-delta="1">+</button></div>';
        extraDiv.appendChild(main); extraDiv.appendChild(qtdDiv);
        extrasContainer.appendChild(extraDiv);
        atualizarCardExtra(extra, extraDiv, qtdDiv);
        qtdDiv.querySelectorAll('button[data-delta]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var extraId = btn.dataset.extraId;
            var delta = parseInt(btn.dataset.delta);
            var extraItem = selecaoExtras.find(function (ex) { return ex.id === extraId; });
            if (extraItem) {
              var novaQtd = extraItem.quantidade + delta;
              if (novaQtd < 0) novaQtd = 0;
              if (extraItem.max && novaQtd > extraItem.max) novaQtd = extraItem.max;
              extraItem.quantidade = novaQtd;
              var span = qtdDiv.querySelector('#extra-qtd-' + extraId);
              if (span) span.textContent = novaQtd;
              atualizarCardExtra(extraItem, extraDiv, qtdDiv);
              atualizarPrecoTotalTamanho();
            }
          });
        });
      });
      atualizarResumoTamanhosExtras();
    }

    tamanhosContainer.addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-tamanho-modal');
      if (!btn) return;
      tamanhosContainer.querySelectorAll('.btn-tamanho-modal').forEach(function (b) { b.classList.remove('ativo'); });
      btn.classList.add('ativo');
      tamanhoSelecionado = btn.dataset.tamanho;
      precoTamanhoAtual = parseFloat(btn.dataset.preco) || 0;
      atualizarPrecoTotalTamanho();
    });
    renderizarExtras();

    modal.querySelector('#btnAddTamanhoExtras').addEventListener('click', function () {
      if (!validarEstoqueAdicao(produto, 1)) return;
      var precoFinal = precoTamanhoAtual + selecaoExtras.reduce(function (acc, e) { return acc + (e.preco * e.quantidade); }, 0);
      var extrasTexto = selecaoExtras.filter(function (e) { return e.quantidade > 0; }).map(function (e) { return e.quantidade + 'x ' + e.nome; }).join(', ');
      var nomeFinal = produto.nome + ' (' + tamanhoSelecionado + ')' + (extrasTexto ? ' [' + extrasTexto + ']' : '');
      var existing = carrinho.find(function (i) { return i.id === produto.id && i.tamanho === tamanhoSelecionado; });
      if (existing) existing.quantidade += 1;
      else carrinho.push(Object.assign({}, produto, { id: produto.id, nome: nomeFinal, preco: precoFinal, quantidade: 1, tamanho: tamanhoSelecionado, extras: selecaoExtras.filter(function (e) { return e.quantidade > 0; }) }));
      atualizarCarrinhoVisual(); recalcularTotal(); atualizarBadgeCarrinho();
      UI.mostrarToast('Produto adicionado ao carrinho');
      _fecharModalLocal(modal);
    });
  }

  function abrirModalExtrasSimples(produto) {
    var idsExtrasPermitidos = produto.extrasPermitidos || [];
    var categoriaProduto = produto.categoria || '';
    var extrasDisponiveis = idsExtrasPermitidos.length > 0
      ? extrasGlobais.filter(function (e) { return idsExtrasPermitidos.indexOf(e.id) !== -1; })
      : extrasGlobais.filter(function (e) {
          if (!e.categorias || e.categorias === '') return true;
          return e.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(categoriaProduto) !== -1;
        });
    var selecaoExtras = extrasDisponiveis.map(function (e) { return Object.assign({}, e, { quantidade: 0 }); });
    var precoBase = parseFloat(produto.preco) || 0;

    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Adicionar extras para ' + produto.nome);

    modal.innerHTML =
      '<div class="modal-conteudo modal-extras-pontual">' +
        '<div class="modal-header modal-header-config">' +
          '<div><span class="modal-eyebrow">PERSONALIZE SEU ITEM</span><h3>' + Core.sanitize(produto.nome) + '</h3></div>' +
          '<button type="button" class="modal-close-btn" data-fechar-modal aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="modal-body modal-config-body">' +
          '<div class="modal-config-main">' +
            '<section class="modal-step modal-step-extras">' +
              '<div class="modal-step-number">1</div>' +
              '<div class="modal-step-content">' +
                '<div class="modal-step-heading"><div><h4>Adicione extras</h4><p>Opcional. Personalize seu pedido como quiser.</p></div><span class="modal-optional">Opcional</span></div>' +
                '<div id="extrasSimplesContainer" class="modal-extras-list"></div>' +
              '</div>' +
            '</section>' +
          '</div>' +
          '<aside class="modal-order-summary">' +
            '<div class="summary-header"><span>Resumo do item</span><span class="summary-live">Atualizado</span></div>' +
            '<div class="summary-row"><span>Produto</span><strong>' + Core.sanitize(produto.nome) + '</strong></div>' +
            '<div class="summary-row"><span>Extras</span><strong id="resumoExtrasSimples">Nenhum extra</strong></div>' +
          '</aside>' +
        '</div>' +
        '<div class="modal-footer modal-config-footer">' +
          '<div class="modal-total"><span>Total do item</span><strong id="precoTotalSimples">Total: R$ ' + precoBase.toFixed(2) + '</strong></div>' +
          '<button type="button" class="btn-pedido-cta" id="btnAddExtraSimples"><span>Adicionar ao carrinho</span><span class="modal-button-arrow">→</span></button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    _abrirModalLocal(modal);

    var extrasContainer = modal.querySelector('#extrasSimplesContainer');
    var precoTotalEl = modal.querySelector('#precoTotalSimples');

    function atualizarCardExtra(extraItem, extraDiv, qtdDiv) {
      var addBtn = qtdDiv.querySelector('.extra-add-btn');
      var minusBtn = qtdDiv.querySelector('button[data-delta="-1"]');
      var plusBtn = qtdDiv.querySelector('button[data-delta="1"]:not(.extra-add-btn)');
      var ativo = extraItem.quantidade > 0;
      extraDiv.classList.toggle('ativo', ativo);
      if (addBtn) { addBtn.textContent = ativo ? 'Adicionado' : 'Adicionar'; addBtn.classList.toggle('ativo', ativo); }
      if (minusBtn) minusBtn.disabled = !ativo;
      if (plusBtn) plusBtn.disabled = !!(extraItem.max && extraItem.quantidade >= extraItem.max);
    }
    function atualizarPrecoTotalSimples() {
      var extraTotal = selecaoExtras.reduce(function (acc, e) { return acc + (e.preco * e.quantidade); }, 0);
      precoTotalEl.textContent = 'Total: R$ ' + (precoBase + extraTotal).toFixed(2);
    }
    function renderizarExtras() {
      extrasContainer.innerHTML = '';
      if (selecaoExtras.length === 0) { extrasContainer.innerHTML = '<p class="modal-empty-state">Nenhum extra disponível para este produto.</p>'; return; }
      selecaoExtras.forEach(function (extra) {
        var extraDiv = document.createElement('article'); extraDiv.className = 'item-extra modal-extra-card';
        var main = document.createElement('div'); main.className = 'modal-extra-main';
        if (extra.imagem) { var img = document.createElement('img'); img.src = extra.imagem; img.className = 'extra-imagem'; img.alt = ''; main.appendChild(img); }
        var info = document.createElement('div'); info.className = 'modal-extra-info';
        var titleLine = document.createElement('div'); titleLine.className = 'modal-extra-title-line';
        var nomeSpan = document.createElement('strong'); nomeSpan.className = 'modal-extra-title'; nomeSpan.textContent = extra.nome;
        var precoSpan = document.createElement('span'); precoSpan.className = 'modal-extra-price'; precoSpan.textContent = 'R$ ' + extra.preco.toFixed(2);
        titleLine.appendChild(nomeSpan); titleLine.appendChild(precoSpan);
        var descDiv = document.createElement('p'); descDiv.className = 'modal-extra-description'; descDiv.textContent = extra.descricao || 'Sem descrição';
        info.appendChild(titleLine); info.appendChild(descDiv); main.appendChild(info);
        var qtdDiv = document.createElement('div'); qtdDiv.className = 'modal-extra-actions';
        qtdDiv.innerHTML = '<button type="button" class="extra-add-btn" data-extra-id="' + extra.id + '" data-delta="1">' + (extra.quantidade > 0 ? 'Adicionado' : 'Adicionar') + '</button>' +
          '<div class="extra-qtd"><button type="button" data-extra-id="' + extra.id + '" data-delta="-1">−</button><span id="extra-simples-qtd-' + extra.id + '">' + extra.quantidade + '</span><button type="button" data-extra-id="' + extra.id + '" data-delta="1">+</button></div>';
        extraDiv.appendChild(main); extraDiv.appendChild(qtdDiv);
        extrasContainer.appendChild(extraDiv);
        atualizarCardExtra(extra, extraDiv, qtdDiv);
        qtdDiv.querySelectorAll('button[data-delta]').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            e.stopPropagation();
            var extraId = btn.dataset.extraId;
            var delta = parseInt(btn.dataset.delta);
            var extraItem = selecaoExtras.find(function (ex) { return ex.id === extraId; });
            if (extraItem) {
              var novaQtd = extraItem.quantidade + delta;
              if (novaQtd < 0) novaQtd = 0;
              if (extraItem.max && novaQtd > extraItem.max) novaQtd = extraItem.max;
              extraItem.quantidade = novaQtd;
              var span = qtdDiv.querySelector('#extra-simples-qtd-' + extraId);
              if (span) span.textContent = novaQtd;
              atualizarCardExtra(extraItem, extraDiv, qtdDiv);
              atualizarPrecoTotalSimples();
            }
          });
        });
      });
    }
    renderizarExtras();

    modal.querySelector('#btnAddExtraSimples').addEventListener('click', function () {
      if (!validarEstoqueAdicao(produto, 1)) return;
      var precoFinal = precoBase + selecaoExtras.reduce(function (acc, e) { return acc + (e.preco * e.quantidade); }, 0);
      var extrasTexto = selecaoExtras.filter(function (e) { return e.quantidade > 0; }).map(function (e) { return e.quantidade + 'x ' + e.nome; }).join(', ');
      var nomeFinal = produto.nome + (extrasTexto ? ' [' + extrasTexto + ']' : '');
      var existing = carrinho.find(function (i) { return i.id === produto.id && !i.tamanho; });
      if (existing) existing.quantidade += 1;
      else carrinho.push(Object.assign({}, produto, { id: produto.id, nome: nomeFinal, preco: precoFinal, quantidade: 1, tamanho: null, extras: selecaoExtras.filter(function (e) { return e.quantidade > 0; }) }));
      atualizarCarrinhoVisual(); recalcularTotal(); atualizarBadgeCarrinho();
      UI.mostrarToast('Produto adicionado ao carrinho');
      _fecharModalLocal(modal);
    });
  }

  function validarEstoqueAdicao(produto, quantidade) {
    if (produto.estoque === null || produto.estoque === undefined || produto.estoque === '') return true;
    var estoque = parseInt(produto.estoque, 10);
    if (isNaN(estoque) || estoque < 0) { UI.mostrarToast('Estoque inválido para este produto.'); return false; }
    var noCarrinho = carrinho.reduce(function (total, item) { return total + (item.id === produto.id ? (parseInt(item.quantidade, 10) || 0) : 0); }, 0);
    if (noCarrinho + quantidade > estoque) { UI.mostrarToast('Estoque insuficiente. Disponível: ' + estoque); return false; }
    return true;
  }
  function atualizarCarrinhoVisual() {
    var container = document.getElementById('carrinhoLista');
    if (!container) return;
    if (carrinho.length === 0) { container.innerHTML = '<p style="text-align:center;">Carrinho vazio</p>'; return; }
    container.innerHTML = carrinho.map(function (item) {
      return '<div class="item-carrinho">' +
        '<img src="' + (item.imagem || 'https://via.placeholder.com/40') + '" class="item-carrinho-imagem" alt="' + Core.sanitize(item.nome) + '" onerror="this.style.display=\'none\'">' +
        '<div style="flex:1"><strong>' + Core.sanitize(item.nome) + '</strong><br>R$ ' + item.preco.toFixed(2) + '</div>' +
        '<input type="number" min="1" value="' + item.quantidade + '" class="qtd-item" onchange="Economizei.Pedido.alterarQuantidade(\'' + Core.jsEscape(item.id) + '\', this.value)" aria-label="Quantidade de ' + Core.sanitize(item.nome) + '">' +
        '<button class="btn-pequeno" onclick="Economizei.Pedido.removerItem(\'' + Core.jsEscape(item.id) + '\')" aria-label="Remover ' + Core.sanitize(item.nome) + '">✕</button>' +
        '</div>';
    }).join('');
  }
  function alterarQuantidade(id, value) {
    var qtd = parseInt(value) || 1;
    var item = carrinho.find(function (i) { return i.id === id; });
    if (item) {
      if (item.estoque !== null && item.estoque !== undefined && item.estoque !== '') {
        var estoque = parseInt(item.estoque);
        var outros = carrinho.reduce(function (total, i) { return total + (i !== item && i.id === id ? (parseInt(i.quantidade, 10) || 0) : 0); }, 0);
        if (!isNaN(estoque) && outros + qtd > estoque) { UI.mostrarToast('Estoque insuficiente. Disponível: ' + estoque); atualizarCarrinhoVisual(); return; }
      }
      item.quantidade = Math.max(1, qtd);
      atualizarCarrinhoVisual(); recalcularTotal(); atualizarBadgeCarrinho();
    }
  }
  function removerItem(id) {
    if (confirm('Remover este item do carrinho?')) {
      carrinho = carrinho.filter(function (i) { return i.id !== id; });
      atualizarCarrinhoVisual(); recalcularTotal(); atualizarBadgeCarrinho();
    }
  }
  function atualizarBadgeCarrinho() {
    var total = carrinho.reduce(function (acc, i) { return acc + i.quantidade; }, 0);
    var badge = document.getElementById('cartBadge');
    if (badge) {
      if (total > 0) { badge.textContent = total; badge.style.display = 'inline-block'; badge.setAttribute('aria-label', total + ' itens no carrinho'); }
      else badge.style.display = 'none';
    }
  }
  function recalcularTotal() {
    var subtotal = carrinho.reduce(function (acc, i) { return acc + i.preco * i.quantidade; }, 0);
    var freteSelect = document.getElementById('selectFrete');
    var frete = freteSelect ? (parseFloat(freteSelect.value) || 0) : 0;
    var total = subtotal + frete - cupomDesconto;
    if (total < 0) total = 0;
    var subEl = document.getElementById('carrinhoSubtotal');
    var totalEl = document.getElementById('totalPedido');
    if (subEl) subEl.innerText = subtotal.toFixed(2);
    if (totalEl) totalEl.innerText = total.toFixed(2);
  }
  function aplicarCupom() {
    var cod = document.getElementById('cupomInput').value.trim().toUpperCase();
    var statusDiv = document.getElementById('cupomStatus');
    if (!cod) { statusDiv.innerHTML = 'Digite um código.'; return; }
    var subtotal = carrinho.reduce(function (acc, i) { return acc + i.preco * i.quantidade; }, 0);
    var freteSelect = document.getElementById('selectFrete');
    var frete = freteSelect ? (parseFloat(freteSelect.value) || 0) : 0;
    validarCupom(cod, subtotal, frete, currentEstId).then(function (cupomValido) {
      if (cupomValido) {
        cupomDesconto = cupomValido.desconto;
        statusDiv.innerHTML = '<span style="color:#10b981;">✅ Cupom aplicado! Desconto de ' + (cupomValido.tipo === 'percentual' ? cupomValido.valor + '%' : 'R$ ' + cupomValido.valor.toFixed(2)) + '</span>';
      } else {
        cupomDesconto = 0;
        statusDiv.innerHTML = '<span style="color:#dc3545;">❌ Cupom inválido ou expirado</span>';
      }
      recalcularTotal();
    }).catch(function () {
      cupomDesconto = 0;
      statusDiv.innerHTML = '<span style="color:#dc3545;">Erro ao validar cupom. Tente novamente.</span>';
      recalcularTotal();
    });
  }
  function toggleTroco() {
    var forma = document.getElementById('formaPagamento') ? document.getElementById('formaPagamento').value : null;
    var wrapper = document.getElementById('trocoParaWrapper');
    if (wrapper) wrapper.style.display = forma === 'Dinheiro' ? 'block' : 'none';
    var checkbox = document.getElementById('semTrocoCheckbox');
    if (checkbox && !checkbox.dataset.listenerAdded) {
      checkbox.addEventListener('change', function () {
        var trocoInput = document.getElementById('trocoPara');
        if (!trocoInput) return;
        if (checkbox.checked) { trocoInput.value = ''; trocoInput.disabled = true; }
        else trocoInput.disabled = false;
      });
      checkbox.dataset.listenerAdded = 'true';
    }
  }

  function validarEstoqueAntesFinalizar() {
    var totais = {};
    carrinho.forEach(function (item) {
      if (item.estoque === null || item.estoque === undefined || item.estoque === '') return;
      if (!totais[item.id]) totais[item.id] = { quantidade: 0, nome: item.nome };
      totais[item.id].quantidade += parseInt(item.quantidade, 10) || 0;
    });
    return Promise.all(Object.keys(totais).map(function (id) {
      var totalItem = totais[id];
      return Core.db.collection('lojistas').doc(currentLojistaId).collection('cardapio').doc(id).get().then(function (snap) {
        if (!snap.exists) { var erro = new Error('Produto não encontrado no cardápio.'); erro.estoque = true; throw erro; }
        var dado = snap.data() || {};
        var estoque = parseInt(dado.estoque, 10);
        if (isNaN(estoque) || estoque < 0) { var e1 = new Error('Estoque inválido para ' + totalItem.nome + '.'); e1.estoque = true; throw e1; }
        if (totalItem.quantidade > estoque) { var e2 = new Error('Estoque insuficiente para ' + totalItem.nome + '. Disponível: ' + estoque); e2.estoque = true; throw e2; }
      });
    }));
  }

  function finalizarPedido(estId, nomeEstab) {
    if (enviandoPedido) return;
    if (statusLojaAtual !== 'aberta') { UI.mostrarToast('A loja está fechada ou pausada no momento. Tente novamente mais tarde.'); return; }
    if (carrinho.length === 0) { UI.mostrarToast('Adicione itens ao carrinho.'); return; }
    var nome = document.getElementById('clienteNome').value.trim();
    var tel = document.getElementById('clienteTel').value.trim();
    var end = document.getElementById('clienteEndereco').value.trim();
    var mesa = document.getElementById('mesaInput').value.trim();
    if (!nome || nome.length < 2) { UI.mostrarToast('Por favor, informe seu nome completo.'); return; }
    var telNumerico = tel.replace(/\D/g, '');
    if (!telNumerico || telNumerico.length < 10) { UI.mostrarToast('Telefone inválido. Informe DDD + número.'); return; }
    if (!mesa && !end) { UI.mostrarToast('Informe o número da mesa (escaneie o QR) ou o endereço para entrega.'); return; }
    var formaPagamentoAtual = document.getElementById('formaPagamento').value;
    var trocoInput = document.getElementById('trocoPara');
    var semTrocoCheckbox = document.getElementById('semTrocoCheckbox');
    if (formaPagamentoAtual === 'Dinheiro' && !(semTrocoCheckbox && semTrocoCheckbox.checked)) {
      var trocoValor = trocoInput ? trocoInput.value.trim() : '';
      if (!trocoValor) { UI.mostrarToast('Informe o valor para troco, ou marque "Não preciso de troco".'); return; }
    }
    if (!currentLojistaId) { UI.mostrarToast('Erro: lojista não identificado. Tente reabrir o modal.'); return; }

    var btnFinalizar = document.getElementById('btnFinalizarPedido');
    enviandoPedido = true;
    if (btnFinalizar) { btnFinalizar.disabled = true; btnFinalizar.textContent = 'Enviando...'; }

    EU.salvarDadosClienteLocal(nome, tel, end, mesa);
    var subtotal = carrinho.reduce(function (acc, i) { return acc + i.preco * i.quantidade; }, 0);
    var freteSelect = document.getElementById('selectFrete');
    var frete = freteSelect ? (parseFloat(freteSelect.value) || 0) : 0;
    var total = Math.max(0, subtotal + frete - cupomDesconto);
    var pedidoItens = carrinho.map(function (i) { return { nome: i.nome, quantidade: i.quantidade, precoUnitario: i.preco }; });
    var codigoCurto = Math.random().toString(36).substring(2, 8).toUpperCase();
    var user = Core.getCurrentUser();
    var pedido = {
      estabelecimentoId: estId, estabelecimentoNome: nomeEstab,
      clienteId: user ? user.uid : null, clienteNome: nome, clienteTelefone: telNumerico,
      endereco: end, numeroMesa: mesa || null, itens: pedidoItens,
      subtotal: subtotal, taxaEntrega: frete, total: total,
      formaPagamento: document.getElementById('formaPagamento').value,
      trocoPara: document.getElementById('trocoPara').value,
      observacao: document.getElementById('observacaoPedido').value,
      status: 'pendente', codigoCurto: codigoCurto,
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    };

    validarEstoqueAntesFinalizar().then(function () { return Core.db.collection('pedidos').add(pedido); }).then(function () {
      gerarComprovantePedido(pedido, codigoCurto);
      EU.mostrarPopupConfirmacao({
        titulo: '✅ Pedido Confirmado!',
        mensagem: 'Seu pedido foi enviado com sucesso!',
        codigo: codigoCurto,
        botoes: '<button class="btn-pedido-cta" style="width:auto;" onclick="document.getElementById(\'consultaInput\').value=\'' + Core.jsEscape(codigoCurto) + '\'; document.querySelector(\'#modalPedidoRest .modal-tab[data-tab=\\"acompanhar\\"]\').click(); this.closest(\'.popup-confirmacao\').remove();">🔍 Acompanhar</button>',
        onClose: ''
      });
      var carrinhoParaEstoque = carrinho.slice();
      carrinho = []; cupomDesconto = 0;
      atualizarCarrinhoVisual(); recalcularTotal(); atualizarBadgeCarrinho();
      var updates = carrinhoParaEstoque.map(function (item) {
        if (item.estoque !== null && item.estoque !== undefined && item.estoque !== '') {
          var novoEstoque = Math.max(0, parseInt(item.estoque) - item.quantidade);
          return Core.db.collection('lojistas').doc(currentLojistaId).collection('cardapio').doc(item.id).update({ estoque: novoEstoque.toString() });
        }
        return Promise.resolve();
      });
      Promise.all(updates).catch(function (err) { console.warn('Baixa de estoque não aplicada:', err.message); });
    }).catch(function (err) {
      UI.mostrarToast(err && err.estoque ? err.message : 'Erro ao finalizar pedido: ' + err.message);
    }).finally(function () {
      enviandoPedido = false;
      if (btnFinalizar) { btnFinalizar.disabled = false; btnFinalizar.textContent = 'Confirmar Pedido'; }
    });
  }

  function consultarPedido() {
    var cod = document.getElementById('consultaInput').value.trim().toUpperCase();
    var resDiv = document.getElementById('resultadoAcompanhamento');
    if (!cod) { resDiv.innerHTML = '<p style="color:#dc3545;">Digite o código do pedido.</p>'; return; }
    Core.db.collection('pedidos').where('codigoCurto', '==', cod).limit(1).get().then(function (snap) {
      if (snap.empty) { resDiv.innerHTML = '<p style="color:#dc3545;">🔍 Pedido não encontrado.</p>'; return; }
      var p = snap.docs[0].data();
      var map = { pendente: { label: 'Aguardando Loja', icon: '⏳', color: '#f59e0b' }, confirmado: { label: 'Pedido Confirmado', icon: '✅', color: '#10b981' }, em_preparo: { label: 'Sendo Preparado', icon: '👨‍🍳', color: '#6366f1' }, saiu_entrega: { label: 'Saiu para Entrega', icon: '🛵', color: '#3b82f6' }, concluido: { label: 'Entregue', icon: '🏁', color: '#10b981' }, cancelado: { label: 'Cancelado', icon: '❌', color: '#ef4444' } };
      var s = map[p.status] || map['pendente'];
      resDiv.innerHTML = '<div style="background:' + s.color + '10; border:2px solid ' + s.color + '; border-radius:1rem; padding:1rem;">' +
        '<div style="text-align:center;"><span style="font-size:2rem;" aria-hidden="true">' + s.icon + '</span><h3 style="color:' + s.color + ';">' + s.label + '</h3></div>' +
        '<p><strong>Data:</strong> ' + (p.criadoEm ? new Date(p.criadoEm.toDate()).toLocaleString() : '---') + '</p>' +
        '<p><strong>Total:</strong> R$ ' + p.total.toFixed(2) + '</p>' +
        '<p><strong>Itens:</strong> ' + (p.itens ? p.itens.map(function (i) { return i.quantidade + 'x ' + Core.sanitize(i.nome); }).join(', ') : '') + '</p>' +
        (p.numeroMesa ? '<p><strong>Mesa:</strong> ' + Core.sanitize(p.numeroMesa) + '</p>' : '') +
        '<p><strong>Pagamento:</strong> ' + Core.sanitize(p.formaPagamento) + (p.trocoPara ? ' (Troco para R$ ' + parseFloat(p.trocoPara).toFixed(2) + ')' : '') + '</p></div>';
    });
  }

  var historicoCache = {};
  function verComprovanteHistorico(id) {
    var p = historicoCache[id];
    if (!p) { UI.mostrarToast('Pedido não encontrado.'); return; }
    gerarComprovantePedido(p, p.codigoCurto || id.slice(0, 6).toUpperCase());
  }
  function carregarHistorico(estId) {
    var user = Core.getCurrentUser();
    if (!user) return;
    var container = document.getElementById('listaHistoricoPedido');
    if (!container) return;
    container.innerHTML = '<div class="loading"><div class="spinner" aria-hidden="true"></div><span>Carregando histórico...</span></div>';
    Core.db.collection('pedidos').where('clienteId', '==', user.uid).where('estabelecimentoId', '==', estId).orderBy('criadoEm', 'desc').get().then(function (snap) {
      if (snap.empty) { container.innerHTML = '<p>Nenhum pedido encontrado.</p>'; return; }
      var html = '';
      snap.forEach(function (doc) {
        var p = doc.data();
        historicoCache[doc.id] = p;
        var codigo = p.codigoCurto || doc.id.slice(0, 6).toUpperCase();
        html += '<div style="border:1px solid var(--gray-200); border-radius:0.75rem; padding:0.75rem; margin-bottom:0.5rem; background:white;"><div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;"><div><strong>Pedido #' + Core.sanitize(codigo) + '</strong> <span style="background:' + (p.status === 'pendente' ? '#fff7ed' : p.status === 'concluido' ? '#ecfdf5' : '#f1f5f9') + '; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.7rem;">' + Core.sanitize(p.status || 'pendente') + '</span></div><div>' + (p.criadoEm ? new Date(p.criadoEm.toDate()).toLocaleString() : '---') + '</div></div><div><strong>Total:</strong> R$ ' + p.total.toFixed(2) + '</div><button class="btn-acao btn-qrcode" style="margin-top:0.5rem;" onclick="Economizei.Pedido.verComprovanteHistorico(\'' + doc.id + '\')">🖨️ Ver comprovante</button></div>';
      });
      container.innerHTML = html;
    });
  }

  function mostrarErroNoModal(msg) {
    var container = document.getElementById('produtosContainer');
    if (container) {
      container.innerHTML = '<p style="text-align:center;color:#dc3545;padding:2rem;">⚠️ ' + Core.sanitize(msg) + '</p>';
      container.style.display = 'block';
    }
  }

  function atualizarStatusLojaUI(statusLoja, statusMessage) {
    var msgDiv = document.getElementById('statusLojaMsg');
    var btnFinalizar = document.getElementById('btnFinalizarPedido');
    var bloqueado = (statusLoja === 'fechada' || statusLoja === 'pausada');
    statusLojaAtual = statusLoja;
    if (msgDiv) {
      var mensagem = (statusMessage || '').trim();
      if (bloqueado || mensagem) {
        msgDiv.style.display = 'block';
        var prefixo = statusLoja === 'fechada' ? '🔴 Loja fechada: ' : statusLoja === 'pausada' ? '🟡 Pedidos pausados: ' : '🟢 Aviso da loja: ';
        msgDiv.innerHTML = prefixo + Core.sanitize(mensagem || 'Indisponível no momento.');
        msgDiv.setAttribute('role', 'alert');
      } else msgDiv.style.display = 'none';
    }
    if (btnFinalizar) {
      if (bloqueado) { btnFinalizar.classList.add('disabled'); btnFinalizar.setAttribute('aria-disabled', 'true'); }
      else { btnFinalizar.classList.remove('disabled'); btnFinalizar.removeAttribute('aria-disabled'); }
    }
  }

  function atualizarModalComDados(produtos, fretes) {
    var loading = document.getElementById('loadingPedido');
    if (loading) loading.remove();
    var container = document.getElementById('produtosContainer');
    if (container) { container.style.display = 'block'; container.innerHTML = renderizarProdutos(produtos); }
    var select = document.getElementById('selectFrete');
    if (select && fretes) {
      select.innerHTML = '<option value="">Selecione o frete</option>' + fretes.map(function (f) { return '<option value="' + f.taxa + '">' + Core.sanitize(f.localidade) + ' - R$ ' + f.taxa.toFixed(2) + '</option>'; }).join('') + (fretes.length === 0 ? '<option value="0">Retirada no local - Grátis</option>' : '');
    }
    produtosCache = produtos; fretesCache = fretes;
    atualizarCarrinhoVisual(); recalcularTotal();
    document.querySelectorAll('.qtd-btn-simples').forEach(function (btn) { btn.removeEventListener('click', handleQtdSimplesClick); btn.addEventListener('click', handleQtdSimplesClick); });
    document.querySelectorAll('.btn-adicionar-simples').forEach(function (btn) { btn.removeEventListener('click', handleAdicionarSimples); btn.addEventListener('click', handleAdicionarSimples); });
    var pc = document.getElementById('produtosContainer');
    if (pc) { pc.removeEventListener('click', handleEscolherClickDelegado); pc.addEventListener('click', handleEscolherClickDelegado); }
  }
  function handleEscolherClickDelegado(e) { var btn = e.target.closest('.btn-escolher'); if (!btn) return; handleEscolherClick.call(btn, e); }

  function iniciarListenerPedidos() {
    if (listenerAtivo) return;
    if (unsubscribePedidos) { unsubscribePedidos(); unsubscribePedidos = null; }
    if (!currentEstId) return;
    listenerAtivo = true;
    var query = Core.db.collection('pedidos').where('estabelecimentoId', '==', currentEstId).orderBy('criadoEm', 'desc').limit(50);
    unsubscribePedidos = query.onSnapshot(function (snapshot) {
      var pedidos = [];
      snapshot.forEach(function (doc) { var p = doc.data(); pedidos.push(Object.assign({ id: doc.id }, p)); });
      var resDiv = document.getElementById('resultadoAcompanhamento');
      var tabAcompanhar = document.getElementById('tabAcompanhar');
      if (resDiv && tabAcompanhar && tabAcompanhar.classList.contains('active')) {
        if (pedidos.length > 0) {
          var html = '<div style="max-height:300px;overflow-y:auto;">';
          pedidos.slice(0, 5).forEach(function (p) {
            var codigo = p.codigoCurto || p.id.slice(0, 6).toUpperCase();
            var map = { pendente: '⏳ Pendente', confirmado: '✅ Confirmado', em_preparo: '👨‍🍳 Preparando', saiu_entrega: '🛵 Em entrega', concluido: '🏁 Entregue', cancelado: '❌ Cancelado' };
            var statusText = map[p.status] || p.status || '⏳ Pendente';
            html += '<div style="border-bottom:1px solid #eee;padding:0.4rem 0;font-size:0.8rem;"><strong>#' + Core.sanitize(codigo) + '</strong> - ' + statusText + ' - R$ ' + (p.total || 0).toFixed(2) + (p.numeroMesa ? ' - Mesa ' + Core.sanitize(p.numeroMesa) : '') + '</div>';
          });
          html += '</div>';
          resDiv.innerHTML = html;
        } else resDiv.innerHTML = '';
      }
      var tabHistorico = document.getElementById('tabHistorico');
      if (tabHistorico && tabHistorico.classList.contains('active')) carregarHistorico(currentEstId);
    }, function (error) { console.error('Erro no listener de pedidos:', error); listenerAtivo = false; });
  }

  function pararTodosListeners() {
    if (unsubscribePedidos) { unsubscribePedidos(); unsubscribePedidos = null; }
    if (unsubscribeCardapio) { unsubscribeCardapio(); unsubscribeCardapio = null; }
    if (unsubscribeFretes) { unsubscribeFretes(); unsubscribeFretes = null; }
    if (unsubscribeSabores) { unsubscribeSabores(); unsubscribeSabores = null; }
    if (unsubscribeExtras) { unsubscribeExtras(); unsubscribeExtras = null; }
    if (unsubscribeStatusLoja) { unsubscribeStatusLoja(); unsubscribeStatusLoja = null; }
    listenerAtivo = false;
  }

  function iniciarListenersTempoReal() {
    if (!currentLojistaId || !currentEstId) return;
    pararTodosListeners();
    unsubscribeStatusLoja = Core.db.collection('lojistas').doc(currentLojistaId).onSnapshot(function (doc) {
      if (doc.exists) { var data = doc.data(); atualizarStatusLojaUI(data.statusLoja || 'aberta', data.statusMessage || ''); }
    }, function (err) { console.error('Erro no listener de status da loja:', err); mostrarErroNoModal('Erro ao verificar status da loja: ' + err.message); });
    unsubscribeCardapio = Core.db.collection('lojistas').doc(currentLojistaId).collection('cardapio').onSnapshot(function (snap) {
      var produtos = [];
      snap.forEach(function (doc) {
        var data = doc.data();
        if (data.disponivel !== 'nao') {
          var prod = { id: doc.id, nome: data.nome, preco: parseFloat(data.preco) || 0, imagem: data.imagem || null, descricao: data.descricao || '', estoque: data.estoque !== undefined && data.estoque !== '' ? parseInt(data.estoque) : null, categoria: data.categoria || 'Geral', saboresObrigatorios: data.saboresObrigatorios === true || data.saboresObrigatorios === 'sim' };
          if (data.tipo === 'personalizavel' || (data.tamanhosDisponiveis && data.tamanhosDisponiveis.length > 0)) {
            prod.personalizavel = true; prod.tamanhosDisponiveis = data.tamanhosDisponiveis || [];
            prod.saboresPermitidos = data.saboresPermitidos || []; prod.extrasPermitidos = data.extrasPermitidos || [];
          }
          if (data.tamanhos && Array.isArray(data.tamanhos)) prod.tamanhos = data.tamanhos.map(function (t) { return { nome: t.nome, preco: parseFloat(t.preco) || 0 }; });
          produtos.push(prod);
        }
      });
      produtosCache = produtos;
      atualizarModalComDados(produtosCache, fretesCache);
    }, function (err) { console.error('Erro no listener de cardápio:', err); mostrarErroNoModal('Não foi possível carregar o cardápio: ' + err.message); });
    unsubscribeFretes = Core.db.collection('lojistas').doc(currentLojistaId).collection('fretes').onSnapshot(function (snap) {
      var fretes = [];
      snap.forEach(function (doc) { fretes.push({ localidade: doc.data().localidade, taxa: parseFloat(doc.data().taxa) || 0 }); });
      fretesCache = fretes;
      var select = document.getElementById('selectFrete');
      if (select) select.innerHTML = '<option value="">Selecione o frete</option>' + fretes.map(function (f) { return '<option value="' + f.taxa + '">' + Core.sanitize(f.localidade) + ' - R$ ' + f.taxa.toFixed(2) + '</option>'; }).join('') + (fretes.length === 0 ? '<option value="0">Retirada no local - Grátis</option>' : '');
    }, function (err) { console.error('Erro no listener de fretes:', err); });
    unsubscribeSabores = Core.db.collection('lojistas').doc(currentLojistaId).collection('sabores').onSnapshot(function (snap) {
      saboresGlobais = [];
      snap.forEach(function (doc) { var data = doc.data(); saboresGlobais.push({ id: doc.id, nome: data.nome, descricao: data.descricao || '', precos: data.precos || {}, categorias: data.categorias || '', imagem: data.imagem || '' }); });
    }, function (err) { console.error('Erro no listener de sabores:', err); });
    unsubscribeExtras = Core.db.collection('lojistas').doc(currentLojistaId).collection('extras').onSnapshot(function (snap) {
      extrasGlobais = [];
      snap.forEach(function (doc) { var data = doc.data(); extrasGlobais.push({ id: doc.id, nome: data.nome, preco: parseFloat(data.preco) || 0, descricao: data.descricao || '', max: data.max ? parseInt(data.max) : 0, categorias: data.categorias || '', imagem: data.imagem || '' }); });
    }, function (err) { console.error('Erro no listener de extras:', err); });
  }

  function pararListenerPedidos() { if (unsubscribePedidos) { unsubscribePedidos(); unsubscribePedidos = null; } listenerAtivo = false; }

  function renderizarProdutos(produtos) {
    if (!produtos || produtos.length === 0) return '<p style="text-align:center;padding:2rem;">Nenhum produto disponível.</p>';
    var categorias = {};
    produtos.forEach(function (p) { var cat = p.categoria || 'Geral'; if (!categorias[cat]) categorias[cat] = []; categorias[cat].push(p); });
    var html = '';
    for (var cat in categorias) {
      html += '<div class="categoria-group"><div class="categoria-titulo-modal" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === \'none\' ? \'grid\' : \'none\';" role="button" tabindex="0" aria-expanded="true">' + Core.sanitize(cat) + ' ▼</div><div class="produtos-grid" style="display:grid;">';
      categorias[cat].forEach(function (prod) { html += gerarHTMLProduto(prod); });
      html += '</div></div>';
    }
    return html;
  }

  function gerarHTMLProduto(prod) {
    var isPersonalizavel = prod.personalizavel === true || prod.tipo === 'personalizavel';
    var temTamanhos = prod.tamanhos && Array.isArray(prod.tamanhos) && prod.tamanhos.length > 0;
    var temImagem = prod.imagem && prod.imagem.trim() !== '';
    var precoAtual = temTamanhos ? parseFloat(prod.tamanhos[0].preco) || 0 : parseFloat(prod.preco) || 0;
    var estoqueAtual = (prod.estoque !== null && prod.estoque !== undefined && prod.estoque !== '') ? parseInt(prod.estoque) : null;
    var estoqueInfo = '', botaoDesabilitado = false;
    if (estoqueAtual !== null && !isNaN(estoqueAtual)) {
      estoqueInfo = '<div style="font-size:0.65rem; color:' + (estoqueAtual <= 5 ? '#dc3545' : '#64748b') + ';">Estoque: ' + estoqueAtual + '</div>';
      if (estoqueAtual <= 0) botaoDesabilitado = true;
    }
    var imgHtml = temImagem ? '<img src="' + prod.imagem + '" loading="lazy" onclick="Economizei.Pedido.abrirProdutoPeloCard(\'' + Core.jsEscape(prod.id) + '\')" style="cursor:pointer;" alt="' + Core.sanitize(prod.nome) + '">' : '<div style="width:100%;aspect-ratio:1;background:#f1f5f9;border-radius:0.5rem;display:flex;align-items:center;justify-content:center;" aria-label="Imagem não disponível">📷</div>';
    var buttonsHtml = '';
    if (isPersonalizavel || temTamanhos) {
      buttonsHtml = '<button class="btn-escolher" data-prod-id="' + prod.id + '" data-tipo="' + (isPersonalizavel ? 'personalizavel' : 'tamanhos') + '"' + (botaoDesabilitado ? ' disabled aria-disabled="true"' : '') + '>' + (botaoDesabilitado ? 'Indisponível' : 'Escolher') + '</button>';
    } else {
      buttonsHtml = '<div class="produto-quantidade-simples"><button class="qtd-btn-simples" data-prod-id="' + prod.id + '" data-delta="-1" aria-label="Diminuir quantidade">−</button><input type="number" id="qtd_simples_' + prod.id + '" value="1" min="1" style="width:3rem; text-align:center;" aria-label="Quantidade"><button class="qtd-btn-simples" data-prod-id="' + prod.id + '" data-delta="1" aria-label="Aumentar quantidade">+</button></div><button class="btn-adicionar-simples" data-prod-id="' + prod.id + '" data-preco="' + precoAtual + '"' + (botaoDesabilitado ? ' disabled aria-disabled="true"' : '') + '>' + (botaoDesabilitado ? 'Indisponível' : 'Adicionar') + '</button>';
    }
    return '<div class="produto-card" data-prod-id="' + prod.id + '">' + imgHtml + '<div class="card-content-produto"><div class="produto-nome">' + Core.sanitize(prod.nome) + '</div><div class="produto-preco">' + (estoqueInfo || 'R$ ' + precoAtual.toFixed(2)) + '</div></div>' + buttonsHtml + '</div>';
  }

  function handleEscolherClick(e) {
    var prodId = this.dataset.prodId; var tipo = this.dataset.tipo;
    var produto = produtosCache.find(function (p) { return p.id === prodId; });
    if (!produto) return;
    if (tipo === 'personalizavel') abrirModalCustomizacaoCompleta(produto);
    else if (tipo === 'tamanhos') abrirModalTamanhosExtras(produto);
  }
  function handleQtdSimplesClick(e) {
    var btn = e.currentTarget; var prodId = btn.dataset.prodId; var delta = parseInt(btn.dataset.delta);
    var input = document.getElementById('qtd_simples_' + prodId);
    if (input) input.value = Math.max(1, (parseInt(input.value) || 1) + delta);
  }
  function handleAdicionarSimples(e) {
    var btn = e.currentTarget; var prodId = btn.dataset.prodId;
    var preco = parseFloat(btn.dataset.preco);
    var qtdInput = document.getElementById('qtd_simples_' + prodId);
    var quantidade = qtdInput ? parseInt(qtdInput.value) : 1;
    if (isNaN(quantidade) || quantidade < 1) quantidade = 1;
    var produto = produtosCache.find(function (p) { return p.id === prodId; });
    if (!produto) return;
    if (!validarEstoqueAdicao(produto, quantidade)) return;
    var temExtras = (produto.extrasPermitidos && produto.extrasPermitidos.length > 0) || extrasGlobais.some(function (e) {
      if (!e.categorias || e.categorias === '') return true;
      return e.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(produto.categoria || 'Geral') !== -1;
    });
    if (temExtras) { abrirModalExtrasSimples(produto); }
    else {
      var existing = carrinho.find(function (i) { return i.id === prodId && !i.tamanho; });
      if (existing) existing.quantidade += quantidade;
      else carrinho.push(Object.assign({}, produto, { id: prodId, nome: produto.nome, preco: preco, quantidade: quantidade, tamanho: null }));
      atualizarCarrinhoVisual(); recalcularTotal(); atualizarBadgeCarrinho();
      UI.mostrarToast('Adicionado ao carrinho');
    }
  }

  async function abrirModal(idx) {
    await Cards.dadosProntos;
    var dadosAtualizados = Cards.dadosProcessados;
    var est = dadosAtualizados[idx];
    if (!est) { console.error("Estabelecimento não encontrado:", idx); UI.mostrarToast("Estabelecimento não encontrado."); return; }
    var nome = est[COLUNAS.NOME];
    var estId = est[COLUNAS.ID_UNICO];
    currentEstId = estId;
    carrinho = []; cupomDesconto = 0;
    garantirModalScanner();
    abrirModalPedido(nome, estId, null, null, false);
    Core.db.collection('lojistas').where('estabelecimentoId', '==', estId).limit(1).get()
      .then(function (snap) {
        if (snap.empty) { mostrarErroNoModal('Estabelecimento não configurado para pedidos.'); return; }
        var lojistaDoc = snap.docs[0];
        currentLojistaId = lojistaDoc.id;
        var data = lojistaDoc.data();
        atualizarStatusLojaUI(data.statusLoja || 'aberta', data.statusMessage || '');
        iniciarListenersTempoReal();
      })
      .catch(function (err) { mostrarErroNoModal('Erro ao carregar dados: ' + err.message); });
  }

  function abrirModalPedido(nomeEstab, estId, produtos, fretes, isLoading) {
    var antigo = document.getElementById('modalPedidoRest');
    if (antigo) { pararTodosListeners(); if (antigo.__ctrl) antigo.__ctrl.fechar(); else antigo.remove(); }
    var produtosHtml = isLoading
      ? '<div class="loading" style="padding:2rem;text-align:center;"><div class="spinner" aria-hidden="true"></div><span>Carregando cardápio...</span></div>'
      : '<div id="produtosContainer">' + (produtos ? renderizarProdutos(produtos) : '') + '</div>';
    var nomeEstabSeguro = Core.sanitize(nomeEstab);
    var modalHtml =
      '<div class="modal-overlay" id="modalPedidoRest" role="dialog" aria-modal="true" aria-labelledby="modalPedidoTitulo">' +
        '<div class="modal-conteudo fullscreen">' +
          '<div class="modal-header">' +
            '<h3 id="modalPedidoTitulo">🍽️ ' + nomeEstabSeguro + '</h3>' +
            '<button class="modal-close-btn" data-fechar-modal aria-label="Fechar pedido">×</button>' +
          '</div>' +
          '<div class="modal-tabs">' +
            '<button class="modal-tab active" data-tab="produtos" aria-label="Produtos">📦 Produtos</button>' +
            '<button class="modal-tab" data-tab="carrinho" aria-label="Carrinho">🛒 Carrinho <span class="cart-tab-badge" id="cartBadge" aria-hidden="true">0</span></button>' +
            '<button class="modal-tab" data-tab="acompanhar" aria-label="Acompanhar pedido">🔍 Acompanhar</button>' +
            (Core.getCurrentUser() ? '<button class="modal-tab" data-tab="historico" aria-label="Histórico">📋 Histórico</button>' : '') +
          '</div>' +
          '<div class="modal-body">' +
            '<div id="tabProdutos" class="modal-tab-content active">' +
              '<div id="statusLojaMsg" style="display:none;background:#fef3c7;border:1px solid #f59e0b;border-radius:0.75rem;padding:0.75rem;margin-bottom:0.75rem;text-align:center;font-weight:600;color:#92400e;" role="alert"></div>' +
              produtosHtml +
            '</div>' +
            '<div id="tabCarrinho" class="modal-tab-content">' +
              '<div class="carrinho-layout">' +
                '<div class="carrinho-col-esquerda" id="carrinhoLista"></div>' +
                '<div class="carrinho-col-direita">' +
                  '<strong>Resumo do pedido</strong>' +
                  '<div>Subtotal: R$ <span id="carrinhoSubtotal">0.00</span></div>' +
                  '<select id="selectFrete" class="input-pedido" onchange="Economizei.Pedido.recalcularTotal()" aria-label="Selecione o frete"><option value="">Selecione o frete</option>' + (fretes ? fretes.map(function (f) { return '<option value="' + f.taxa + '">' + Core.sanitize(f.localidade) + ' - R$ ' + f.taxa.toFixed(2) + '</option>'; }).join('') : '') + (fretes && fretes.length === 0 ? '<option value="0">Retirada no local - Grátis</option>' : '') + '</select>' +
                  '<div style="display:flex;gap:0.5rem;margin:0.5rem 0;">' +
                    '<input type="text" id="cupomInput" class="input-pedido" placeholder="Código do cupom" style="margin:0;flex:1;" aria-label="Código do cupom">' +
                    '<button class="btn-aplicar-cupom" onclick="Economizei.Pedido.aplicarCupom()">Aplicar</button>' +
                  '</div>' +
                  '<div id="cupomStatus" style="font-size:0.75rem; margin-bottom:0.5rem;"></div>' +
                  '<div><strong>Total: R$ <span id="totalPedido" class="total-loja">0.00</span></strong></div>' +
                  '<div style="margin:0.75rem 0;"></div>' +
                  '<strong>Pagamento</strong>' +
                  '<select id="formaPagamento" class="input-pedido" onchange="Economizei.Pedido.toggleTroco()" aria-label="Forma de pagamento">' +
                    '<option value="Dinheiro">Dinheiro</option><option value="Cartão na entrega">Cartão na entrega</option><option value="Pix">Pix</option>' +
                  '</select>' +
                  '<div id="trocoParaWrapper" style="display:block;">' +
                    '<input type="number" id="trocoPara" class="input-pedido" placeholder="Troco para quanto?" aria-label="Troco para quanto">' +
                    '<label style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; color:var(--gray-700); margin:-0.3rem 0 0.5rem 0.2rem;">' +
                      '<input type="checkbox" id="semTrocoCheckbox" style="width:auto;"> Não preciso de troco' +
                    '</label>' +
                  '</div>' +
                  '<div class="cliente-info">' +
                    '<input type="text" id="clienteNome" class="input-pedido" placeholder="Seu nome*" value="' + Core.sanitize(Core.getUserDisplayName() || '') + '" aria-label="Seu nome" required>' +
                    '<input type="tel" id="clienteTel" class="input-pedido" placeholder="Telefone*" maxlength="15" aria-label="Telefone" required>' +
                    '<input type="text" id="clienteEndereco" class="input-pedido" placeholder="Endereço completo*" aria-label="Endereço completo">' +
                    '<div style="display:flex; gap:0.5rem; align-items: center;">' +
                      '<input type="text" id="mesaInput" class="input-pedido" placeholder="Número da mesa" style="flex:1; background:#f0f0f0;" readonly disabled aria-label="Número da mesa">' +
                      '<button type="button" class="btn-escanear-mesa" id="btnEscanearMesa" style="margin-bottom:0.75rem;" aria-label="Escanear QR Code da mesa">📷 Escanear Mesa</button>' +
                    '</div>' +
                    '<textarea id="observacaoPedido" rows="2" class="input-pedido" placeholder="Observações (ex: sem cebola, portão azul)" aria-label="Observações do pedido"></textarea>' +
                    '<button class="btn-pedido-cta" id="btnFinalizarPedido" onclick="Economizei.Pedido.finalizarPedido(\'' + Core.jsEscape(estId) + '\',\'' + Core.jsEscape(nomeEstab) + '\')">Confirmar Pedido</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<div id="tabAcompanhar" class="modal-tab-content">' +
              '<input type="text" id="consultaInput" class="input-pedido" placeholder="Código do pedido" aria-label="Código do pedido">' +
              '<div style="display:flex; gap:0.5rem;">' +
                '<button class="btn-consultar-pedido" onclick="Economizei.Pedido.consultarPedido()" style="flex:1;">Consultar</button>' +
                '<button class="btn-limpar-historico" onclick="document.getElementById(\'consultaInput\').value=\'\'; document.getElementById(\'resultadoAcompanhamento\').innerHTML=\'\';">Limpar</button>' +
              '</div>' +
              '<div id="resultadoAcompanhamento" style="margin-top:1rem;" aria-live="polite"></div>' +
            '</div>' +
            (Core.getCurrentUser() ? '<div id="tabHistorico" class="modal-tab-content"><div id="listaHistoricoPedido"></div></div>' : '') +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    var modalEl = document.getElementById('modalPedidoRest');
    _abrirModalLocal(modalEl);
    var scanBtn = document.getElementById('btnEscanearMesa');
    if (scanBtn && UI.iniciarScanner) scanBtn.addEventListener('click', function () {
      var sc = document.getElementById('modalScanner');
      if (sc) { _abrirModalLocal(sc); UI.iniciarScanner(); }
      else { UI.mostrarToast('Scanner de QR não disponível nesta página.'); }
    });
    document.querySelectorAll('#modalPedidoRest .modal-tab').forEach(function (tab) {
      tab.onclick = function () {
        document.querySelectorAll('#modalPedidoRest .modal-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelectorAll('#modalPedidoRest .modal-tab-content').forEach(function (c) { c.classList.remove('active'); });
        var contentId = 'tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
        var contentEl = document.getElementById(contentId);
        if (contentEl) contentEl.classList.add('active');
        if (tab.dataset.tab === 'historico' && Core.getCurrentUser()) carregarHistorico(estId);
      };
    });
    if (!isLoading && produtos) { atualizarCarrinhoVisual(); recalcularTotal(); }
    toggleTroco();
    var saved = EU.carregarDadosClienteLocal();
    if (saved) {
      if (saved.nome) document.getElementById('clienteNome').value = saved.nome;
      if (saved.telefone) document.getElementById('clienteTel').value = saved.telefone;
      if (saved.endereco) document.getElementById('clienteEndereco').value = saved.endereco;
    }
    EU.aplicarMascaraTelefone(document.getElementById('clienteTel'));
    var mesaAtual = getMesaQR();
    if (mesaAtual) {
      var mesaField = document.getElementById('mesaInput');
      if (mesaField && !mesaField.value) { mesaField.value = mesaAtual; mesaField.readOnly = true; mesaField.disabled = true; mesaField.style.backgroundColor = '#f0f0f0'; }
    }
  }

  function fecharModalPedido() {
    pararTodosListeners();
    var modal = document.getElementById('modalPedidoRest');
    if (modal) {
      if (modal.__ctrl) modal.__ctrl.fechar();
      else modal.remove();
    }
  }

  return {
    abrirModal: abrirModal,
    abrirImagemProduto: abrirImagemProduto,
    abrirProdutoPeloCard: abrirProdutoPeloCard,
    atualizarCarrinhoVisual: atualizarCarrinhoVisual,
    alterarQuantidade: alterarQuantidade,
    removerItem: removerItem,
    atualizarBadgeCarrinho: atualizarBadgeCarrinho,
    recalcularTotal: recalcularTotal,
    aplicarCupom: aplicarCupom,
    toggleTroco: toggleTroco,
    finalizarPedido: finalizarPedido,
    consultarPedido: consultarPedido,
    gerarComprovantePedido: gerarComprovantePedido,
    mostrarPopupConfirmacao: EU.mostrarPopupConfirmacao,
    validarCupom: validarCupom,
    fecharModalPedido: fecharModalPedido,
    pararListenerPedidos: pararListenerPedidos,
    getMesaQR: getMesaQR,
    setMesaQR: setMesaQR,
    verComprovanteHistorico: verComprovanteHistorico
  };
})();
