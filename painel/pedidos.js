(function () {
'use strict';

var EU = window.EconomizeiUtils;
var FB = window.EconomizeiFirebase;
var Loj = window.Economizei.Lojista;
var Shell = window.Economizei.Painel.Shell;
var Auth = window.Economizei.Painel.Auth;
var db = FB.db;

var CLOUDINARY_CLOUD_NAME = 'dq7fz5whe';
var CLOUDINARY_UPLOAD_PRESET = 'economizei_preset';
var PREFIXOS_PEDIDOS = Loj.PREFIXOS.pedidos;

var emailAtual = '';
var estId = '';
var unsubscribePedidos = null;
var pedidosVistos = null;
var pedidosAtuais = [];
var rankingVendas = [];
var saboresGlobais = [];
var extrasGlobais = [];
var imagensExtrasUrls = [];
var previewVariacoesSelecionadas = {};
var produtoEmEdicao = null;
var promocoesCache = [];
var fretesCache = [];
var produtosPromocaoCache = [];
var promocaoProdutosSelecionados = [];
var promocaoVariacoesSelecionadas = [];
var promocaoEmEdicao = null;
var cupomEmEdicao = null;

/* ============================================================
   CLOUDINARY / UPLOAD
   ============================================================ */
async function enviarImagemCloudinary(file) {
  var fd = new FormData();
  fd.append('file', file);
  fd.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  var res = await fetch('https://api.cloudinary.com/v1_1/' + CLOUDINARY_CLOUD_NAME + '/image/upload', { method: 'POST', body: fd });
  var data = await res.json();
  if (!res.ok || !data.secure_url) throw new Error((data.error && data.error.message) || 'Falha no upload.');
  return data.secure_url;
}
async function uploadImagem(file, campoUrl, previewId) {
  if (!file) return;
  EU.showLoading('Enviando imagem...');
  try {
    var url = await enviarImagemCloudinary(file);
    document.getElementById(campoUrl).value = url;
    var preview = document.getElementById(previewId);
    if (preview) preview.innerHTML = '<img src="' + url + '" class="preview-imagem" alt="">';
    EU.mostrarToast('Imagem enviada!', 'sucesso');
  } catch (e) { EU.mostrarToast('Erro ao enviar imagem: ' + e.message, 'erro'); }
  finally { EU.hideLoading(); }
}
function uploadImagemSabor(input) { if (input.files && input.files[0]) uploadImagem(input.files[0], 'novoSaborImagem', 'previewSaborImagem'); }
function uploadImagemExtra(input) { if (input.files && input.files[0]) uploadImagem(input.files[0], 'novoExtraImagem', 'previewExtraImagem'); }

async function uploadImagensProduto(input) {
  var files = Array.from(input.files || []);
  if (!files.length) return;
  EU.showLoading(files.length > 1 ? 'Enviando imagens...' : 'Enviando imagem...');
  try {
    var urls = [];
    for (var i = 0; i < files.length; i++) urls.push(await enviarImagemCloudinary(files[i]));
    var principal = document.getElementById('novoItemImagem');
    if (!principal.value.trim() && urls.length) principal.value = urls.shift();
    imagensExtrasUrls.push.apply(imagensExtrasUrls, urls);
    atualizarPreviewImagensExtras();
    atualizarPreviewProdutoLoja();
    EU.mostrarToast(files.length > 1 ? 'Imagens adicionadas!' : 'Imagem adicionada!', 'sucesso');
  } catch (e) { EU.mostrarToast('Erro ao enviar imagem: ' + e.message, 'erro'); }
  finally { EU.hideLoading(); }
}

/* ============================================================
   IMAGENS DO PRODUTO
   ============================================================ */
function obterImagensProduto() {
  var principal = (document.getElementById('novoItemImagem') && document.getElementById('novoItemImagem').value || '').trim();
  var todas = [principal].concat(imagensExtrasUrls).filter(Boolean);
  var unicas = [];
  todas.forEach(function (u) { if (unicas.indexOf(u) === -1) unicas.push(u); });
  return unicas;
}
function atualizarPreviewImagensExtras() {
  var container = document.getElementById('previewImagensProduto');
  if (!container) return;
  var imagens = obterImagensProduto();
  container.innerHTML = imagens.map(function (url, idx) {
    return '<div class="imagem-produto-preview-item">' +
      '<img src="' + url + '" alt="Imagem ' + (idx + 1) + ' do produto">' +
      '<span class="imagem-produto-badge">' + (idx === 0 ? 'Principal' : 'Imagem ' + (idx + 1)) + '</span>' +
      '<button type="button" class="btn-remover-imagem" onclick="removerImagemExtra(' + idx + ')" aria-label="Remover imagem">×</button>' +
    '</div>';
  }).join('');
  var hidden = document.getElementById('novoItemImagens');
  if (hidden) hidden.value = imagens.join(',');
}
function removerImagemExtra(idx) {
  var imagens = obterImagensProduto();
  imagens.splice(idx, 1);
  var principal = document.getElementById('novoItemImagem');
  if (principal) principal.value = imagens.shift() || '';
  imagensExtrasUrls = imagens;
  atualizarPreviewImagensExtras();
  atualizarPreviewProdutoLoja();
}

/* ============================================================
   PEDIDOS (tempo real)
   ============================================================ */
function atualizarBadgePendentes() {
  var pendentes = pedidosAtuais.filter(function (p) { return p.status === 'pendente'; }).length;
  var badge = document.getElementById('badgePendentes');
  if (pendentes > 0) { badge.textContent = pendentes; badge.style.display = 'inline-block'; }
  else badge.style.display = 'none';
}
function carregarPedidos() {
  if (unsubscribePedidos) unsubscribePedidos();
  pedidosVistos = null;
  var periodo = document.getElementById('periodoSelect').value;
  var inicio = new Date(); inicio.setHours(0, 0, 0, 0);
  if (periodo === '7dias') inicio.setDate(inicio.getDate() - 7);
  else if (periodo === 'mes') inicio.setDate(1);
  var query = db.collection('pedidos')
    .where('estabelecimentoId', '==', estId)
    .where('criadoEm', '>=', firebase.firestore.Timestamp.fromDate(inicio))
    .orderBy('criadoEm', 'desc').limit(300);
  unsubscribePedidos = query.onSnapshot(function (snap) {
    var pedidosArray = []; var faturamento = 0; var contagem = {};
    snap.forEach(function (doc) {
      var p = doc.data();
      pedidosArray.push(Object.assign({ id: doc.id }, p));
      faturamento += p.total || 0;
      if (p.itens) p.itens.forEach(function (it) { contagem[it.nome] = (contagem[it.nome] || 0) + (it.quantidade || 1); });
    });
    pedidosArray.sort(function (a, b) {
      return (b.criadoEm && b.criadoEm.toDate ? b.criadoEm.toDate().getTime() : 0) - (a.criadoEm && a.criadoEm.toDate ? a.criadoEm.toDate().getTime() : 0);
    });
    if (pedidosVistos === null) {
      pedidosVistos = {};
      pedidosArray.forEach(function (p) { pedidosVistos[p.id] = true; });
    } else {
      var novos = [];
      pedidosArray.forEach(function (p) {
        if (!pedidosVistos[p.id]) { pedidosVistos[p.id] = true; novos.push(p); }
      });
      novos.reverse().forEach(function (p) { notificarNovoPedido(p); });
    }
    pedidosAtuais = pedidosArray;
    rankingVendas = Object.keys(contagem).map(function (k) { return [k, contagem[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
    renderizarPedidos(pedidosArray);
    document.getElementById('totalPedidos').textContent = pedidosArray.length;
    document.getElementById('faturamentoTotal').textContent = 'R$ ' + faturamento.toFixed(2);
    document.getElementById('ticketMedio').textContent = 'R$ ' + (pedidosArray.length ? (faturamento / pedidosArray.length).toFixed(2) : '0.00');
    atualizarBadgePendentes();
  });
}
function renderizarPedidos(pedidos) {
  var container = document.getElementById('listaPedidos');
  var statusFiltro = document.getElementById('statusFiltroSelect').value;
  var tipoFiltro = document.getElementById('tipoPedidoFiltro').value;
  var filtered = pedidos;
  if (statusFiltro) filtered = filtered.filter(function (p) { return p.status === statusFiltro; });
  if (tipoFiltro === 'presencial') filtered = filtered.filter(function (p) { return p.numeroMesa; });
  else if (tipoFiltro === 'delivery') filtered = filtered.filter(function (p) { return !p.numeroMesa; });
  if (filtered.length === 0) { container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:60px;">Nenhum pedido encontrado.</div>'; return; }
  container.innerHTML = filtered.map(function (p) {
    var dataHora = p.criadoEm ? p.criadoEm.toDate().toLocaleString('pt-BR') : '--';
    var isPresencial = !!p.numeroMesa;
    var cupomHtml = p.cupomCodigo ? '<div class="linha"><span>Cupom (' + EU.sanitize(p.cupomCodigo) + ')</span><span>- R$ ' + (p.descontoAplicado || 0).toFixed(2) + '</span></div>' : '';
    var statusClass = p.status || 'pendente';
    var itensHtml = p.itens ? p.itens.map(function (i) {
      return '<div class="item-linha"><span>' + i.quantidade + 'x ' + EU.sanitize(i.nome) + '</span><span>R$ ' + (i.precoUnitario * i.quantidade).toFixed(2) + '</span></div>' + (i.observacao ? '<div class="item-obs">Obs: ' + EU.sanitize(i.observacao) + '</div>' : '');
    }).join('') : 'Nenhum item';
    return '<div class="pedido-card status-' + statusClass + '" data-id="' + p.id + '">' +
      '<div class="pedido-header"><div class="pedido-id">Pedido #' + EU.sanitize(p.codigoCurto || p.id.slice(0, 6).toUpperCase()) + '</div><div class="pedido-data">' + dataHora + '</div></div>' +
      '<select class="status-select status-' + statusClass + '" onchange="atualizarStatus(\'' + p.id + '\', this.value)" aria-label="Alterar status do pedido">' +
        '<option value="pendente"' + (p.status==='pendente'?' selected':'') + '>Pendente</option>' +
        '<option value="confirmado"' + (p.status==='confirmado'?' selected':'') + '>Confirmado</option>' +
        '<option value="em_preparo"' + (p.status==='em_preparo'?' selected':'') + '>Em Preparo</option>' +
        '<option value="saiu_entrega"' + (p.status==='saiu_entrega'?' selected':'') + '>Saiu para Entrega</option>' +
        '<option value="concluido"' + (p.status==='concluido'?' selected':'') + '>Concluído</option>' +
        '<option value="cancelado"' + (p.status==='cancelado'?' selected':'') + '>Cancelado</option>' +
      '</select>' +
      '<div class="pedido-corpo"><div class="cliente-info"><div class="cliente-nome">Nome: ' + (EU.sanitize(p.clienteNome) || 'Cliente') + '</div><div class="cliente-contato">Telefone: ' + (EU.sanitize(p.clienteTelefone) || 'Não informado') + '</div><div class="cliente-contato">' + (isPresencial ? 'Mesa: ' + EU.sanitize(p.numeroMesa) : 'Endereço: ' + (EU.sanitize(p.endereco) || 'Não informado')) + '</div></div><div class="itens-lista"><strong>Itens:</strong>' + itensHtml + '</div>' + (p.observacao ? '<div style="margin-bottom:6px;"><strong>Observação:</strong> ' + EU.sanitize(p.observacao) + '</div>' : '') + '<div class="info-pagamento"><div class="linha"><span>Subtotal</span><span>R$ ' + (p.subtotal || 0).toFixed(2) + '</span></div><div class="linha"><span>Taxa de entrega</span><span>R$ ' + (p.taxaEntrega || 0).toFixed(2) + '</span></div>' + cupomHtml + '<div class="total"><span>Total</span><span>R$ ' + (p.total || 0).toFixed(2) + '</span></div><div class="linha"><span>Pagamento:</span><span>' + (EU.sanitize(p.formaPagamento) || '') + (p.trocoPara ? ' (Troco para R$ ' + parseFloat(p.trocoPara).toFixed(2) + ')' : '') + '</span></div></div></div>' +
      '<div class="pedido-acoes">' +
        '<button class="btn-acao-pedido" onclick="imprimirTicket(\'' + p.id + '\')">Ticket</button>' +
        '<button class="btn-acao-pedido btn-falar-cliente" onclick="falarComCliente(\'' + p.id + '\')">WhatsApp</button>' +
        '<button class="btn-acao-pedido" onclick="compartilharMotoboy(\'' + p.id + '\')">Motoboy</button>' +
        '<button class="btn-acao-pedido" style="color:#dc2626;" onclick="excluirPedido(\'' + p.id + '\')">Excluir</button>' +
      '</div></div>';
  }).join('');
}
async function atualizarStatus(id, novoStatus) {
  EU.showLoading('Atualizando...');
  try {
    await db.collection('pedidos').doc(id).update({ status: novoStatus });
    var cod = '#' + (id.slice(0, 6).toUpperCase());
    EU.mostrarToast('Pedido ' + cod + ' agora está ' + novoStatus + '.', 'sucesso');
  } catch (e) { EU.mostrarToast(e.message, 'erro'); }
  finally { EU.hideLoading(); }
}
async function excluirPedido(id) {
  var cod = '#' + id.slice(0, 6).toUpperCase();
  if (!confirm('Excluir o pedido ' + cod + '? Essa ação não pode ser desfeita.')) return;
  EU.showLoading('Excluindo...');
  try { await db.collection('pedidos').doc(id).delete(); EU.mostrarToast('Pedido ' + cod + ' excluído.', 'sucesso'); }
  catch (e) { EU.mostrarToast(e.message, 'erro'); }
  finally { EU.hideLoading(); }
}
async function imprimirTicket(id) {
  var doc = await db.collection('pedidos').doc(id).get(); if (!doc.exists) return;
  var p = doc.data();
  var conteudo = '<!DOCTYPE html><html><head><title>Ticket</title><style>body{font-family:monospace;width:80mm;margin:0 auto;padding:10px;}</style></head><body><div style="text-align:center"><h3>' + EU.sanitize(p.estabelecimentoNome) + '</h3>Pedido: ' + EU.sanitize(p.codigoCurto || id.slice(0, 6)) + '<br>' + new Date(p.criadoEm && p.criadoEm.toDate ? p.criadoEm.toDate() : Date.now()).toLocaleString() + '</div><hr><div><strong>Cliente:</strong> ' + EU.sanitize(p.clienteNome) + '<br><strong>Tel:</strong> ' + EU.sanitize(p.clienteTelefone) + '<br><strong>End:</strong> ' + EU.sanitize(p.endereco) + (p.numeroMesa ? '<br>Mesa: ' + EU.sanitize(p.numeroMesa) : '') + '</div><hr><table width="100%"><tr><th align="left">Item</th><th>Qtd</th><th align="right">Preço</th></tr>' + (p.itens ? p.itens.map(function (i) { return '<tr><td>' + EU.sanitize(i.nome) + '</td><td align="center">' + i.quantidade + '</td><td align="right">R$ ' + (i.precoUnitario * i.quantidade).toFixed(2) + '</td>'; }).join('') : '') + '</table><hr><div>Subtotal: R$ ' + (p.subtotal || 0).toFixed(2) + '<br>Frete: R$ ' + (p.taxaEntrega || 0).toFixed(2) + '<br>' + (p.cupomCodigo ? 'Cupom: ' + EU.sanitize(p.cupomCodigo) + ' - Desc: R$ ' + (p.descontoAplicado || 0).toFixed(2) + '<br>' : '') + '<strong>Total: R$ ' + (p.total || 0).toFixed(2) + '</strong></div><hr><div>Pagamento: ' + EU.sanitize(p.formaPagamento) + '</div><div>Obs: ' + (EU.sanitize(p.observacao) || '-') + '</div><hr><div style="text-align:center">Obrigado!</div></body></html>';
  EU.abrirJanelaHTML(conteudo);
}
async function falarComCliente(id) {
  try {
    var doc = await db.collection('pedidos').doc(id).get();
    if (!doc.exists) { EU.mostrarToast('Pedido não encontrado.', 'erro'); return; }
    var p = doc.data();
    var telefone = EU.formatarWhatsapp(p.clienteTelefone || '');
    if (!telefone) { EU.mostrarToast('Este pedido não possui telefone válido cadastrado.', 'erro'); return; }
    var codigo = p.codigoCurto || id.slice(0, 6).toUpperCase();
    var mensagem = 'Olá, ' + (p.clienteNome || 'tudo bem') + '! Aqui é da ' + (p.estabelecimentoNome || 'loja') + '. Estou falando sobre o pedido #' + codigo + '.';
    window.open('https://wa.me/' + telefone + '?text=' + encodeURIComponent(mensagem), '_blank', 'noopener,noreferrer');
  } catch (e) { EU.mostrarToast('Não foi possível abrir o WhatsApp: ' + e.message, 'erro'); }
}
async function compartilharMotoboy(id) {
  var doc = await db.collection('pedidos').doc(id).get(); if (!doc.exists) return;
  var p = doc.data();
  var token = (window.crypto && crypto.randomUUID) ? crypto.randomUUID().replace(/-/g, '') : (Date.now().toString(36) + Math.random().toString(36).slice(2));
  await db.collection('tokensMotoboy').doc(token).set({ pedidoId: id, expiraEm: Date.now() + 24 * 60 * 60 * 1000, dadosEntrega: { clienteNome: p.clienteNome, clienteTelefone: p.clienteTelefone, endereco: p.endereco, observacao: p.observacao, estabelecimentoNome: p.estabelecimentoNome } });
  var link = window.location.origin + '/p/entregador.html?token=' + encodeURIComponent(token);
  await navigator.clipboard.writeText(link);
  if (confirm('Link copiado! Deseja abrir o WhatsApp para enviar ao motoboy?')) window.open('https://wa.me/' + EU.formatarWhatsapp(p.clienteTelefone) + '?text=' + encodeURIComponent('Olá! Link da entrega: ' + link), '_blank');
}
function notificarNovoPedido(p) {
  Shell.mostrarPopupNovo({
    titulo: '🛎️ NOVO PEDIDO!',
    codigo: 'Pedido #' + (p.codigoCurto || p.id.slice(0, 6)),
    valor: 'Total: R$ ' + (p.total || 0).toFixed(2),
    cliente: 'Cliente: ' + p.clienteNome,
    textoBotao: 'Ver Pedido'
  });
}

/* ============================================================
   PREVIEW FRONTEND
   ============================================================ */
function escaparPreviewLoja(v) { return EU.sanitize(v); }
function urlPreviewLoja(valor) {
  var url = String(valor || '').trim();
  if (!url) return '';
  try { var p = new URL(url, window.location.href); return (p.protocol === 'http:' || p.protocol === 'https:') ? p.href : ''; }
  catch (e) { return ''; }
}
function obterTiposPreviewLoja() {
  var tipo = (document.getElementById('tipoProduto') || {}).value || 'simples';
  if (tipo === 'tamanhos') return ['Tamanho'];
  if (tipo === 'personalizavel') {
    var tipos = [];
    if (document.querySelectorAll('#listaTamanhosPerso tr').length) {
      var temTam = Array.from(document.querySelectorAll('#listaTamanhosPerso tr')).some(function (tr) {
        var inp = tr.querySelector('.tam-perso-nome'); return inp && inp.value.trim();
      });
      if (temTam) tipos.push('Tamanho');
    }
    if (saboresGlobais.length) tipos.push('Sabor');
    return tipos;
  }
  return [];
}
function obterOpcoesPreviewLoja(tipo) {
  var tipoProduto = (document.getElementById('tipoProduto') || {}).value || 'simples';
  if (tipoProduto === 'tamanhos') {
    return Array.from(document.querySelectorAll('#listaTamanhosAdicionar tr')).map(function (tr) {
      var n = tr.querySelector('.tam-nome'); return n && n.value.trim();
    }).filter(Boolean);
  }
  if (tipoProduto === 'personalizavel') {
    if (tipo === 'Tamanho') {
      return Array.from(document.querySelectorAll('#listaTamanhosPerso tr')).map(function (tr) {
        var n = tr.querySelector('.tam-perso-nome'); return n && n.value.trim();
      }).filter(Boolean);
    }
    if (tipo === 'Sabor') {
      return saboresGlobais.map(function (s) { return s.nome; });
    }
  }
  return [];
}
function sincronizarSelecaoPreviewLoja(tipos) {
  tipos.forEach(function (tipo) {
    var opcoes = obterOpcoesPreviewLoja(tipo);
    if (!opcoes.length) return;
    if (opcoes.indexOf(previewVariacoesSelecionadas[tipo]) === -1) previewVariacoesSelecionadas[tipo] = opcoes[0];
  });
  Object.keys(previewVariacoesSelecionadas).forEach(function (tipo) {
    if (tipos.indexOf(tipo) === -1) delete previewVariacoesSelecionadas[tipo];
  });
}
function precoDaSelecaoAtual() {
  var tipoProduto = (document.getElementById('tipoProduto') || {}).value || 'simples';
  if (tipoProduto === 'simples') {
    var p = parseFloat((document.getElementById('novoItemPreco') || {}).value);
    return isNaN(p) ? null : p;
  }
  if (tipoProduto === 'tamanhos') {
    var tamSel = previewVariacoesSelecionadas['Tamanho'];
    var tr = Array.from(document.querySelectorAll('#listaTamanhosAdicionar tr')).find(function (row) {
      var n = row.querySelector('.tam-nome'); return n && n.value.trim() === tamSel;
    });
    if (!tr) return null;
    var precoInput = tr.querySelector('.tam-preco');
    var preco = precoInput ? parseFloat(precoInput.value) : NaN;
    return isNaN(preco) ? null : preco;
  }
  if (tipoProduto === 'personalizavel') {
    var base = parseFloat((document.getElementById('novoItemPreco') || {}).value);
    var tamSelP = previewVariacoesSelecionadas['Tamanho'];
    if (tamSelP) {
      var trP = Array.from(document.querySelectorAll('#listaTamanhosPerso tr')).find(function (row) {
        var n = row.querySelector('.tam-perso-nome'); return n && n.value.trim() === tamSelP;
      });
      if (trP) {
        var precoTam = parseFloat(trP.querySelector('.tam-perso-preco') ? trP.querySelector('.tam-perso-preco').value : '');
        if (!isNaN(precoTam)) return precoTam;
      }
    }
    return isNaN(base) ? null : base;
  }
  return null;
}
function selecionarOpcaoPreviewLoja(tipo, opcao) {
  previewVariacoesSelecionadas[tipo] = opcao;
  atualizarPreviewProdutoLoja();
}
function renderizarOpcoesPreviewLoja(tipos) {
  var container = document.getElementById('previewProdutoVariacoesLoja');
  if (!container) return;
  if (!tipos.length) {
    container.innerHTML = '<div class="preview-frontend-config-vazio">As opções do produto aparecerão aqui depois de você configurar os tamanhos ou sabores.</div>';
    return;
  }
  var opcoesHtml = tipos.map(function (tipo) {
    var opcoes = obterOpcoesPreviewLoja(tipo);
    if (!opcoes.length) return '';
    return '<div class="preview-frontend-tipo"><strong>' + escaparPreviewLoja(tipo) + '</strong><div class="preview-frontend-opcoes">' +
      opcoes.map(function (opcao) {
        return '<button type="button" class="preview-frontend-opcao ' + (String(previewVariacoesSelecionadas[tipo]) === String(opcao) ? 'ativo' : '') + '" data-preview-tipo="' + escaparPreviewLoja(tipo) + '" data-preview-opcao="' + escaparPreviewLoja(opcao) + '">' + escaparPreviewLoja(opcao) + '</button>';
      }).join('') +
    '</div></div>';
  }).join('');
  var combinacao = tipos.map(function (tipo) { return tipo + ': ' + previewVariacoesSelecionadas[tipo]; }).join(' · ');
  container.innerHTML = '<div class="preview-frontend-config-titulo">Escolha as opções</div>' +
    '<p class="preview-frontend-config-ajuda">Esta prévia usa as mesmas opções que o cliente verá no produto.</p>' +
    opcoesHtml +
    '<div class="preview-frontend-selecao"><strong>Prévia selecionada:</strong> ' + escaparPreviewLoja(combinacao || 'Selecione uma opção') + '</div>';
  container.querySelectorAll('[data-preview-tipo][data-preview-opcao]').forEach(function (b) {
    b.addEventListener('click', function () { selecionarOpcaoPreviewLoja(b.dataset.previewTipo, b.dataset.previewOpcao); });
  });
}
function atualizarPreviewProdutoLoja() {
  var nomeEl = document.getElementById('novoItemNome');
  var tipoEl = document.getElementById('tipoProduto');
  var nomePrev = document.getElementById('previewProdutoNomeLoja');
  var precoPrev = document.getElementById('previewProdutoPrecoLoja');
  var imgPrev = document.getElementById('previewProdutoImgLoja');
  if (!nomeEl || !tipoEl || !nomePrev || !precoPrev || !imgPrev) return;
  var nome = nomeEl.value.trim();
  var imagens = obterImagensProduto();
  var img = imagens[0] || '';
  nomePrev.textContent = nome || 'Nome do produto';
  var tipos = obterTiposPreviewLoja();
  sincronizarSelecaoPreviewLoja(tipos);
  renderizarOpcoesPreviewLoja(tipos);
  var preco = precoDaSelecaoAtual();
  precoPrev.innerHTML = (preco !== null && preco >= 0) ? 'R$ ' + preco.toFixed(2).replace('.', ',') : '<span class="preview-frontend-sem-preco">Informe o preço</span>';
  var imgSeg = urlPreviewLoja(img);
  imgPrev.innerHTML = imgSeg ? '<img src="' + escaparPreviewLoja(imgSeg) + '" alt="Imagem de ' + escaparPreviewLoja(nome || 'produto') + '" onerror="this.style.display=\'none\'">' : '<i class="fas fa-image" aria-hidden="true"></i>';
}

/* ============================================================
   TIPO DE PRODUTO / FORM PRODUTO
   ============================================================ */
function selecionarTipoProduto(tipo) {
  var campo = document.getElementById('tipoProduto');
  if (!campo) return;
  campo.value = tipo;
  toggleTipoProduto();
  atualizarPreviewProdutoLoja();
}
async function toggleTipoProduto() {
  var tipo = document.getElementById('tipoProduto').value;
  document.getElementById('campoProdutoSimples').style.display = tipo === 'simples' ? 'block' : 'none';
  document.getElementById('campoTamanhos').style.display = tipo === 'tamanhos' ? 'block' : 'none';
  document.getElementById('campoPersonalizavel').style.display = tipo === 'personalizavel' ? 'block' : 'none';
  document.querySelectorAll('#tipoProdutoCards .tipo-card').forEach(function (c) {
    var ativo = c.dataset.tipo === tipo;
    c.classList.toggle('selected', ativo);
    c.setAttribute('aria-checked', ativo ? 'true' : 'false');
  });
  var erroSabores = document.getElementById('erroItemSabores'); if (erroSabores) erroSabores.style.display = 'none';
  if (tipo === 'tamanhos') { await carregarExtrasCheckboxes('tamanhos'); }
  else if (tipo === 'personalizavel') {
    var categoria = document.getElementById('novoItemCategoria').value.trim();
    await carregarSaboresCheckboxes(categoria);
    await carregarExtrasCheckboxes('personalizavel', categoria);
    verificarAvisoSemSabores();
  }
  atualizarPreviewProdutoLoja();
}
function verificarAvisoSemSabores() { var a = document.getElementById('avisoSemSabores'); if (a) a.style.display = saboresGlobais.length === 0 ? 'flex' : 'none'; }
function irParaCadastroSabor() { fecharModalCadastro('modalProduto'); limparFormularioProdutoCadastro(); abrirModalSaborCadastro(); }
function toggleEstoqueIlimitado(checkbox, inputId) {
  var input = document.getElementById(inputId); if (!input) return;
  if (checkbox.checked) { input.value = ''; input.disabled = true; input.placeholder = 'Ilimitado'; }
  else { input.disabled = false; input.placeholder = 'Ex: 20'; input.focus(); }
}
async function atualizarCheckboxesPorCategoria() {
  var categoria = document.getElementById('novoItemCategoria').value.trim();
  var tipo = document.getElementById('tipoProduto').value;
  if (tipo === 'personalizavel') { await carregarSaboresCheckboxes(categoria); await carregarExtrasCheckboxes('personalizavel', categoria); verificarAvisoSemSabores(); }
  else if (tipo === 'tamanhos') { await carregarExtrasCheckboxes('tamanhos', categoria); }
}
function inicializarAutoAddLinha(tbodyId, addFn) {
  var tbody = document.getElementById(tbodyId); if (!tbody) return;
  tbody.addEventListener('input', function (e) {
    var tr = e.target.closest('tr'); if (!tr || tr !== tbody.lastElementChild) return;
    var preenchido = Array.from(tr.querySelectorAll('input')).some(function (i) { return i.value.trim() !== ''; });
    if (preenchido) addFn();
  });
}
function adicionarLinhaTamanho(tbodyId) {
  var tbody = document.getElementById(tbodyId); if (!tbody) return;
  var tr = document.createElement('tr');
  if (tbodyId === 'listaTamanhosPerso') tr.innerHTML = '<td><input type="text" placeholder="Ex: Pequeno" class="tam-perso-nome"></td><td><input type="number" placeholder="1" class="tam-perso-max" value="1"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td>';
  else tr.innerHTML = '<td><input type="text" placeholder="Ex: P" class="tam-nome"></td><td><input type="number" step="0.01" placeholder="0.00" class="tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td>';
  tbody.appendChild(tr);
}
function adicionarLinhaPrecoSabor() {
  var tbody = document.getElementById('listaPrecosSabor'); if (!tbody) return;
  var tr = document.createElement('tr');
  tr.innerHTML = '<td><input type="text" placeholder="Ex: G" class="sabor-tam-nome"></td><td><input type="number" step="0.01" placeholder="0.00" class="sabor-tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td>';
  tbody.appendChild(tr);
}
function removerLinhaTamanho(btn) {
  var tr = btn.closest('tr');
  if (tr && tr.parentElement.children.length > 1) { tr.remove(); atualizarPreviewProdutoLoja(); }
  else EU.mostrarToast('É necessário manter pelo menos uma linha.', 'erro');
}
function coletarTamanhos(tbodyId) {
  var tbody = document.getElementById(tbodyId); if (!tbody) return [];
  var result = [];
  tbody.querySelectorAll('tr').forEach(function (tr) {
    var inputs = tr.querySelectorAll('input');
    var nome = inputs[0] && inputs[0].value.trim();
    if (!nome || inputs.length !== 2) return;
    if (tbodyId === 'listaTamanhosPerso') {
      var max = Number.parseInt(inputs[1].value, 10);
      result.push({ nome: nome, maxSabores: Number.isInteger(max) && max >= 1 ? max : 1 });
      return;
    }
    var preco = Number.parseFloat(inputs[1].value);
    if (Number.isFinite(preco) && preco >= 0) result.push({ nome: nome, preco: preco });
  });
  return result;
}
function coletarPrecosSabor() {
  var tbody = document.getElementById('listaPrecosSabor'); if (!tbody) return {};
  var precos = {};
  tbody.querySelectorAll('tr').forEach(function (tr) {
    var inputs = tr.querySelectorAll('input');
    if (inputs.length === 2) { var n = inputs[0].value.trim(), p = parseFloat(inputs[1].value); if (n && !isNaN(p)) precos[n] = p; }
  });
  return precos;
}

/* ============================================================
   CHECKBOXES DE SABORES E EXTRAS
   ============================================================ */
async function carregarSaboresCheckboxes(categoriaForcada) {
  if (!emailAtual) return;
  var snap = await db.collection('lojistas').doc(emailAtual).collection('sabores').get();
  saboresGlobais = snap.docs.map(function (d) { return { id: d.id, nome: d.data().nome, categorias: d.data().categorias || '', disponivel: d.data().disponivel !== 'nao' }; }).filter(function (s) { return s.disponivel; });
  var container = document.getElementById('saboresCheckboxLista');
  if (!container) return;
  var categoria = categoriaForcada === '__todos__' ? '' : (categoriaForcada || (document.getElementById('novoItemCategoria') || {}).value || '').trim();
  var filtered = saboresGlobais;
  if (categoria) filtered = saboresGlobais.filter(function (s) { return !s.categorias || s.categorias === '' || s.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(categoria) !== -1; });
  if (saboresGlobais.length === 0) container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Nenhum sabor disponível cadastrado ainda.</p>';
  else if (filtered.length === 0) container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Nenhum sabor com a categoria "' + EU.sanitize(categoria) + '". <a href="javascript:void(0)" onclick="carregarSaboresCheckboxes(\'__todos__\')" style="color:var(--primary); font-weight:600;">ver todos</a>.</p>';
  else container.innerHTML = filtered.map(function (s) { return '<label for="sabor_' + s.id + '" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:4px 0;"><input type="checkbox" id="sabor_' + s.id + '" value="' + s.id + '" onchange="limparErroSabores(); atualizarPreviewProdutoLoja()"> ' + EU.sanitize(s.nome) + '</label>'; }).join('');
  garantirCheckboxesSaboresInterativos();
  atualizarPreviewProdutoLoja();
}
function limparErroSabores() { var e = document.getElementById('erroItemSabores'); if (e) e.style.display = 'none'; }
function garantirCheckboxesSaboresInterativos() {
  document.querySelectorAll('#saboresCheckboxLista input[type="checkbox"]').forEach(function (cb) {
    cb.disabled = false; cb.style.pointerEvents = 'auto'; cb.style.opacity = '1'; cb.style.visibility = 'visible'; cb.style.display = 'inline-block'; cb.style.accentColor = 'var(--primary)';
  });
}
async function carregarExtrasCheckboxes(tipo, categoriaForcada) {
  if (!emailAtual) return;
  var snap = await db.collection('lojistas').doc(emailAtual).collection('extras').get();
  extrasGlobais = snap.docs.map(function (d) { return { id: d.id, nome: d.data().nome, categorias: d.data().categorias || '', disponivel: d.data().disponivel !== 'nao' }; }).filter(function (e) { return e.disponivel; });
  var container = tipo === 'personalizavel' ? document.getElementById('extrasCheckboxListaPersonalizavel') : document.getElementById('extrasCheckboxLista');
  if (!container) return;
  var categoria = categoriaForcada === '__todos__' ? '' : (categoriaForcada || (document.getElementById('novoItemCategoria') || {}).value || '').trim();
  var filtered = extrasGlobais;
  if (categoria) filtered = extrasGlobais.filter(function (e) { return !e.categorias || e.categorias === '' || e.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(categoria) !== -1; });
  if (extrasGlobais.length === 0) container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Nenhum adicional disponível cadastrado ainda.</p>';
  else if (filtered.length === 0) container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Nenhum adicional com a categoria "' + EU.sanitize(categoria) + '".</p>';
  else container.innerHTML = filtered.map(function (e) { return '<label for="extra_' + e.id + '" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:4px 0;"><input type="checkbox" id="extra_' + e.id + '" value="' + e.id + '"> ' + EU.sanitize(e.nome) + '</label>'; }).join('');
}

/* ============================================================
   CARDÁPIO (produtos)
   ============================================================ */
async function carregarCardapio() {
  if (!emailAtual) return;
  var container = document.getElementById('listaCardapio'); if (!container) return;
  var snap = await db.collection('lojistas').doc(emailAtual).collection('cardapio').get();
  var todos = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
  var termo = ((document.getElementById('buscaProdutoInput') || {}).value || '').trim().toLowerCase();
  var itens = termo ? todos.filter(function (s) { return (s.nome || '').toLowerCase().indexOf(termo) !== -1 || (s.categoria || '').toLowerCase().indexOf(termo) !== -1; }) : todos;
  if (itens.length === 0) { container.innerHTML = '<p style="text-align:center; padding:30px;">' + (termo ? 'Nenhum produto encontrado.' : 'Nenhum produto cadastrado.') + '</p>'; return; }
  container.innerHTML = itens.map(function (s) {
    var precoStr = '';
    if (s.tipo === 'tamanhos' && Array.isArray(s.tamanhos) && s.tamanhos.length) {
      var ps = s.tamanhos.map(function (t) { return parseFloat(t.preco) || 0; });
      precoStr = 'R$ ' + Math.min.apply(null, ps).toFixed(2) + ' - R$ ' + Math.max.apply(null, ps).toFixed(2);
    } else if (s.tipo === 'personalizavel') {
      precoStr = 'A partir de R$ ' + parseFloat(s.preco || 0).toFixed(2);
    } else {
      precoStr = 'R$ ' + parseFloat(s.preco || 0).toFixed(2);
    }
    var disp = s.disponivel !== 'nao';
    var tipoLabel = s.tipo === 'tamanhos' ? '<span class="badge-variavel">Por tamanho</span>' : (s.tipo === 'personalizavel' ? '<span class="badge-variavel">Personalizável</span>' : '');
    return '<div class="item-lista" data-id="' + s.id + '"><div><strong>' + EU.sanitize(s.nome) + '</strong> ' + tipoLabel + '<br><small>Preço: ' + precoStr + ' | Categoria: ' + EU.sanitize(s.categoria || 'Sem categoria') + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch"><input type="checkbox" ' + (disp ? 'checked' : '') + ' onchange="toggleDisponibilidadeProduto(\'' + s.id + '\', this.checked)"><span class="slider"></span></label> ' + (disp ? 'Disponível' : 'Indisponível') + '</div></div><div class="acoes"><button class="btn-pequeno" onclick="abrirModalEditarProduto(\'' + s.id + '\')">Editar</button><button class="btn-pequeno" onclick="duplicarProduto(\'' + s.id + '\')">Duplicar</button><button class="btn-pequeno" style="color:#dc2626;" onclick="excluirItemCardapio(\'' + s.id + '\')">Excluir</button></div></div>';
  }).join('');
}
async function toggleDisponibilidadeProduto(id, disp) {
  try {
    await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).update({ disponivel: disp ? 'sim' : 'nao' });
    var doc = await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).get();
    var nome = doc.exists ? (doc.data().nome || '') : '';
    EU.mostrarToast(nome ? 'Produto "' + nome + '" agora está ' + (disp ? 'disponível' : 'indisponível') + '.' : (disp ? 'Produto disponível!' : 'Produto indisponível.'), 'sucesso');
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); carregarCardapio(); }
}
async function excluirItemCardapio(id) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).get();
  var nome = doc.exists ? (doc.data().nome || 'este item') : 'este item';
  if (!confirm('Excluir "' + nome + '"? Essa ação não pode ser desfeita.')) return;
  EU.showLoading('Excluindo...');
  try { await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).delete(); await carregarCardapio(); EU.mostrarToast('"' + nome + '" removido.', 'sucesso'); }
  catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
  finally { EU.hideLoading(); }
}
function duplicarProduto(id) { abrirModalEditarProduto(id, true); }

/* ============================================================
   MODAL PRODUTO — CARREGAR / RESETAR / SALVAR
   ============================================================ */
function resetarFormularioProdutoLoja() {
  produtoEmEdicao = null;
  ['novoItemNome','novoItemCategoria','novoItemDescricao','novoItemImagem','novoItemPreco','novoItemEstoque','novoItemImagens'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var disp = document.getElementById('novoItemDisponivel'); if (disp) disp.value = 'sim';
  var arq = document.getElementById('novoItemImagemFile'); if (arq) arq.value = '';
  var prev = document.getElementById('previewImagensProduto'); if (prev) prev.innerHTML = '';
  imagensExtrasUrls = [];
  previewVariacoesSelecionadas = {};
  var tamA = document.getElementById('listaTamanhosAdicionar'); if (tamA) tamA.innerHTML = '<tr><td><input type="text" placeholder="Ex: P" class="tam-nome"></td><td><input type="number" step="0.01" placeholder="0.00" class="tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>';
  var tamP = document.getElementById('listaTamanhosPerso'); if (tamP) tamP.innerHTML = '<tr><td><input type="text" placeholder="Ex: Pequeno" class="tam-perso-nome"></td><td><input type="number" placeholder="1" class="tam-perso-max" value="1"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>';
  var sab = document.getElementById('saboresCheckboxLista'); if (sab) sab.innerHTML = '';
  var ex = document.getElementById('extrasCheckboxLista'); if (ex) ex.innerHTML = '';
  var exP = document.getElementById('extrasCheckboxListaPersonalizavel'); if (exP) exP.innerHTML = '';
  var titulo = document.getElementById('tituloModalProduto'); if (titulo) titulo.textContent = 'Novo produto';
  var botao = document.getElementById('btnAdicionarItem');
  if (botao) { var tx = botao.querySelector('.btn-text'); if (tx) tx.textContent = 'Cadastrar produto'; botao.disabled = false; botao.classList.remove('loading'); }
  document.getElementById('tipoProduto').value = 'simples';
  toggleTipoProduto();
  atualizarPreviewProdutoLoja();
}
function carregarProdutoNoFormulario(item) {
  var tipo = item.tipo || 'simples';
  var imagens = Array.isArray(item.imagens) && item.imagens.length ? item.imagens.slice() : (item.imagem ? [item.imagem] : []);
  document.getElementById('novoItemNome').value = item.nome || '';
  document.getElementById('novoItemCategoria').value = item.categoria || '';
  document.getElementById('novoItemDescricao').value = item.descricao || '';
  document.getElementById('novoItemDisponivel').value = item.disponivel || 'sim';
  document.getElementById('novoItemImagem').value = imagens[0] || '';
  document.getElementById('novoItemImagens').value = imagens.join(',');
  document.getElementById('novoItemPreco').value = item.preco != null ? item.preco : '';
  document.getElementById('novoItemEstoque').value = item.estoque != null ? item.estoque : '';
  document.getElementById('novoItemImagemFile').value = '';
  imagensExtrasUrls = imagens.slice(1);
  previewVariacoesSelecionadas = {};
  document.getElementById('tipoProduto').value = tipo;
  if (tipo === 'tamanhos' && Array.isArray(item.tamanhos) && item.tamanhos.length) {
    var tbodyA = document.getElementById('listaTamanhosAdicionar');
    tbodyA.innerHTML = item.tamanhos.map(function (t) {
      return '<tr><td><input type="text" value="' + EU.sanitize(t.nome) + '" class="tam-nome"></td><td><input type="number" step="0.01" value="' + t.preco + '" class="tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>';
    }).join('');
  }
  if (tipo === 'personalizavel' && Array.isArray(item.tamanhosDisponiveis) && item.tamanhosDisponiveis.length) {
    var tbodyP = document.getElementById('listaTamanhosPerso');
    tbodyP.innerHTML = item.tamanhosDisponiveis.map(function (t) {
      return '<tr><td><input type="text" value="' + EU.sanitize(t.nome) + '" class="tam-perso-nome"></td><td><input type="number" value="' + (t.maxSabores || 1) + '" class="tam-perso-max"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>';
    }).join('');
  }
  toggleTipoProduto().then(function () {
    if (tipo === 'tamanhos' && Array.isArray(item.extrasPermitidos)) {
      item.extrasPermitidos.forEach(function (id) { var cb = document.getElementById('extra_' + id); if (cb) cb.checked = true; });
    }
    if (tipo === 'personalizavel') {
      if (Array.isArray(item.saboresPermitidos)) item.saboresPermitidos.forEach(function (id) { var cb = document.getElementById('sabor_' + id); if (cb) cb.checked = true; });
      if (Array.isArray(item.extrasPermitidos)) item.extrasPermitidos.forEach(function (id) { var cb = document.getElementById('extra_' + id); if (cb) cb.checked = true; });
    }
    atualizarPreviewImagensExtras();
    atualizarPreviewProdutoLoja();
  });
}
async function abrirModalEditarProduto(id, isDuplicar) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).get();
  if (!doc.exists) return;
  produtoEmEdicao = { id: id, isDuplicar: !!isDuplicar };
  carregarProdutoNoFormulario(doc.data());
  var titulo = document.getElementById('tituloModalProduto');
  if (titulo) titulo.textContent = isDuplicar ? 'Duplicar produto' : 'Editar produto';
  var botao = document.getElementById('btnAdicionarItem');
  if (botao) { var tx = botao.querySelector('.btn-text'); if (tx) tx.textContent = isDuplicar ? 'Duplicar produto' : 'Salvar alterações'; }
  abrirModalCadastro('modalProduto');
}
function abrirModalCadastro(id) { var m = document.getElementById(id); if (m) m.classList.add('active'); }
function fecharModalCadastro(id) { var m = document.getElementById(id); if (m) m.classList.remove('active'); }
function limparFormularioProdutoCadastro() { resetarFormularioProdutoLoja(); }

document.getElementById('btnAdicionarItem').onclick = async function () {
  var btn = this; btn.classList.add('loading'); btn.disabled = true;
  try {
    var nome = document.getElementById('novoItemNome').value.trim();
    if (!nome) { EU.mostrarToast('Preencha o nome.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
    var tipo = document.getElementById('tipoProduto').value;
    var imagens = obterImagensProduto();
    var itemData = {
      nome: nome,
      categoria: document.getElementById('novoItemCategoria').value.trim(),
      descricao: document.getElementById('novoItemDescricao').value.trim(),
      disponivel: document.getElementById('novoItemDisponivel').value,
      tipo: tipo,
      imagens: imagens.slice(),
      imagem: imagens[0] || ''
    };
    if (tipo === 'simples') {
      var preco = Number.parseFloat(document.getElementById('novoItemPreco').value);
      var estoqueTxt = document.getElementById('novoItemEstoque').value.trim();
      if (!Number.isFinite(preco) || preco < 0) { EU.mostrarToast('Preço inválido.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      itemData.preco = preco;
      itemData.estoque = estoqueTxt === '' ? '' : Number.parseInt(estoqueTxt, 10).toString();
    } else if (tipo === 'tamanhos') {
      var tams = coletarTamanhos('listaTamanhosAdicionar');
      if (tams.length === 0) { EU.mostrarToast('Adicione pelo menos um tamanho.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      itemData.tamanhos = tams;
      itemData.preco = Math.min.apply(null, tams.map(function (t) { return t.preco; }));
      itemData.extrasPermitidos = Array.from(document.querySelectorAll('#extrasCheckboxLista input:checked')).map(function (cb) { return cb.value; });
    } else if (tipo === 'personalizavel') {
      itemData.tamanhosDisponiveis = coletarTamanhos('listaTamanhosPerso');
      itemData.saboresPermitidos = Array.from(document.querySelectorAll('#saboresCheckboxLista input:checked')).map(function (cb) { return cb.value; });
      itemData.saboresObrigatorios = false;
      itemData.extrasPermitidos = Array.from(document.querySelectorAll('#extrasCheckboxListaPersonalizavel input:checked')).map(function (cb) { return cb.value; });
      var precoBase = Number.parseFloat(document.getElementById('novoItemPreco').value);
      itemData.preco = Number.isFinite(precoBase) ? precoBase : 0;
    }
    var ref = db.collection('lojistas').doc(emailAtual).collection('cardapio');
    if (produtoEmEdicao && !produtoEmEdicao.isDuplicar) {
      await ref.doc(produtoEmEdicao.id).update(itemData);
      EU.mostrarToast('Produto "' + nome + '" atualizado!', 'sucesso');
    } else {
      await ref.add(itemData);
      EU.mostrarToast(produtoEmEdicao && produtoEmEdicao.isDuplicar ? 'Produto "' + nome + '" duplicado!' : 'Produto "' + nome + '" adicionado!', 'sucesso');
    }
    await carregarCardapio();
    fecharModalCadastro('modalProduto');
    resetarFormularioProdutoLoja();
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
};

/* ============================================================
   SABORES
   ============================================================ */
async function carregarSabores() {
  if (!emailAtual) return;
  var snap = await db.collection('lojistas').doc(emailAtual).collection('sabores').get();
  var container = document.getElementById('listaSabores');
  if (snap.empty) { container.innerHTML = '<p style="text-align:center; padding:30px;">Nenhum sabor cadastrado.</p>'; return; }
  container.innerHTML = snap.docs.map(function (doc) {
    var s = doc.data();
    var precosStr = s.precos && typeof s.precos === 'object' ? Object.keys(s.precos).map(function (t) { return t + ': R$ ' + parseFloat(s.precos[t]).toFixed(2); }).join(' | ') : 'Geral: R$ ' + parseFloat(s.preco || s.valor || 0).toFixed(2);
    var disp = s.disponivel !== 'nao';
    return '<div class="item-lista" data-id="' + doc.id + '"><div><strong>' + EU.sanitize(s.nome) + '</strong><br><small>Preços: ' + precosStr + ' | Categorias: ' + EU.sanitize(s.categorias || 'Todas') + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch"><input type="checkbox" ' + (disp ? 'checked' : '') + ' onchange="toggleDisponibilidadeSabor(\'' + doc.id + '\', this.checked)"><span class="slider"></span></label> ' + (disp ? 'Disponível' : 'Indisponível') + '</div></div><div class="acoes"><button class="btn-pequeno" onclick="editarSaborModal(\'' + doc.id + '\')">Editar</button><button class="btn-pequeno" onclick="duplicarSabor(\'' + doc.id + '\')">Duplicar</button><button class="btn-pequeno" style="color:#dc2626;" onclick="excluirSabor(\'' + doc.id + '\')">Excluir</button></div></div>';
  }).join('');
}
async function toggleDisponibilidadeSabor(id, disp) {
  try {
    await db.collection('lojistas').doc(emailAtual).collection('sabores').doc(id).update({ disponivel: disp ? 'sim' : 'nao' });
    var doc = await db.collection('lojistas').doc(emailAtual).collection('sabores').doc(id).get();
    var nome = doc.exists ? (doc.data().nome || '') : '';
    EU.mostrarToast(nome ? 'Sabor "' + nome + '" agora está ' + (disp ? 'disponível' : 'indisponível') + '.' : (disp ? 'Sabor disponível!' : 'Sabor indisponível.'), 'sucesso');
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); carregarSabores(); }
}
async function editarSaborModal(id, isDuplicar) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('sabores').doc(id).get();
  if (!doc.exists) return;
  var s = doc.data();
  var modal = document.createElement('div'); modal.className = 'modal-overlay active';
  var titulo = isDuplicar ? 'Duplicar Sabor' : 'Editar Sabor';
  var precos = s.precos || {};
  var precosHtml = Object.keys(precos).map(function (t) { return '<tr><td><input type="text" value="' + EU.sanitize(t) + '" class="sabor-tam-nome"></td><td><input type="number" step="0.01" value="' + precos[t] + '" class="sabor-tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>'; }).join('') || '<tr><td><input type="text" placeholder="Ex: G" class="sabor-tam-nome"></td><td><input type="number" step="0.01" placeholder="0.00" class="sabor-tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>';
  var nomePadrao = isDuplicar ? s.nome + ' (cópia)' : s.nome;
  modal.innerHTML = '<div class="modal-conteudo"><div class="modal-header"><h3>' + titulo + '</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div><div class="campo"><label>Nome <span class="obrigatorio">*</span></label><input type="text" id="editSaborNome" value="' + EU.sanitize(nomePadrao) + '"></div><div class="campo"><label>Preços por Tamanho <span class="obrigatorio">*</span></label><table class="tabela-tamanhos"><tbody id="editPrecosSabor">' + precosHtml + '</tbody></table><button type="button" class="btn-pequeno" onclick="adicionarLinhaPrecoSaborEdit()">+ Adicionar tamanho</button></div><div class="campo"><label>Descrição</label><textarea id="editSaborDescricao" rows="2">' + EU.sanitize(s.descricao || '') + '</textarea></div><div class="campo"><label>Categorias</label><input type="text" id="editSaborCategorias" value="' + EU.sanitize(s.categorias || '') + '"></div><button class="btn-primary" id="saveSaborEdit"><span class="spinner-btn"></span><span class="btn-text">' + (isDuplicar ? 'Duplicar' : 'Salvar') + '</span></button></div>';
  document.body.appendChild(modal);
  window.adicionarLinhaPrecoSaborEdit = function () { var tbody = document.getElementById('editPrecosSabor'); var tr = document.createElement('tr'); tr.innerHTML = '<td><input type="text" placeholder="Ex: G" class="sabor-tam-nome"></td><td><input type="number" step="0.01" placeholder="0.00" class="sabor-tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td>'; tbody.appendChild(tr); };
  document.getElementById('saveSaborEdit').onclick = async function () {
    var btn = this; btn.classList.add('loading'); btn.disabled = true;
    try {
      var nome = document.getElementById('editSaborNome').value.trim();
      if (!nome) { EU.mostrarToast('Nome obrigatório.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      var precos = {};
      document.querySelectorAll('#editPrecosSabor tr').forEach(function (tr) { var inputs = tr.querySelectorAll('input'); if (inputs.length === 2) { var t = inputs[0].value.trim(), p = parseFloat(inputs[1].value); if (t && !isNaN(p)) precos[t] = p; } });
      if (Object.keys(precos).length === 0) { EU.mostrarToast('Adicione pelo menos um tamanho com preço.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      var data = { nome: nome, precos: precos, descricao: document.getElementById('editSaborDescricao').value.trim(), categorias: document.getElementById('editSaborCategorias').value.trim(), disponivel: isDuplicar ? 'sim' : (s.disponivel || 'sim') };
      if (isDuplicar) { await db.collection('lojistas').doc(emailAtual).collection('sabores').add(data); EU.mostrarToast('Sabor "' + nome + '" duplicado!', 'sucesso'); }
      else { await db.collection('lojistas').doc(emailAtual).collection('sabores').doc(id).update(data); EU.mostrarToast('Sabor "' + nome + '" atualizado!', 'sucesso'); }
      await carregarSabores(); modal.remove();
    } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  };
}
async function excluirSabor(id) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('sabores').doc(id).get();
  var nome = doc.exists ? (doc.data().nome || 'este sabor') : 'este sabor';
  if (!confirm('Excluir "' + nome + '"? Essa ação não pode ser desfeita.')) return;
  await db.collection('lojistas').doc(emailAtual).collection('sabores').doc(id).delete();
  carregarSabores();
  EU.mostrarToast('"' + nome + '" removido.', 'sucesso');
}
function duplicarSabor(id) { editarSaborModal(id, true); }

/* ============================================================
   EXTRAS
   ============================================================ */
async function carregarExtras() {
  if (!emailAtual) return;
  var snap = await db.collection('lojistas').doc(emailAtual).collection('extras').get();
  var container = document.getElementById('listaExtras');
  if (snap.empty) { container.innerHTML = '<p style="text-align:center; padding:30px;">Nenhum adicional cadastrado.</p>'; return; }
  container.innerHTML = snap.docs.map(function (doc) {
    var s = doc.data();
    var disp = s.disponivel !== 'nao';
    return '<div class="item-lista" data-id="' + doc.id + '"><div><strong>' + EU.sanitize(s.nome) + '</strong><br><small>R$ ' + parseFloat(s.preco || 0).toFixed(2) + ' | Categorias: ' + EU.sanitize(s.categorias || 'Todas') + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch"><input type="checkbox" ' + (disp ? 'checked' : '') + ' onchange="toggleDisponibilidadeExtra(\'' + doc.id + '\', this.checked)"><span class="slider"></span></label> ' + (disp ? 'Disponível' : 'Indisponível') + '</div></div><div class="acoes"><button class="btn-pequeno" onclick="editarExtraModal(\'' + doc.id + '\')">Editar</button><button class="btn-pequeno" onclick="duplicarExtra(\'' + doc.id + '\')">Duplicar</button><button class="btn-pequeno" style="color:#dc2626;" onclick="excluirExtra(\'' + doc.id + '\')">Excluir</button></div></div>';
  }).join('');
}
async function toggleDisponibilidadeExtra(id, disp) {
  try {
    await db.collection('lojistas').doc(emailAtual).collection('extras').doc(id).update({ disponivel: disp ? 'sim' : 'nao' });
    var doc = await db.collection('lojistas').doc(emailAtual).collection('extras').doc(id).get();
    var nome = doc.exists ? (doc.data().nome || '') : '';
    EU.mostrarToast(nome ? 'Adicional "' + nome + '" agora está ' + (disp ? 'disponível' : 'indisponível') + '.' : (disp ? 'Adicional disponível!' : 'Adicional indisponível.'), 'sucesso');
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); carregarExtras(); }
}
async function editarExtraModal(id, isDuplicar) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('extras').doc(id).get();
  if (!doc.exists) return;
  var e = doc.data();
  var modal = document.createElement('div'); modal.className = 'modal-overlay active';
  var titulo = isDuplicar ? 'Duplicar adicional' : 'Editar adicional';
  var nomePadrao = isDuplicar ? e.nome + ' (cópia)' : e.nome;
  modal.innerHTML = '<div class="modal-conteudo"><div class="modal-header"><h3>' + titulo + '</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div><div class="campo"><label>Nome <span class="obrigatorio">*</span></label><input type="text" id="editExtraNome" value="' + EU.sanitize(nomePadrao) + '"></div><div class="campo"><label>Preço (R$) <span class="obrigatorio">*</span></label><input type="number" step="0.01" id="editExtraPreco" value="' + (e.preco || 0) + '"></div><div class="campo"><label>Descrição</label><textarea id="editExtraDescricao" rows="2">' + EU.sanitize(e.descricao || '') + '</textarea></div><div class="campo"><label>Máximo por pedido</label><input type="number" id="editExtraMax" value="' + (e.max || 0) + '"></div><div class="campo"><label>Categorias</label><input type="text" id="editExtraCategorias" value="' + EU.sanitize(e.categorias || '') + '"></div><button class="btn-primary" id="saveExtraEdit"><span class="spinner-btn"></span><span class="btn-text">' + (isDuplicar ? 'Duplicar' : 'Salvar') + '</span></button></div>';
  document.body.appendChild(modal);
  document.getElementById('saveExtraEdit').onclick = async function () {
    var btn = this; btn.classList.add('loading'); btn.disabled = true;
    try {
      var nome = document.getElementById('editExtraNome').value.trim();
      if (!nome) { EU.mostrarToast('Nome obrigatório.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      var preco = parseFloat(document.getElementById('editExtraPreco').value);
      if (isNaN(preco) || preco < 0) { EU.mostrarToast('Preço inválido.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      var data = { nome: nome, preco: preco, descricao: document.getElementById('editExtraDescricao').value.trim(), max: parseInt(document.getElementById('editExtraMax').value) || 0, categorias: document.getElementById('editExtraCategorias').value.trim(), disponivel: isDuplicar ? 'sim' : (e.disponivel || 'sim') };
      if (isDuplicar) { await db.collection('lojistas').doc(emailAtual).collection('extras').add(data); EU.mostrarToast('Adicional "' + nome + '" duplicado!', 'sucesso'); }
      else { await db.collection('lojistas').doc(emailAtual).collection('extras').doc(id).update(data); EU.mostrarToast('Adicional "' + nome + '" atualizado!', 'sucesso'); }
      await carregarExtras(); modal.remove();
    } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
  };
}
async function excluirExtra(id) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('extras').doc(id).get();
  var nome = doc.exists ? (doc.data().nome || 'este adicional') : 'este adicional';
  if (!confirm('Excluir "' + nome + '"? Essa ação não pode ser desfeita.')) return;
  await db.collection('lojistas').doc(emailAtual).collection('extras').doc(id).delete();
  carregarExtras();
  EU.mostrarToast('"' + nome + '" removido.', 'sucesso');
}
function duplicarExtra(id) { editarExtraModal(id, true); }

/* ============================================================
   FRETES
   ============================================================ */
async function carregarFretes() {
  if (!emailAtual) return;
  var snap = await db.collection('lojistas').doc(emailAtual).collection('fretes').get();
  var container = document.getElementById('listaFretes');
  container.innerHTML = snap.docs.map(function (doc) {
    var data = doc.data();
    var ativo = data.ativo !== 'nao';
    var taxa = parseFloat(data.taxa) || 0;
    return '<div class="item-lista"><div><strong>' + EU.sanitize(data.localidade || 'Localidade') + '</strong><br><small>Taxa: R$ ' + taxa.toFixed(2) + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch"><input type="checkbox" ' + (ativo ? 'checked' : '') + ' onchange="toggleAtivoFrete(\'' + doc.id + '\', this.checked)"><span class="slider"></span></label> ' + (ativo ? 'Ativa' : 'Inativa') + '</div></div><div><button class="btn-pequeno" onclick="editarFreteModal(\'' + doc.id + '\')">Editar</button> <button class="btn-pequeno" onclick="duplicarFrete(\'' + doc.id + '\')">Duplicar</button> <button class="btn-pequeno" style="color:#dc2626" onclick="excluirFrete(\'' + doc.id + '\')">Excluir</button></div></div>';
  }).join('') || '<p style="text-align:center;">Nenhuma taxa configurada.</p>';
}
async function toggleAtivoFrete(id, ativo) {
  try {
    await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).update({ ativo: ativo ? 'sim' : 'nao' });
    var doc = await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).get();
    var loc = doc.exists ? (doc.data().localidade || '') : '';
    EU.mostrarToast(loc ? 'Taxa "' + loc + '" agora está ' + (ativo ? 'ativa' : 'inativa') + '.' : (ativo ? 'Taxa ativa!' : 'Taxa inativa.'), 'sucesso');
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); await carregarFretes(); }
}
async function duplicarFrete(id) {
  var snap = await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).get();
  if (!snap.exists) return;
  var f = snap.data();
  editarFreteModal(id, (f.localidade || '') + ' (cópia)', f.taxa, f.ativo || 'sim', true);
}
function editarFreteModal(id, loc, taxa, ativo, isDuplicar) {
  var modal = document.createElement('div');
  modal.className = 'modal-overlay entrega-modal active';
  var titulo = isDuplicar ? 'Duplicar taxa de entrega' : 'Editar taxa de entrega';
  modal.innerHTML = '<div class="modal-conteudo entrega-modal-conteudo"><div class="modal-header"><div><span class="modal-eyebrow">Taxas de entrega</span><h3>' + titulo + '</h3></div><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div><div class="campanha-form"><div class="campanha-secao-titulo">1. DADOS DA ENTREGA</div><div class="campo"><label>Localidade</label><input type="text" id="editLoc" value="' + EU.sanitize(loc) + '"></div><div class="campo"><label>Taxa (R$)</label><input type="number" step="0.01" id="editTaxa" value="' + taxa + '"></div><div class="campanha-modal-acoes"><button class="btn-secundario" onclick="this.closest(\'.modal-overlay\').remove()">Cancelar</button><button class="btn-primary" id="salvarFrete"><span class="spinner-btn"></span><span class="btn-text">' + (isDuplicar ? 'Duplicar' : 'Salvar') + '</span></button></div></div></div>';
  document.body.appendChild(modal);
  document.getElementById('salvarFrete').onclick = async function () {
    var btn = this; btn.classList.add('loading'); btn.disabled = true;
    var l = document.getElementById('editLoc').value.trim();
    var t = parseFloat(document.getElementById('editTaxa').value);
    if (!l || !Number.isFinite(t) || t < 0) { EU.mostrarToast('Preencha localidade e taxa.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
    try {
      var ref = db.collection('lojistas').doc(emailAtual).collection('fretes');
      if (isDuplicar) { await ref.add({ localidade: l, taxa: t, ativo: 'sim' }); EU.mostrarToast('Taxa "' + l + '" duplicada!', 'sucesso'); }
      else { await ref.doc(id).update({ localidade: l, taxa: t }); EU.mostrarToast('Taxa "' + l + '" atualizada!', 'sucesso'); }
      await carregarFretes(); modal.remove();
    } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); btn.classList.remove('loading'); btn.disabled = false; }
  };
}
async function excluirFrete(id) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).get();
  var loc = doc.exists ? (doc.data().localidade || 'esta taxa') : 'esta taxa';
  if (!confirm('Excluir a taxa de "' + loc + '"? Essa ação não pode ser desfeita.')) return;
  await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).delete();
  carregarFretes();
  EU.mostrarToast('Taxa "' + loc + '" removida.', 'sucesso');
}

/* ============================================================
   CUPONS (completo)
   ============================================================ */
async function carregarCupons() {
  if (!emailAtual) return;
  var snap = await db.collection('lojistas').doc(emailAtual).collection('cupons').get();
  var container = document.getElementById('listaCupons');
  container.innerHTML = snap.docs.map(function (doc) {
    var c = doc.data();
    var ativo = c.ativo === 'sim';
    var validade = c.validade ? new Date(c.validade + 'T23:59:59').toLocaleDateString('pt-BR') : 'Sem validade';
    var minPed = c.minimoPedido ? 'Mínimo: R$ ' + parseFloat(c.minimoPedido).toFixed(2) : 'Sem mínimo';
    var usos = parseInt(c.usosTotal, 10) || 0;
    var lim = parseInt(c.limiteUsos, 10);
    var usoTexto = Number.isInteger(lim) && lim > 0 ? 'Usos: ' + usos + '/' + lim : 'Usos: ' + usos + '/Ilimitado';
    return '<div class="item-lista"><div><strong>' + EU.sanitize(c.codigo) + '</strong><br><small>' + (c.tipo === 'percentual' ? c.valor + '%' : 'R$ ' + parseFloat(c.valor).toFixed(2)) + ' | ' + validade + ' | ' + minPed + ' | ' + usoTexto + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch"><input type="checkbox" ' + (ativo ? 'checked' : '') + ' onchange="toggleAtivoCupom(\'' + doc.id + '\', this.checked)"><span class="slider"></span></label> ' + (ativo ? 'Ativo' : 'Inativo') + '</div></div><div><button class="btn-pequeno" onclick="editarCupomModal(\'' + doc.id + '\')">Editar</button> <button class="btn-pequeno" onclick="duplicarCupom(\'' + doc.id + '\')">Duplicar</button> <button class="btn-pequeno" style="color:#dc2626" onclick="excluirCupom(\'' + doc.id + '\')">Excluir</button></div></div>';
  }).join('') || '<p style="text-align:center;">Nenhum cupom criado.</p>';
}
function abrirModalCupomLoja() { var m = document.getElementById('modalCupom'); if (m) m.classList.add('active'); }
function fecharModalCupomLoja() { var m = document.getElementById('modalCupom'); if (m) m.classList.remove('active'); }
function limparFormularioCupom() {
  cupomEmEdicao = null;
  ['novoCodigo','novoValor','novoValidade','novoMinimoPedido','novoLimiteUsos'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  var t = document.getElementById('novoTipo'); if (t) t.value = 'percentual';
  var tit = document.getElementById('tituloModalCupom'); if (tit) tit.textContent = 'Novo cupom';
  var b = document.getElementById('btnAdicionarCupom'); if (b) b.textContent = 'Salvar cupom';
}
async function salvarCupomLoja() {
  var cod = document.getElementById('novoCodigo').value.trim().toUpperCase();
  var tipo = document.getElementById('novoTipo').value;
  var ativo = (cupomEmEdicao && cupomEmEdicao.ativo) || 'sim';
  var valor = parseFloat(document.getElementById('novoValor').value);
  var validade = document.getElementById('novoValidade').value;
  var minPed = parseFloat(document.getElementById('novoMinimoPedido').value) || null;
  var limTxt = document.getElementById('novoLimiteUsos').value.trim();
  var limiteUsos = limTxt === '' ? null : parseInt(limTxt, 10);
  if (!cod || isNaN(valor) || valor <= 0) { EU.mostrarToast('Preencha código e valor.', 'erro'); return; }
  if (tipo === 'percentual' && valor > 100) { EU.mostrarToast('Percentual não pode passar de 100%.', 'erro'); return; }
  if (limTxt !== '' && (!Number.isInteger(limiteUsos) || limiteUsos < 1)) { EU.mostrarToast('Limite deve ser inteiro > 0.', 'erro'); return; }
  EU.showLoading(cupomEmEdicao ? (cupomEmEdicao.isDuplicar ? 'Duplicando...' : 'Salvando...') : 'Criando...');
  try {
    var ref = db.collection('lojistas').doc(emailAtual).collection('cupons');
    var dados = { codigo: cod, tipo: tipo, valor: valor, ativo: ativo, validade: validade || null, minimoPedido: minPed, limiteUsos: limiteUsos };
    if (cupomEmEdicao && !cupomEmEdicao.isDuplicar) { await ref.doc(cupomEmEdicao.id).update(dados); EU.mostrarToast('Cupom "' + cod + '" atualizado!', 'sucesso'); }
    else { await ref.add(Object.assign({}, dados, { usosTotal: 0, usosPorCliente: {} })); EU.mostrarToast(cupomEmEdicao && cupomEmEdicao.isDuplicar ? 'Cupom "' + cod + '" duplicado!' : 'Cupom "' + cod + '" criado!', 'sucesso'); }
    await carregarCupons(); fecharModalCupomLoja(); limparFormularioCupom();
  } catch (e) { EU.mostrarToast(e.message, 'erro'); }
  finally { EU.hideLoading(); }
}
async function toggleAtivoCupom(id, ativo) {
  try {
    await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).update({ ativo: ativo ? 'sim' : 'nao' });
    var doc = await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).get();
    var cod = doc.exists ? (doc.data().codigo || '') : '';
    EU.mostrarToast(cod ? 'Cupom "' + cod + '" agora está ' + (ativo ? 'ativo' : 'inativo') + '.' : (ativo ? 'Cupom ativo!' : 'Cupom inativo.'), 'sucesso');
    await carregarCupons();
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); await carregarCupons(); }
}
async function excluirCupom(id) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).get();
  var cod = doc.exists ? (doc.data().codigo || 'este cupom') : 'este cupom';
  if (!confirm('Excluir o cupom "' + cod + '"? Essa ação não pode ser desfeita.')) return;
  await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).delete();
  carregarCupons();
  EU.mostrarToast('Cupom "' + cod + '" removido.', 'sucesso');
}
async function duplicarCupom(id) {
  var snap = await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).get();
  if (!snap.exists) return;
  var c = snap.data();
  editarCupomModal(id, c.codigo + '_COPIA', c.tipo, c.valor, c.ativo, c.validade || '', c.minimoPedido || 0, c.limiteUsos || 0, true);
}
function editarCupomModal(id, cod, tipo, valor, ativo, validade, minPed, lim, isDuplicar) {
  cupomEmEdicao = { id: id, isDuplicar: !!isDuplicar, ativo: ativo === 'nao' ? 'nao' : 'sim' };
  document.getElementById('novoCodigo').value = cod || '';
  document.getElementById('novoTipo').value = tipo || 'percentual';
  document.getElementById('novoValor').value = valor != null ? valor : '';
  document.getElementById('novoValidade').value = validade || '';
  document.getElementById('novoMinimoPedido').value = minPed || '';
  document.getElementById('novoLimiteUsos').value = lim || '';
  document.getElementById('tituloModalCupom').textContent = isDuplicar ? 'Duplicar cupom' : 'Editar cupom';
  document.getElementById('btnAdicionarCupom').textContent = isDuplicar ? 'Duplicar cupom' : 'Salvar alterações';
  abrirModalCupomLoja();
}

/* ============================================================
   PROMOÇÕES
   ============================================================ */
function escaparTextoPromocao(v) { return EU.sanitize(v); }
function alternarModoCampanha(modo) {
  var btnCupom = document.getElementById('btnModoCupom');
  var btnPromo = document.getElementById('btnModoPromocao');
  var btnNovoCupom = document.getElementById('btnNovoCupom');
  var btnNovaPromo = document.getElementById('btnNovaPromocao');
  var listaCupons = document.getElementById('listaCupons');
  var listaPromocoes = document.getElementById('listaPromocoes');
  var mostrarPromo = modo === 'promocao';
  if (btnNovoCupom) btnNovoCupom.style.display = mostrarPromo ? 'none' : 'inline-flex';
  if (btnNovaPromo) btnNovaPromo.style.display = mostrarPromo ? 'inline-flex' : 'none';
  if (listaCupons) listaCupons.style.display = mostrarPromo ? 'none' : 'block';
  if (listaPromocoes) listaPromocoes.style.display = mostrarPromo ? 'block' : 'none';
  if (btnCupom) { btnCupom.classList.toggle('active', !mostrarPromo); btnCupom.setAttribute('aria-selected', String(!mostrarPromo)); }
  if (btnPromo) { btnPromo.classList.toggle('active', mostrarPromo); btnPromo.setAttribute('aria-selected', String(mostrarPromo)); }
  if (mostrarPromo) carregarProdutosParaPromocao();
  else carregarCupons();
}
function abrirModalPromocaoLoja() { var m = document.getElementById('modalPromocao'); if (m) m.classList.add('active'); }
function fecharModalPromocaoLoja() { var m = document.getElementById('modalPromocao'); if (m) m.classList.remove('active'); }
function obterProdutoPromocao(id) { return produtosPromocaoCache.find(function (p) { return String(p.id) === String(id); }) || null; }
function renderizarProdutosPromocao() {
  var lista = document.getElementById('listaProdutosPromocao'); if (!lista) return;
  var busca = ((document.getElementById('buscaProdutosPromocao') || {}).value || '').trim().toLowerCase();
  var produtos = produtosPromocaoCache.filter(function (p) { return !busca || String(p.nome || '').toLowerCase().indexOf(busca) !== -1 || String(p.categoria || '').toLowerCase().indexOf(busca) !== -1; });
  if (!produtos.length) lista.innerHTML = '<div class="selecao-produto-vazio"><i class="fas fa-search"></i><br>Nenhum produto encontrado.</div>';
  else lista.innerHTML = produtos.map(function (p) {
    var checked = promocaoProdutosSelecionados.some(function (id) { return String(id) === String(p.id); });
    var tipoTxt = p.tipo === 'tamanhos' ? 'Por tamanho' : (p.tipo === 'personalizavel' ? 'Personalizável' : 'Simples');
    var imagem = p.imagem || (Array.isArray(p.imagens) && p.imagens[0]) || '';
    var imgHtml = imagem ? '<img class="produto-opcao-promocao-imagem" src="' + escaparTextoPromocao(imagem) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '<span class="produto-opcao-promocao-imagem produto-opcao-promocao-sem-imagem"><i class="fas fa-image"></i></span>';
    return '<label class="produto-opcao-promocao' + (checked ? ' selecionado' : '') + '"><input type="checkbox" data-promocao-produto="' + escaparTextoPromocao(p.id) + '"' + (checked ? ' checked' : '') + '><span class="produto-opcao-promocao-check" aria-hidden="true"><i class="fas fa-check"></i></span>' + imgHtml + '<span class="produto-opcao-promocao-texto"><strong>' + escaparTextoPromocao(p.nome || 'Produto') + '</strong><small>' + escaparTextoPromocao(p.categoria || 'Sem categoria') + ' · ' + tipoTxt + '</small></span></label>';
  }).join('');
  lista.querySelectorAll('[data-promocao-produto]').forEach(function (input) {
    input.addEventListener('change', function () {
      var id = input.dataset.promocaoProduto;
      if (input.checked && !promocaoProdutosSelecionados.some(function (x) { return String(x) === String(id); })) promocaoProdutosSelecionados.push(id);
      if (!input.checked) promocaoProdutosSelecionados = promocaoProdutosSelecionados.filter(function (x) { return String(x) !== String(id); });
      var card = input.closest('.produto-opcao-promocao'); if (card) card.classList.toggle('selecionado', input.checked);
      promocaoVariacoesSelecionadas = promocaoVariacoesSelecionadas.filter(function (v) { return promocaoProdutosSelecionados.some(function (x) { return String(x) === String(v.produtoId); }); });
      renderizarProdutosPromocaoSelecionados();
      atualizarAplicacaoVariacoesPromocao();
    });
  });
  renderizarProdutosPromocaoSelecionados();
  atualizarAplicacaoVariacoesPromocao();
}
function renderizarProdutosPromocaoSelecionados() {
  var container = document.getElementById('produtosPromocaoSelecionados'); if (!container) return;
  var selecionados = promocaoProdutosSelecionados.map(obterProdutoPromocao).filter(Boolean);
  var contador = document.getElementById('contadorProdutosPromocao');
  if (contador) contador.textContent = selecionados.length + (selecionados.length === 1 ? ' selecionado' : ' selecionados');
  container.innerHTML = selecionados.length ? selecionados.map(function (p) {
    return '<span class="selecao-promocao-chip"><i class="fas fa-check"></i>' + escaparTextoPromocao(p.nome) + '<button type="button" data-remover-produto-promocao="' + escaparTextoPromocao(p.id) + '">×</button></span>';
  }).join('') : '<div class="selecao-produto-vazio">Nenhum produto selecionado ainda.</div>';
  container.querySelectorAll('[data-remover-produto-promocao]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.dataset.removerProdutoPromocao;
      promocaoProdutosSelecionados = promocaoProdutosSelecionados.filter(function (x) { return String(x) !== String(id); });
      promocaoVariacoesSelecionadas = promocaoVariacoesSelecionadas.filter(function (v) { return String(v.produtoId) !== String(id); });
      renderizarProdutosPromocao();
    });
  });
}
function atualizarAplicacaoVariacoesPromocao() {
  var selecionados = promocaoProdutosSelecionados.map(obterProdutoPromocao).filter(Boolean);
  var temVar = selecionados.some(function (p) { return (p.tipo === 'tamanhos' && Array.isArray(p.tamanhos) && p.tamanhos.length) || (p.tipo === 'personalizavel' && Array.isArray(p.tamanhosDisponiveis) && p.tamanhosDisponiveis.length); });
  var bloco = document.getElementById('aplicacaoVariacaoPromocao');
  var lista = document.getElementById('listaVariacoesPromocao');
  var aplic = document.getElementById('aplicacaoPromocao');
  if (bloco) bloco.style.display = temVar ? 'block' : 'none';
  if (!temVar && aplic) aplic.value = 'todas';
  if (lista) lista.style.display = temVar && aplic && aplic.value === 'especificas' ? 'grid' : 'none';
  if (temVar && aplic && aplic.value === 'especificas' && lista) {
    var opcoes = [];
    selecionados.forEach(function (p) {
      var variacoes = [];
      if (p.tipo === 'tamanhos' && Array.isArray(p.tamanhos)) variacoes = p.tamanhos.map(function (t) { return { id: t.nome, nome: t.nome, preco: t.preco }; });
      else if (p.tipo === 'personalizavel' && Array.isArray(p.tamanhosDisponiveis)) variacoes = p.tamanhosDisponiveis.map(function (t) { return { id: t.nome, nome: t.nome, preco: 0 }; });
      variacoes.forEach(function (v) {
        var checked = promocaoVariacoesSelecionadas.some(function (x) { return x.produtoId === p.id && x.variacaoId === v.id; }) ? ' checked' : '';
        opcoes.push('<label class="variacao-opcao-promocao"><input type="checkbox" data-promocao-variacao-produto="' + escaparTextoPromocao(p.id) + '" data-promocao-variacao-id="' + escaparTextoPromocao(v.id) + '"' + checked + '><span>' + escaparTextoPromocao(p.nome + ' - ' + v.nome) + '</span></label>');
      });
    });
    lista.innerHTML = opcoes.join('') || '<div style="padding:.8rem;color:#64748b;">Nenhuma variação disponível.</div>';
    lista.querySelectorAll('[data-promocao-variacao-id]').forEach(function (input) {
      input.addEventListener('change', function () {
        var reg = { produtoId: input.dataset.promocaoVariacaoProduto, variacaoId: input.dataset.promocaoVariacaoId };
        if (input.checked) promocaoVariacoesSelecionadas.push(reg);
        else promocaoVariacoesSelecionadas = promocaoVariacoesSelecionadas.filter(function (x) { return !(x.produtoId === reg.produtoId && x.variacaoId === reg.variacaoId); });
      });
    });
  }
}
async function carregarProdutosParaPromocao() {
  try {
    var snap = await db.collection('lojistas').doc(emailAtual).collection('cardapio').get();
    produtosPromocaoCache = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).filter(function (p) { return p.disponivel !== 'nao'; });
    renderizarProdutosPromocao();
  } catch (e) { console.error(e); EU.mostrarToast('Não foi possível carregar produtos.', 'erro'); }
}
function atualizarModoQuantidadePromocao() {
  var modo = (document.getElementById('modoQuantidadePromocao') || {}).value || 'a_cada';
  var ajuda = document.getElementById('ajudaModoQuantidade');
  if (ajuda) ajuda.textContent = modo === 'a_partir' ? 'Ex.: a partir de 2 unidades, cada peça custa R$ 5.' : 'Ex.: a cada 2 unidades, o grupo custa R$ 10.';
  document.querySelectorAll('#faixasPromocao .faixa-preco-label').forEach(function (l) {
    l.textContent = modo === 'a_partir' ? 'Preço por peça (R$)' : 'Preço do grupo (R$)';
  });
}
function atualizarTipoPromocao() {
  var tipo = (document.getElementById('novoTipoPromocao') || {}).value || 'preco';
  var grupoValor = document.getElementById('valorPromocaoGrupo');
  var grupoFaixas = document.getElementById('faixasPromocaoGrupo');
  var label = document.getElementById('labelValorPromocao');
  if (grupoValor) grupoValor.style.display = tipo === 'quantidade' ? 'none' : 'grid';
  if (grupoFaixas) grupoFaixas.style.display = tipo === 'quantidade' ? 'block' : 'none';
  if (label) label.innerHTML = tipo === 'percentual' ? 'Desconto (%) <span class="obrigatorio">*</span>' : 'Preço promocional (R$) <span class="obrigatorio">*</span>';
  if (tipo === 'quantidade' && !document.querySelector('#faixasPromocao .faixa-promocao')) adicionarFaixaPromocao();
  atualizarModoQuantidadePromocao();
}
function adicionarFaixaPromocao(faixa) {
  var c = document.getElementById('faixasPromocao'); if (!c) return;
  var div = document.createElement('div'); div.className = 'faixa-promocao';
  div.innerHTML = '<div class="campo"><label>Quantidade mínima</label><input type="number" min="1" step="1" class="faixa-quantidade" value="' + (faixa && faixa.quantidade || '') + '" placeholder="Ex.: 2"></div><div class="campo"><label class="faixa-preco-label">Preço do grupo (R$)</label><input type="number" min="0" step="0.01" class="faixa-preco" value="' + (faixa && faixa.preco || '') + '" placeholder="Ex.: 10"></div><button type="button" class="btn-remover-faixa">×</button>';
  div.querySelector('.btn-remover-faixa').addEventListener('click', function () { div.remove(); });
  c.appendChild(div); atualizarModoQuantidadePromocao();
}
function obterFaixasPromocao() {
  return Array.from(document.querySelectorAll('#faixasPromocao .faixa-promocao')).map(function (row) {
    return { quantidade: parseInt(row.querySelector('.faixa-quantidade').value), preco: parseFloat(row.querySelector('.faixa-preco').value) };
  }).filter(function (f) { return !isNaN(f.quantidade) && f.quantidade > 0 && !isNaN(f.preco) && f.preco >= 0; }).sort(function (a, b) { return a.quantidade - b.quantidade; });
}
function limparFormularioPromocao() {
  promocaoProdutosSelecionados = [];
  promocaoVariacoesSelecionadas = [];
  promocaoEmEdicao = null;
  ['novoNomePromocao','novoValorPromocao','novoInicioPromocao','novoFimPromocao'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  var t = document.getElementById('novoTipoPromocao'); if (t) t.value = 'preco';
  var m = document.getElementById('modoQuantidadePromocao'); if (m) m.value = 'a_cada';
  var a = document.getElementById('aplicacaoPromocao'); if (a) a.value = 'todas';
  var f = document.getElementById('faixasPromocao'); if (f) f.innerHTML = '';
  var tit = document.getElementById('tituloModalPromocao'); if (tit) tit.textContent = 'Nova promoção';
  var b = document.getElementById('btnAdicionarPromocao'); if (b) b.textContent = 'Salvar promoção';
  atualizarTipoPromocao(); renderizarProdutosPromocao();
}
function resumirPromocao(p) {
  if (p.tipo === 'quantidade' && Array.isArray(p.faixas) && p.faixas.length) {
    var modo = p.quantidadeModo || 'a_cada';
    var pref = modo === 'a_partir' ? 'A partir de' : 'A cada';
    return pref + ' ' + p.faixas.map(function (f) { return f.quantidade + ' un. por R$ ' + (parseFloat(f.preco) || 0).toFixed(2); }).join(' · ');
  }
  if (p.tipo === 'percentual') return (parseFloat(p.valor) || 0) + '% de desconto';
  return 'Preço promocional: R$ ' + (parseFloat(p.valor) || 0).toFixed(2);
}
async function carregarPromocoes() {
  var container = document.getElementById('listaPromocoes'); if (!container) return;
  try {
    var snap = await db.collection('lojistas').doc(emailAtual).collection('promocoes').get();
    container.innerHTML = snap.docs.map(function (doc) {
      var p = doc.data();
      var tipo = resumirPromocao(p);
      var alvo = Array.isArray(p.produtoIds) ? p.produtoIds.length + ' produto(s)' : 'Sem produtos';
      var val = p.fim ? 'até ' + new Date(p.fim + 'T23:59:59').toLocaleDateString('pt-BR') : 'Sem validade final';
      var ativo = p.ativo !== 'nao';
      return '<div class="item-lista"><div><strong>' + escaparTextoPromocao(p.nome || 'Promoção') + '</strong><br><small>' + tipo + ' · ' + alvo + ' · ' + val + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch"><input type="checkbox" ' + (ativo ? 'checked' : '') + ' onchange="toggleAtivoPromocao(\'' + escaparTextoPromocao(doc.id) + '\', this.checked)"><span class="slider"></span></label> ' + (ativo ? 'Ativa' : 'Inativa') + '</div></div><div class="acoes"><button class="btn-pequeno" onclick="editarPromocao(\'' + escaparTextoPromocao(doc.id) + '\')">Editar</button><button class="btn-pequeno" onclick="duplicarPromocao(\'' + escaparTextoPromocao(doc.id) + '\')">Duplicar</button><button class="btn-pequeno" style="color:#dc2626" onclick="excluirPromocao(\'' + escaparTextoPromocao(doc.id) + '\')">Excluir</button></div></div>';
    }).join('') || '<p style="text-align:center;">Nenhuma promoção criada.</p>';
  } catch (e) { container.innerHTML = '<p style="text-align:center;">Não foi possível carregar as promoções.</p>'; }
}
function obterDadosFormularioPromocao() {
  var tipo = (document.getElementById('novoTipoPromocao') || {}).value || 'preco';
  var nome = ((document.getElementById('novoNomePromocao') || {}).value || '').trim();
  var prodIds = promocaoProdutosSelecionados.slice();
  var aplic = (document.getElementById('aplicacaoPromocao') || {}).value || 'todas';
  var modo = (document.getElementById('modoQuantidadePromocao') || {}).value || 'a_cada';
  var dados = { nome: nome, tipo: tipo, ativo: (promocaoEmEdicao && promocaoEmEdicao.ativo) || 'sim', inicio: (document.getElementById('novoInicioPromocao') || {}).value || null, fim: (document.getElementById('novoFimPromocao') || {}).value || null, produtoIds: prodIds, aplicacao: aplic, variacoes: aplic === 'especificas' ? promocaoVariacoesSelecionadas.slice() : [], quantidadeModo: tipo === 'quantidade' ? modo : null };
  if (tipo === 'quantidade') dados.faixas = obterFaixasPromocao();
  else dados.valor = parseFloat(document.getElementById('novoValorPromocao').value);
  return dados;
}
function validarPromocao(d) {
  if (!d.nome) return 'Informe o nome.';
  if (!d.produtoIds.length) return 'Selecione pelo menos um produto.';
  if (d.tipo === 'quantidade') { if (!d.faixas.length) return 'Adicione uma faixa.'; if (d.faixas.some(function (f) { return f.quantidade < 1 || f.preco < 0; })) return 'Revise as faixas.'; }
  else if (isNaN(d.valor) || d.valor <= 0 || (d.tipo === 'percentual' && d.valor > 100)) return 'Valor inválido.';
  if (d.aplicacao === 'especificas' && !d.variacoes.length) return 'Escolha pelo menos uma variação.';
  return null;
}
async function salvarPromocao() {
  var d = obterDadosFormularioPromocao();
  var err = validarPromocao(d);
  if (err) { EU.mostrarToast(err, 'erro'); return; }
  EU.showLoading(promocaoEmEdicao ? (promocaoEmEdicao.isDuplicar ? 'Duplicando...' : 'Salvando...') : 'Criando...');
  try {
    var ref = db.collection('lojistas').doc(emailAtual).collection('promocoes');
    if (promocaoEmEdicao && !promocaoEmEdicao.isDuplicar) { await ref.doc(promocaoEmEdicao.id).update(Object.assign({}, d, { atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() })); EU.mostrarToast('Promoção "' + d.nome + '" atualizada!', 'sucesso'); }
    else { d.criadoEm = firebase.firestore.FieldValue.serverTimestamp(); await ref.add(d); EU.mostrarToast(promocaoEmEdicao && promocaoEmEdicao.isDuplicar ? 'Promoção "' + d.nome + '" duplicada!' : 'Promoção "' + d.nome + '" criada!', 'sucesso'); }
    await carregarPromocoes(); limparFormularioPromocao(); fecharModalPromocaoLoja();
  } catch (e) { EU.mostrarToast(e.message, 'erro'); }
  finally { EU.hideLoading(); }
}
async function toggleAtivoPromocao(id, ativo) {
  try {
    await db.collection('lojistas').doc(emailAtual).collection('promocoes').doc(id).update({ ativo: ativo ? 'sim' : 'nao' });
    var doc = await db.collection('lojistas').doc(emailAtual).collection('promocoes').doc(id).get();
    var nome = doc.exists ? (doc.data().nome || '') : '';
    EU.mostrarToast(nome ? 'Promoção "' + nome + '" agora está ' + (ativo ? 'ativa' : 'inativa') + '.' : (ativo ? 'Promoção ativa!' : 'Promoção inativa.'), 'sucesso');
    await carregarPromocoes();
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); await carregarPromocoes(); }
}
async function excluirPromocao(id) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('promocoes').doc(id).get();
  var nome = doc.exists ? (doc.data().nome || 'esta promoção') : 'esta promoção';
  if (!confirm('Excluir a promoção "' + nome + '"? Essa ação não pode ser desfeita.')) return;
  try { await db.collection('lojistas').doc(emailAtual).collection('promocoes').doc(id).delete(); await carregarPromocoes(); EU.mostrarToast('Promoção "' + nome + '" removida.', 'sucesso'); } catch (e) { EU.mostrarToast(e.message, 'erro'); }
}
async function editarPromocao(id, isDuplicar) {
  try {
    var snap = await db.collection('lojistas').doc(emailAtual).collection('promocoes').doc(id).get();
    if (!snap.exists) return;
    var p = snap.data();
    alternarModoCampanha('promocao');
    await carregarProdutosParaPromocao();
    promocaoEmEdicao = { id: id, isDuplicar: !!isDuplicar, ativo: isDuplicar ? 'sim' : (p.ativo === 'nao' ? 'nao' : 'sim') };
    document.getElementById('novoNomePromocao').value = (p.nome || '') + (isDuplicar ? ' (cópia)' : '');
    document.getElementById('novoTipoPromocao').value = p.tipo || 'preco';
    var mq = document.getElementById('modoQuantidadePromocao'); if (mq) mq.value = p.quantidadeModo || 'a_cada';
    document.getElementById('novoValorPromocao').value = p.valor != null ? p.valor : '';
    document.getElementById('novoInicioPromocao').value = p.inicio || '';
    document.getElementById('novoFimPromocao').value = p.fim || '';
    promocaoProdutosSelecionados = Array.isArray(p.produtoIds) ? p.produtoIds.slice() : [];
    promocaoVariacoesSelecionadas = Array.isArray(p.variacoes) ? p.variacoes.slice() : [];
    var a = document.getElementById('aplicacaoPromocao'); if (a) a.value = p.aplicacao || 'todas';
    var faixas = document.getElementById('faixasPromocao'); if (faixas) { faixas.innerHTML = ''; (p.faixas || []).forEach(function (f) { adicionarFaixaPromocao(f); }); }
    document.getElementById('tituloModalPromocao').textContent = isDuplicar ? 'Duplicar promoção' : 'Editar promoção';
    atualizarTipoPromocao(); atualizarModoQuantidadePromocao(); renderizarProdutosPromocao();
    document.getElementById('btnAdicionarPromocao').textContent = isDuplicar ? 'Duplicar promoção' : 'Salvar alterações';
    abrirModalPromocaoLoja();
  } catch (e) { EU.mostrarToast('Não foi possível abrir: ' + e.message, 'erro'); }
}
function duplicarPromocao(id) { editarPromocao(id, true); }

/* ============================================================
   MESAS
   ============================================================ */
async function carregarMesas() {
  if (!emailAtual) return;
  var snapMesas = await db.collection('lojistas').doc(emailAtual).collection('mesas').get();
  var statusPorMesa = {};
  try {
    var pSnap = await db.collection('pedidos').where('estabelecimentoId', '==', estId).where('status', 'in', ['pendente','confirmado','em_preparo','saiu_entrega']).get();
    pSnap.forEach(function (d) {
      var dados = d.data();
      var n = dados.numeroMesa; if (n === null || n === undefined || n === '') return;
      var k = String(n);
      if (!statusPorMesa[k]) statusPorMesa[k] = { temP: false, temA: false };
      if (dados.status === 'pendente' || dados.status === 'confirmado') statusPorMesa[k].temP = true;
      if (dados.status === 'em_preparo' || dados.status === 'saiu_entrega') statusPorMesa[k].temA = true;
    });
  } catch (e) { console.warn(e.message); }
  var container = document.getElementById('listaMesas');
  var html = '<div style="display:flex; flex-wrap:wrap; gap:12px;">';
  snapMesas.docs.forEach(function (doc) {
    var m = doc.data();
    var st = statusPorMesa[String(m.numero)] || { temP: false, temA: false };
    var cor = st.temA ? '#fee2e2' : (st.temP ? '#fef3c7' : '#d1fae5');
    var statusTxt = st.temA ? 'Ocupada' : (st.temP ? 'Pendente' : 'Livre');
    html += '<div style="background:' + cor + '; padding:12px; border-radius:12px; text-align:center; width:100px; cursor:pointer;" onclick="verPedidosMesa(' + m.numero + ')"><strong>Mesa ' + m.numero + '</strong><br><small>' + statusTxt + '</small><div><button class="btn-pequeno" style="margin-top:8px;" onclick="event.stopPropagation(); gerarQRCodeMesa(' + m.numero + ')">QR</button> <button class="btn-pequeno" style="color:#dc2626" onclick="event.stopPropagation(); duplicarMesa(' + m.numero + ')">Duplicar</button> <button class="btn-pequeno" style="color:#dc2626" onclick="event.stopPropagation(); excluirMesa(\'' + doc.id + '\', ' + m.numero + ')">Excluir</button></div></div>';
  });
  container.innerHTML = html + '</div>';
}
async function excluirMesa(id, numero) {
  try {
    var snap = await db.collection('pedidos').where('estabelecimentoId', '==', estId).where('numeroMesa', '==', String(numero)).where('status', 'in', ['pendente','confirmado','em_preparo','saiu_entrega']).get();
    if (!snap.empty) { EU.mostrarToast('Essa mesa tem pedido em andamento.', 'erro'); return; }
  } catch (e) {}
  if (!confirm('Excluir a Mesa ' + numero + '? Essa ação não pode ser desfeita.')) return;
  await db.collection('lojistas').doc(emailAtual).collection('mesas').doc(id).delete();
  carregarMesas();
  EU.mostrarToast('Mesa ' + numero + ' removida.', 'sucesso');
}
async function verPedidosMesa(n) {
  var snap = await db.collection('pedidos').where('estabelecimentoId', '==', estId).where('numeroMesa', '==', n).orderBy('criadoEm', 'desc').get();
  if (snap.empty) return EU.mostrarToast('Nenhum pedido.', 'erro');
  var lista = snap.docs.map(function (d) { return '<div>#' + (d.data().codigoCurto || d.id.slice(0, 6)) + ' - R$ ' + (d.data().total || 0).toFixed(2) + ' - ' + d.data().status + '</div>'; }).join('');
  abrirModal('Pedidos da Mesa ' + n, lista);
}
function duplicarMesa(numero) {
  var n = Number.parseInt(numero, 10);
  var campo = document.getElementById('novaMesa'); if (!Number.isInteger(n) || !campo) return;
  campo.value = n + 1;
  var t = document.getElementById('tituloModalMesa'); if (t) t.textContent = 'Duplicar mesa';
  abrirModalCadastro('modalMesa');
  setTimeout(function () { campo.focus(); }, 50);
}
function gerarQRCodeMesa(n) {
  var url = 'https://www.economizeirioclaro.com.br/p/onde-comer_13.html?qr=' + estId + '&mesa=' + n;
  var qrUrl = EU.gerarImagemQRCode(url, 200);
  var win = window.open();
  win.document.write('<html><body style="text-align:center;"><h2>Mesa ' + n + '</h2><img src="' + qrUrl + '"><p>' + url + '</p><button onclick="window.print()">Imprimir</button></body></html>');
}

/* ============================================================
   MODAIS DE CADASTRO (abrir/fechar)
   ============================================================ */
function abrirModalSaborCadastro() { abrirModalCadastro('modalSabor'); setTimeout(function () { var e = document.getElementById('novoSaborNome'); if (e) e.focus(); }, 50); }
function fecharModalSaborCadastro() { fecharModalCadastro('modalSabor'); }
function abrirModalExtraCadastro() { abrirModalCadastro('modalExtra'); setTimeout(function () { var e = document.getElementById('novoExtraNome'); if (e) e.focus(); }, 50); }
function fecharModalExtraCadastro() { fecharModalCadastro('modalExtra'); }
function linhaTamanhoInicial() { return '<tr><td><input type="text" placeholder="Ex.: P" class="tam-nome"></td><td><input type="number" step="0.01" placeholder="0,00" class="tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>'; }
function linhaTamanhoPersonalizavelInicial() { return '<tr><td><input type="text" placeholder="Ex.: Pequeno" class="tam-perso-nome"></td><td><input type="number" placeholder="1" class="tam-perso-max" value="1"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>'; }
function linhaPrecoSaborInicial() { return '<tr><td><input type="text" placeholder="Ex.: G" class="sabor-tam-nome"></td><td><input type="number" step="0.01" placeholder="0,00" class="sabor-tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>'; }
function limparFormularioSaborCadastro() {
  ['novoSaborNome','novoSaborImagem','novoSaborDescricao','saborCategorias'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
  var a = document.getElementById('novoSaborImagemFile'); if (a) a.value = '';
  var p = document.getElementById('previewSaborImagem'); if (p) p.innerHTML = '';
  var pr = document.getElementById('listaPrecosSabor'); if (pr) pr.innerHTML = linhaPrecoSaborInicial();
  var t = document.getElementById('tituloModalSabor'); if (t) t.textContent = 'Novo sabor';
  var b = document.getElementById('btnAdicionarSabor'); if (b) { var s = b.querySelector('.btn-text'); if (s) s.textContent = 'Cadastrar sabor'; b.disabled = false; b.classList.remove('loading'); }
}
function limparFormularioExtraCadastro() {
  ['novoExtraNome','novoExtraPreco','novoExtraImagem','novoExtraDescricao','novoExtraTamanhos','extraCategorias'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; });
  var m = document.getElementById('novoExtraMax'); if (m) m.value = '1';
  var a = document.getElementById('novoExtraImagemFile'); if (a) a.value = '';
  var p = document.getElementById('previewExtraImagem'); if (p) p.innerHTML = '';
  var t = document.getElementById('tituloModalExtra'); if (t) t.textContent = 'Novo adicional';
  var b = document.getElementById('btnAdicionarExtra'); if (b) { var s = b.querySelector('.btn-text'); if (s) s.textContent = 'Cadastrar adicional'; b.disabled = false; b.classList.remove('loading'); }
}
function limparFormularioFreteCadastro() { ['novaLocalidade','novaTaxa'].forEach(function (id) { var e = document.getElementById(id); if (e) e.value = ''; }); var t = document.getElementById('tituloModalFrete'); if (t) t.textContent = 'Nova taxa de entrega'; }
function limparFormularioMesaCadastro() { var m = document.getElementById('novaMesa'); if (m) m.value = ''; var t = document.getElementById('tituloModalMesa'); if (t) t.textContent = 'Nova mesa'; }

document.getElementById('btnAdicionarSabor').onclick = async function () {
  var btn = this; btn.classList.add('loading'); btn.disabled = true;
  try {
    var nome = document.getElementById('novoSaborNome').value.trim();
    if (!nome) { EU.mostrarToast('Nome obrigatório.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
    var precos = coletarPrecosSabor();
    if (Object.keys(precos).length === 0) { EU.mostrarToast('Adicione um tamanho com preço.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
    await db.collection('lojistas').doc(emailAtual).collection('sabores').add({ nome: nome, precos: precos, imagem: document.getElementById('novoSaborImagem').value.trim(), descricao: document.getElementById('novoSaborDescricao').value.trim(), categorias: document.getElementById('saborCategorias').value.trim(), disponivel: 'sim' });
    await carregarSabores();
    if (document.getElementById('tipoProduto').value === 'personalizavel') { await carregarSaboresCheckboxes(document.getElementById('novoItemCategoria').value.trim()); verificarAvisoSemSabores(); }
    fecharModalSaborCadastro(); limparFormularioSaborCadastro();
    EU.mostrarToast('Sabor "' + nome + '" salvo!', 'sucesso');
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
};
document.getElementById('btnAdicionarExtra').onclick = async function () {
  var btn = this; btn.classList.add('loading'); btn.disabled = true;
  try {
    var nome = document.getElementById('novoExtraNome').value.trim();
    if (!nome) { EU.mostrarToast('Nome obrigatório.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
    var preco = parseFloat(document.getElementById('novoExtraPreco').value);
    if (isNaN(preco) || preco < 0) { EU.mostrarToast('Preço inválido.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
    await db.collection('lojistas').doc(emailAtual).collection('extras').add({ nome: nome, preco: preco, descricao: document.getElementById('novoExtraDescricao').value.trim(), max: parseInt(document.getElementById('novoExtraMax').value) || 0, categorias: document.getElementById('extraCategorias').value.trim(), imagem: document.getElementById('novoExtraImagem').value.trim(), disponivel: 'sim' });
    await carregarExtras();
    fecharModalExtraCadastro(); limparFormularioExtraCadastro();
    EU.mostrarToast('Adicional "' + nome + '" salvo!', 'sucesso');
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
};
document.getElementById('btnAdicionarFrete').onclick = async function () {
  var l = document.getElementById('novaLocalidade').value.trim();
  var t = parseFloat(document.getElementById('novaTaxa').value);
  if (!l || isNaN(t) || t < 0) { EU.mostrarToast('Preencha localidade e taxa.', 'erro'); return; }
  EU.showLoading('Salvando...');
  try { await db.collection('lojistas').doc(emailAtual).collection('fretes').add({ localidade: l, taxa: t, ativo: 'sim' }); fecharModalCadastro('modalFrete'); limparFormularioFreteCadastro(); carregarFretes(); EU.mostrarToast('Taxa "' + l + '" salva!', 'sucesso'); }
  catch (e) { EU.mostrarToast(e.message, 'erro'); }
  finally { EU.hideLoading(); }
};
document.getElementById('btnAdicionarMesa').onclick = async function () {
  var n = Number.parseInt(document.getElementById('novaMesa').value, 10);
  if (!Number.isInteger(n) || n < 1) { EU.mostrarToast('Número inválido.', 'erro'); return; }
  var ref = db.collection('lojistas').doc(emailAtual).collection('mesas').doc('mesa_' + n);
  try {
    if ((await ref.get()).exists) { EU.mostrarToast('Mesa já cadastrada.', 'erro'); return; }
    await ref.set({ numero: n, status: 'livre' });
    fecharModalCadastro('modalMesa'); limparFormularioMesaCadastro(); await carregarMesas();
    EU.mostrarToast('Mesa ' + n + ' adicionada!', 'sucesso');
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
};
document.getElementById('btnAdicionarCupom').onclick = salvarCupomLoja;
document.getElementById('btnAdicionarPromocao').onclick = salvarPromocao;

/* ============================================================
   MODAL GENÉRICO
   ============================================================ */
function abrirModal(titulo, conteudo) {
  var m = document.createElement('div'); m.className = 'modal-overlay active';
  m.innerHTML = '<div class="modal-conteudo"><div class="modal-header"><h3>' + titulo + '</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div><div class="modal-body">' + conteudo + '</div></div>';
  document.body.appendChild(m);
}
function mostrarPedidosPeriodo() { if (!pedidosAtuais.length) return EU.mostrarToast('Nenhum pedido.', 'erro'); var lista = pedidosAtuais.map(function (p) { return '<div onclick="verDetalhesPedido(\'' + p.id + '\')">#' + (p.codigoCurto || p.id.slice(0, 6)) + ' - R$ ' + (p.total || 0).toFixed(2) + ' - ' + p.clienteNome + '</div>'; }).join(''); abrirModal('Lista de Pedidos', lista); }
function mostrarRankingVendas() { if (!rankingVendas.length) return EU.mostrarToast('Nenhuma venda.', 'erro'); var lista = rankingVendas.map(function (r, i) { return '<div>' + (i + 1) + 'º ' + r[0] + ' - ' + r[1] + ' vendidos</div>'; }).join(''); abrirModal('Itens Mais Vendidos', lista); }
function mostrarPedidoMaisCaro() { if (!pedidosAtuais.length) return; var mais = pedidosAtuais.slice().sort(function (a, b) { return (b.total || 0) - (a.total || 0); })[0]; abrirModal('Maior Venda', '<div><h3>#' + (mais.codigoCurto || mais.id.slice(0, 6)) + '</h3><p>R$ ' + (mais.total || 0).toFixed(2) + '</p><p>Cliente: ' + mais.clienteNome + '</p><button class="btn-primary" onclick="verDetalhesPedido(\'' + mais.id + '\')">Ver Pedido</button></div>'); }
function verDetalhesPedido(id) { var el = document.querySelector('.pedido-card[data-id="' + id + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.querySelectorAll('.modal-overlay').forEach(function (m) { m.remove(); }); }
function toggleCollapse(headerElement, contentId) {
  var content = document.getElementById(contentId);
  var btn = headerElement.querySelector('.collapse-btn');
  if (!content || !btn) return;
  if (content.classList.contains('open')) { content.classList.remove('open'); btn.innerHTML = '+'; btn.setAttribute('aria-label', 'Expandir'); headerElement.setAttribute('aria-expanded', 'false'); }
  else { content.classList.add('open'); btn.innerHTML = '\u2212'; btn.setAttribute('aria-label', 'Recolher'); headerElement.setAttribute('aria-expanded', 'true'); }
}

/* ============================================================
   TABS
   ============================================================ */
document.querySelectorAll('.tab-principal').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var t = this.dataset.tab;
    document.querySelectorAll('.tab-principal').forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
    this.classList.add('active'); this.setAttribute('aria-selected', 'true');
    document.querySelectorAll('.tab-painel').forEach(function (p) { p.classList.remove('active'); });
    var alvo = document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1));
    if (alvo) alvo.classList.add('active');
    if (t === 'itens') { carregarCardapio(); carregarSabores(); carregarExtras(); }
    if (t === 'entrega') carregarFretes();
    if (t === 'campanhas') { carregarCupons(); carregarPromocoes(); carregarProdutosParaPromocao(); }
    if (t === 'mesas') carregarMesas();
  });
});

/* ============================================================
   BOOTSTRAP DE MODAIS
   ============================================================ */
(function configurarModais() {
  var b1 = document.getElementById('btnNovoProduto'); if (b1) b1.addEventListener('click', async function () { resetarFormularioProdutoLoja(); await toggleTipoProduto(); abrirModalCadastro('modalProduto'); setTimeout(function () { var el = document.getElementById('novoItemNome'); if (el) el.focus(); }, 50); });
  var b2 = document.getElementById('btnNovoSabor'); if (b2) b2.addEventListener('click', function () { limparFormularioSaborCadastro(); abrirModalSaborCadastro(); });
  var b3 = document.getElementById('btnNovoExtra'); if (b3) b3.addEventListener('click', function () { limparFormularioExtraCadastro(); abrirModalExtraCadastro(); });
  var b4 = document.getElementById('btnNovoFrete'); if (b4) b4.addEventListener('click', function () { limparFormularioFreteCadastro(); abrirModalCadastro('modalFrete'); setTimeout(function () { var el = document.getElementById('novaLocalidade'); if (el) el.focus(); }, 50); });
  var b5 = document.getElementById('btnNovaMesa'); if (b5) b5.addEventListener('click', function () { limparFormularioMesaCadastro(); abrirModalCadastro('modalMesa'); setTimeout(function () { var el = document.getElementById('novaMesa'); if (el) el.focus(); }, 50); });
  var b6 = document.getElementById('btnNovoCupom'); if (b6) b6.addEventListener('click', function () { limparFormularioCupom(); abrirModalCupomLoja(); });
  var b7 = document.getElementById('btnNovaPromocao'); if (b7) b7.addEventListener('click', async function () { alternarModoCampanha('promocao'); limparFormularioPromocao(); await carregarProdutosParaPromocao(); abrirModalPromocaoLoja(); });
  var m1 = document.getElementById('btnModoCupom'); if (m1) m1.addEventListener('click', function () { alternarModoCampanha('cupom'); });
  var m2 = document.getElementById('btnModoPromocao'); if (m2) m2.addEventListener('click', function () { alternarModoCampanha('promocao'); });
  var t1 = document.getElementById('novoTipoPromocao'); if (t1) t1.addEventListener('change', atualizarTipoPromocao);
  var t2 = document.getElementById('modoQuantidadePromocao'); if (t2) t2.addEventListener('change', atualizarModoQuantidadePromocao);
  var t3 = document.getElementById('buscaProdutosPromocao'); if (t3) t3.addEventListener('input', renderizarProdutosPromocao);
  var t4 = document.getElementById('limparBuscaProdutosPromocao'); if (t4) t4.addEventListener('click', function () { var b = document.getElementById('buscaProdutosPromocao'); if (b) b.value = ''; renderizarProdutosPromocao(); if (b) b.focus(); });
  var t5 = document.getElementById('aplicacaoPromocao'); if (t5) t5.addEventListener('change', atualizarAplicacaoVariacoesPromocao);
  var t6 = document.getElementById('btnAdicionarFaixaPromocao'); if (t6) t6.addEventListener('click', function () { adicionarFaixaPromocao(); });
  ['btnFecharProdutoModal','btnCancelarProdutoModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalCadastro('modalProduto'); resetarFormularioProdutoLoja(); }); });
  ['btnFecharSaborModal','btnCancelarSaborModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalSaborCadastro(); limparFormularioSaborCadastro(); }); });
  ['btnFecharExtraModal','btnCancelarExtraModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalExtraCadastro(); limparFormularioExtraCadastro(); }); });
  ['btnFecharFreteModal','btnCancelarFreteModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalCadastro('modalFrete'); limparFormularioFreteCadastro(); }); });
  ['btnFecharMesaModal','btnCancelarMesaModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalCadastro('modalMesa'); limparFormularioMesaCadastro(); }); });
  ['btnFecharCupomModal','btnCancelarCupomModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalCupomLoja(); limparFormularioCupom(); }); });
  ['btnFecharPromocaoModal','btnCancelarPromocaoModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalPromocaoLoja(); limparFormularioPromocao(); }); });
  ['modalProduto','modalSabor','modalExtra','modalFrete','modalCupom','modalPromocao','modalMesa'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function (e) { if (e.target.id === id) fecharModalCadastro(id); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    ['modalProduto','modalSabor','modalExtra','modalFrete','modalCupom','modalPromocao','modalMesa'].forEach(function (id) { var el = document.getElementById(id); if (el && el.classList.contains('active')) fecharModalCadastro(id); });
  });
})();

inicializarAutoAddLinha('listaTamanhosAdicionar', function () { adicionarLinhaTamanho('listaTamanhosAdicionar'); atualizarPreviewProdutoLoja(); });
inicializarAutoAddLinha('listaTamanhosPerso', function () { adicionarLinhaTamanho('listaTamanhosPerso'); atualizarPreviewProdutoLoja(); });
inicializarAutoAddLinha('listaPrecosSabor', function () { adicionarLinhaPrecoSabor(); });

/* ============================================================
   EXPOSIÇÃO GLOBAL
   ============================================================ */
window.toggleTipoProduto = toggleTipoProduto;
window.selecionarTipoProduto = selecionarTipoProduto;
window.atualizarCheckboxesPorCategoria = atualizarCheckboxesPorCategoria;
window.garantirCheckboxesSaboresInterativos = garantirCheckboxesSaboresInterativos;
window.adicionarLinhaTamanho = adicionarLinhaTamanho;
window.adicionarLinhaPrecoSabor = adicionarLinhaPrecoSabor;
window.removerLinhaTamanho = removerLinhaTamanho;
window.atualizarStatus = atualizarStatus;
window.excluirPedido = excluirPedido;
window.imprimirTicket = imprimirTicket;
window.falarComCliente = falarComCliente;
window.compartilharMotoboy = compartilharMotoboy;
window.abrirModalEditarProduto = abrirModalEditarProduto;
window.duplicarProduto = duplicarProduto;
window.uploadImagensProduto = uploadImagensProduto;
window.uploadImagemSabor = uploadImagemSabor;
window.uploadImagemExtra = uploadImagemExtra;
window.carregarSaboresCheckboxes = carregarSaboresCheckboxes;
window.carregarExtrasCheckboxes = carregarExtrasCheckboxes;
window.limparErroSabores = limparErroSabores;
window.toggleEstoqueIlimitado = toggleEstoqueIlimitado;
window.irParaCadastroSabor = irParaCadastroSabor;
window.verificarAvisoSemSabores = verificarAvisoSemSabores;
window.atualizarPreviewProdutoLoja = atualizarPreviewProdutoLoja;
window.removerImagemExtra = removerImagemExtra;
window.abrirModalCadastro = abrirModalCadastro;
window.fecharModalCadastro = fecharModalCadastro;
window.mostrarPedidosPeriodo = mostrarPedidosPeriodo;
window.mostrarRankingVendas = mostrarRankingVendas;
window.mostrarPedidoMaisCaro = mostrarPedidoMaisCaro;
window.carregarCardapio = carregarCardapio;
window.gerarQRCodeMesa = gerarQRCodeMesa;
window.editarSaborModal = editarSaborModal;
window.editarExtraModal = editarExtraModal;
window.toggleDisponibilidadeProduto = toggleDisponibilidadeProduto;
window.excluirItemCardapio = excluirItemCardapio;
window.toggleDisponibilidadeSabor = toggleDisponibilidadeSabor;
window.excluirSabor = excluirSabor;
window.duplicarSabor = duplicarSabor;
window.toggleDisponibilidadeExtra = toggleDisponibilidadeExtra;
window.excluirExtra = excluirExtra;
window.duplicarExtra = duplicarExtra;
window.toggleAtivoFrete = toggleAtivoFrete;
window.editarFreteModal = editarFreteModal;
window.duplicarFrete = duplicarFrete;
window.excluirFrete = excluirFrete;
window.toggleAtivoCupom = toggleAtivoCupom;
window.editarCupomModal = editarCupomModal;
window.duplicarCupom = duplicarCupom;
window.excluirCupom = excluirCupom;
window.toggleAtivoPromocao = toggleAtivoPromocao;
window.editarPromocao = editarPromocao;
window.duplicarPromocao = duplicarPromocao;
window.excluirPromocao = excluirPromocao;
window.excluirMesa = excluirMesa;
window.verPedidosMesa = verPedidosMesa;
window.duplicarMesa = duplicarMesa;
window.verDetalhesPedido = verDetalhesPedido;
window.toggleCollapse = toggleCollapse;
window.adicionarFaixaPromocao = adicionarFaixaPromocao;
window.atualizarTipoPromocao = atualizarTipoPromocao;

/* ============================================================
   AUTH + INÍCIO
   ============================================================ */
Auth.iniciar({
  tipo: 'lojista',
  contexto: 'pedidos',
  prefixosEsperados: PREFIXOS_PEDIDOS,
  aoEntrar: function (user, dados) {
    emailAtual = user.email;
    estId = dados.estabelecimentoId;

    document.getElementById('periodoSelect').addEventListener('change', carregarPedidos);
    document.getElementById('statusFiltroSelect').addEventListener('change', carregarPedidos);
    document.getElementById('ordemSelect').addEventListener('change', carregarPedidos);
    document.getElementById('tipoPedidoFiltro').addEventListener('change', carregarPedidos);

    carregarPedidos();
    Promise.all([
      carregarCardapio(),
      carregarSabores(),
      carregarExtras(),
      carregarFretes(),
      carregarCupons(),
      carregarMesas(),
      carregarSaboresCheckboxes()
    ]).then(function () {
      toggleTipoProduto();
      atualizarPreviewProdutoLoja();
      // Transição: esconde overlay quando tudo carregou
      if (window.EconomizeiPainel && EconomizeiPainel.Transicao) {
        setTimeout(function () { EconomizeiPainel.Transicao.esconderOverlay(); }, 300);
      }
    });
  }
});

})();
