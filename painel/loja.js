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
var PREFIXOS_LOJA = Loj.PREFIXOS.loja;

var emailAtual = '';
var estId = '';
var unsubscribePedidos = null;
var pedidosVistos = null;
var pedidosAtuais = [];
var rankingVendas = [];
var promocoesCache = [];
var fretesCache = [];
var produtosPromocaoCache = [];
var promocaoProdutosSelecionados = [];
var promocaoVariacoesSelecionadas = [];
var promocaoEmEdicao = null;
var cupomEmEdicao = null;
var produtoEmEdicao = null;
var imagensExtrasUrls = [];
var atributosTemp = [];
var variacoesTemp = [];
var previewVariacoesSelecionadas = {};

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
function uploadImagemProduto(input) { if (input.files && input.files[0]) uploadImagem(input.files[0], 'novoItemImagem', 'previewItemImagem'); }

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

async function uploadImagensVariacao(input, idx) {
  var files = Array.from(input.files || []);
  if (!files.length || !variacoesTemp[idx]) return;
  EU.showLoading(files.length > 1 ? 'Enviando imagens da variação...' : 'Enviando imagem da variação...');
  try {
    var urls = [];
    for (var i = 0; i < files.length; i++) urls.push(await enviarImagemCloudinary(files[i]));
    variacoesTemp[idx].imagens = Array.isArray(variacoesTemp[idx].imagens) ? variacoesTemp[idx].imagens : [];
    variacoesTemp[idx].imagens.push.apply(variacoesTemp[idx].imagens, urls);
    variacoesTemp[idx].imagem = variacoesTemp[idx].imagens[0] || '';
    renderizarVariacoes();
    atualizarPreviewProdutoLoja();
    EU.mostrarToast('Imagem adicionada à variação!', 'sucesso');
  } catch (e) { EU.mostrarToast('Erro ao enviar imagem: ' + e.message, 'erro'); }
  finally { EU.hideLoading(); }
}

/* ============================================================
   IMAGENS DO PRODUTO
   ============================================================ */
function obterImagensProduto() {
  var principal = (document.getElementById('novoItemImagem') && document.getElementById('novoItemImagem').value || '').trim();
  var urlsManuais = (document.getElementById('novoItemImagensUrl') && document.getElementById('novoItemImagensUrl').value || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  var todas = [principal].concat(imagensExtrasUrls, urlsManuais).filter(Boolean);
  var unicas = [];
  todas.forEach(function (u) { if (unicas.indexOf(u) === -1) unicas.push(u); });
  return unicas;
}
function atualizarImagensProdutoPorUrl() { atualizarPreviewImagensExtras(); }
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
  var urls = document.getElementById('novoItemImagensUrl');
  if (principal) principal.value = imagens.shift() || '';
  imagensExtrasUrls = imagens;
  if (urls) urls.value = '';
  atualizarPreviewImagensExtras();
  atualizarPreviewProdutoLoja();
}

/* ============================================================
   ATRIBUTOS E VARIAÇÕES
   ============================================================ */
function adicionarAtributo() {
  var nome = document.getElementById('novoAtributoNome').value.trim();
  var opcoesStr = document.getElementById('novoAtributoOpcoes').value.trim();
  if (!nome) { EU.mostrarToast('Digite o nome da variação.', 'erro'); return; }
  if (!opcoesStr) { EU.mostrarToast('Digite as opções separadas por vírgula.', 'erro'); return; }
  var opcoes = opcoesStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (opcoes.length === 0) { EU.mostrarToast('Nenhuma opção válida.', 'erro'); return; }
  if (atributosTemp.some(function (a) { return a.nome === nome; })) { EU.mostrarToast('Variação com este nome já existe.', 'erro'); return; }
  atributosTemp.push({ nome: nome, opcoes: opcoes });
  renderizarAtributos();
  atualizarPreviewProdutoLoja();
  document.getElementById('novoAtributoNome').value = '';
  document.getElementById('novoAtributoOpcoes').value = '';
  EU.mostrarToast('Variação "' + nome + '" adicionada!', 'sucesso');
}
function removerAtributo(nome) {
  atributosTemp = atributosTemp.filter(function (a) { return a.nome !== nome; });
  renderizarAtributos();
  variacoesTemp = [];
  previewVariacoesSelecionadas = {};
  document.getElementById('variacoesContainer').style.display = 'none';
  atualizarPreviewProdutoLoja();
}
function renderizarAtributos() {
  var container = document.getElementById('atributosLista');
  if (!container) return;
  container.innerHTML = atributosTemp.map(function (attr) {
    return '<div class="atributo-item">' +
      '<strong>' + EU.sanitize(attr.nome) + '</strong>' +
      '<span style="color:var(--text-muted);">(' + EU.sanitize(attr.opcoes.join(', ')) + ')</span>' +
      '<button class="remove-attr" onclick="removerAtributo(\'' + EU.sanitize(attr.nome) + '\')">×</button>' +
    '</div>';
  }).join('');
}
function gerarVariacoes() {
  if (atributosTemp.length === 0) { EU.mostrarToast('Adicione pelo menos uma variação.', 'erro'); return; }
  var combos = atributosTemp.reduce(function (acc, attr) {
    if (acc.length === 0) return attr.opcoes.map(function (o) { var c = {}; c[attr.nome] = o; return c; });
    var novas = [];
    acc.forEach(function (combo) {
      attr.opcoes.forEach(function (op) {
        var novo = Object.assign({}, combo);
        novo[attr.nome] = op;
        novas.push(novo);
      });
    });
    return novas;
  }, []);
  variacoesTemp = combos.map(function (combo) {
    return { atributos: combo, preco: '', estoque: '', sku: '', imagem: '', imagens: [] };
  });
  renderizarVariacoes();
  document.getElementById('variacoesContainer').style.display = 'block';
  atualizarPreviewProdutoLoja();
}
function renderMiniaturasVariacao(imagens, idx, modo) {
  var lista = Array.isArray(imagens) ? imagens : (imagens ? [imagens] : []);
  var remover = modo === 'edit' ? 'removerImagemVariacaoEdit' : 'removerImagemVariacao';
  return lista.map(function (url, imagemIdx) {
    return '<span class="variacao-imagem-mini"><img src="' + url + '" alt="Imagem ' + (imagemIdx + 1) + '"><button type="button" onclick="' + remover + '(' + idx + ', ' + imagemIdx + ')" aria-label="Remover imagem">×</button></span>';
  }).join('');
}
function removerImagemVariacao(idx, imagemIdx) {
  if (!variacoesTemp[idx]) return;
  variacoesTemp[idx].imagens = (variacoesTemp[idx].imagens || []).filter(function (_, i) { return i !== imagemIdx; });
  variacoesTemp[idx].imagem = variacoesTemp[idx].imagens[0] || '';
  renderizarVariacoes();
  atualizarPreviewProdutoLoja();
}
function escaparVariacao(valor) { return EU.sanitize(valor); }
function obterTiposVariacao() {
  var cadastrados = atributosTemp.map(function (a) { return a.nome; }).filter(Boolean);
  var dosDados = variacoesTemp.flatMap(function (v) { return Object.keys(v.atributos || {}); });
  var unicos = [];
  cadastrados.concat(dosDados).forEach(function (t) { if (unicos.indexOf(t) === -1) unicos.push(t); });
  return unicos;
}
function obterTipoAgrupamentoVariacao() {
  var tipos = obterTiposVariacao();
  var seletor = document.getElementById('variacoesAgruparPor');
  if (!seletor || !tipos.length) return tipos[0] || '';
  var selecionado = tipos.indexOf(seletor.value) !== -1 ? seletor.value : tipos[0];
  seletor.innerHTML = tipos.map(function (tipo) { return '<option value="' + escaparVariacao(tipo) + '">' + escaparVariacao(tipo) + '</option>'; }).join('');
  seletor.value = selecionado;
  return selecionado;
}
function resumoVariacao(v) {
  var preco = parseFloat(v.preco);
  var estoque = String(v.estoque == null ? '' : v.estoque).trim();
  var imagens = Array.isArray(v.imagens) ? v.imagens : (v.imagem ? [v.imagem] : []);
  var partes = [];
  partes.push(!isNaN(preco) ? 'R$ ' + preco.toFixed(2).replace('.', ',') : 'Sem preço');
  partes.push(estoque === '' ? 'Ilimitado' : escaparVariacao(estoque) + ' un.');
  if (imagens.length) partes.push(imagens.length + ' foto' + (imagens.length === 1 ? '' : 's'));
  return partes.join(' · ');
}
function detalhesVariacaoHtml(v, idx, tipoAgrupamento) {
  var imagens = Array.isArray(v.imagens) ? v.imagens : (v.imagem ? [v.imagem] : []);
  var outrosAtributos = Object.entries(v.atributos || {}).filter(function (entry) { return entry[0] !== tipoAgrupamento; });
  var preco = escaparVariacao(v.preco);
  var estoque = escaparVariacao(v.estoque);
  var sku = escaparVariacao(v.sku);
  var urls = escaparVariacao(imagens.join(','));
  var atributosHtml = outrosAtributos.length ? '<div class="variacao-atributos-secundarios">' + outrosAtributos.map(function (entry) { return '<span class="variacao-atributo-chip"><strong>' + escaparVariacao(entry[0]) + ':</strong> ' + escaparVariacao(entry[1]) + '</span>'; }).join('') + '</div>' : '';
  return atributosHtml +
    '<div class="variacao-campo-editor"><label for="variacaoPreco_' + idx + '">Preço (R$)</label>' +
    '<input type="number" id="variacaoPreco_' + idx + '" step="0.01" min="0" value="' + preco + '" oninput="variacoesTemp[' + idx + '].preco = this.value"></div>' +
    '<div class="variacao-campo-editor"><label for="variacaoEstoque_' + idx + '">Estoque</label>' +
    '<input type="number" id="variacaoEstoque_' + idx + '" min="0" step="1" value="' + estoque + '" placeholder="Ilimitado" oninput="variacoesTemp[' + idx + '].estoque = this.value"></div>' +
    '<div class="variacao-campo-editor"><label for="variacaoSku_' + idx + '">SKU</label>' +
    '<input type="text" id="variacaoSku_' + idx + '" value="' + sku + '" placeholder="SKU" oninput="variacoesTemp[' + idx + '].sku = this.value.toUpperCase()"></div>' +
    '<div class="variacao-imagens-editor"><div class="variacao-campo-editor"><label>Imagens da opção</label>' +
    '<div class="variacao-imagens-celula">' +
    '<input type="file" id="variacaoImagemFile_' + idx + '" accept="image/*" multiple onchange="uploadImagensVariacao(this, ' + idx + ')">' +
    '<label class="btn-variacao-imagem" for="variacaoImagemFile_' + idx + '"><i class="fas fa-images" aria-hidden="true"></i> Adicionar fotos</label>' +
    '<div class="variacoes-imagens-lista">' + renderMiniaturasVariacao(imagens, idx, 'novo') + '</div>' +
    '<input type="text" value="' + urls + '" placeholder="URLs separadas por vírgula" aria-label="URLs das imagens da variação" onchange="variacoesTemp[' + idx + '].imagens = this.value.split(\',\').map(function(s){return s.trim();}).filter(Boolean); variacoesTemp[' + idx + '].imagem = variacoesTemp[' + idx + '].imagens[0] || \'\'; renderizarVariacoes()">' +
    '</div></div></div>' +
    '<div class="variacao-acoes-editor"><button type="button" class="btn-repetir-dados" onclick="abrirModalRepetirDados(' + idx + ')"><i class="fas fa-copy" aria-hidden="true"></i> Repetir dados</button></div>';
}

var variacaoOrigemRepetir = null;
function rotuloVariacaoRepetirDados(variacao) {
  return Object.entries((variacao && variacao.atributos) || {}).map(function (entry) { return entry[0] + ': ' + entry[1]; }).join(' / ') || 'Variação sem nome';
}
function imagensDaVariacaoRepetirDados(variacao) {
  if (!variacao) return [];
  return Array.isArray(variacao.imagens) ? variacao.imagens.filter(Boolean) : (variacao.imagem ? [variacao.imagem] : []);
}
function destinosCompativeisRepetirDados(origemIdx) {
  var origem = variacoesTemp[origemIdx];
  if (!origem) return [];
  var tipos = Object.keys(origem.atributos || {});
  var tipoPrincipal = obterTipoAgrupamentoVariacao() || tipos[0] || '';
  var tiposContexto = tipos.filter(function (tipo) { return tipo !== tipoPrincipal; });
  return variacoesTemp.map(function (variacao, idx) { return { variacao: variacao, idx: idx }; })
    .filter(function (item) {
      if (item.idx === origemIdx) return false;
      return tiposContexto.every(function (tipo) {
        return String((item.variacao.atributos && item.variacao.atributos[tipo]) || '') === String((origem.atributos && origem.atributos[tipo]) || '');
      });
    });
}
function abrirModalRepetirDados(origemIdx) {
  var origem = variacoesTemp[origemIdx];
  var modal = document.getElementById('modalRepetirDados');
  var fonte = document.getElementById('repetirDadosFonte');
  var destinos = document.getElementById('repetirDadosDestinos');
  var ajuda = document.getElementById('repetirDadosDestinoAjuda');
  var btnAplicar = document.getElementById('btnAplicarRepetirDados');
  var checkPreco = document.getElementById('repetirDadosPreco');
  var checkImagens = document.getElementById('repetirDadosImagens');
  if (!origem || !modal || !fonte || !destinos) return;
  variacaoOrigemRepetir = origemIdx;
  var imagens = imagensDaVariacaoRepetirDados(origem);
  var temPreco = origem.preco !== '' && origem.preco != null && !isNaN(parseFloat(origem.preco));
  var temImagens = imagens.length > 0;
  fonte.innerHTML = '<strong>Dados da variação de origem</strong>' + escaparVariacao(rotuloVariacaoRepetirDados(origem)) + '<br><span>' + (temPreco ? 'Preço: R$ ' + parseFloat(origem.preco).toFixed(2).replace('.', ',') : 'Preço ainda não preenchido') + ' · ' + (temImagens ? imagens.length + ' imagem' + (imagens.length === 1 ? '' : 'ns') : 'Sem imagens') + '</span>';
  if (checkPreco) { checkPreco.checked = temPreco; checkPreco.disabled = !temPreco; }
  if (checkImagens) { checkImagens.checked = temImagens; checkImagens.disabled = !temImagens; }
  var candidatos = destinosCompativeisRepetirDados(origemIdx);
  if (ajuda) ajuda.textContent = candidatos.length ? 'As opções abaixo mantêm as demais características iguais à variação de origem.' : 'Não existem outras opções compatíveis para receber esses dados.';
  destinos.innerHTML = candidatos.length ? candidatos.map(function (item) {
    return '<label class="repetir-dados-destino"><input type="checkbox" data-repetir-destino="' + item.idx + '" checked><span>' + escaparVariacao(rotuloVariacaoRepetirDados(item.variacao)) + '<small>Estoque e SKU serão mantidos</small></span></label>';
  }).join('') : '<div class="repetir-dados-vazio">Cadastre ou gere outra opção compatível para poder repetir os dados.</div>';
  if (btnAplicar) btnAplicar.disabled = !candidatos.length || (!temPreco && !temImagens);
  modal.classList.add('active');
}
function selecionarTodosRepetirDados(marcar) {
  document.querySelectorAll('#repetirDadosDestinos input[data-repetir-destino]').forEach(function (input) { input.checked = marcar; });
}
function fecharModalRepetirDados() {
  var modal = document.getElementById('modalRepetirDados');
  if (modal) modal.classList.remove('active');
  variacaoOrigemRepetir = null;
}
function aplicarRepetirDados() {
  var origem = variacoesTemp[variacaoOrigemRepetir];
  if (!origem) return;
  var repetirPreco = document.getElementById('repetirDadosPreco') && document.getElementById('repetirDadosPreco').checked;
  var repetirImagens = document.getElementById('repetirDadosImagens') && document.getElementById('repetirDadosImagens').checked;
  var destinos = Array.from(document.querySelectorAll('#repetirDadosDestinos input[data-repetir-destino]:checked')).map(function (input) { return Number(input.dataset.repetirDestino); });
  if (!repetirPreco && !repetirImagens) { EU.mostrarToast('Escolha pelo menos um dado para repetir.', 'erro'); return; }
  if (!destinos.length) { EU.mostrarToast('Selecione pelo menos uma opção de destino.', 'erro'); return; }
  var imagens = imagensDaVariacaoRepetirDados(origem);
  destinos.forEach(function (idx) {
    var destino = variacoesTemp[idx];
    if (!destino) return;
    if (repetirPreco) destino.preco = origem.preco;
    if (repetirImagens) { destino.imagens = imagens.slice(); destino.imagem = destino.imagens[0] || ''; }
  });
  fecharModalRepetirDados();
  renderizarVariacoes();
  atualizarPreviewProdutoLoja();
  EU.mostrarToast('Dados repetidos em ' + destinos.length + ' opção' + (destinos.length === 1 ? '' : 'ões') + '!', 'sucesso');
}
function filtrarVariacoesVisual() {
  var termo = ((document.getElementById('buscaVariacoes') || {}).value || '').trim().toLowerCase();
  document.querySelectorAll('#variacoesGrupos .variacoes-tipo-grupo').forEach(function (grupo) {
    var visiveis = 0;
    grupo.querySelectorAll('.variacao-opcao-card').forEach(function (opcao) {
      var corresponde = !termo || (opcao.dataset.busca || '').toLowerCase().indexOf(termo) !== -1;
      opcao.style.display = corresponde ? '' : 'none';
      if (corresponde) visiveis += 1;
    });
    grupo.style.display = visiveis ? '' : 'none';
  });
}
function renderizarVariacoes() {
  var grupos = document.getElementById('variacoesGrupos');
  if (!grupos) return;
  var tipoAgrupamento = obterTipoAgrupamentoVariacao();
  var resumo = document.getElementById('variacoesResumo');
  if (resumo) resumo.textContent = variacoesTemp.length === 1 ? '1 combinação gerada' : variacoesTemp.length + ' combinações geradas';
  if (!variacoesTemp.length || !tipoAgrupamento) {
    grupos.innerHTML = '<div class="variacoes-vazio-filtro">Gere as variações para configurar preço, estoque e imagens.</div>';
    return;
  }
  var opcoesPorTipo = new Map();
  variacoesTemp.forEach(function (v, idx) {
    var opcao = (v.atributos && v.atributos[tipoAgrupamento]) || 'Sem opção';
    if (!opcoesPorTipo.has(opcao)) opcoesPorTipo.set(opcao, []);
    opcoesPorTipo.get(opcao).push({ v: v, idx: idx });
  });
  var opcoesHtml = Array.from(opcoesPorTipo.entries()).map(function (entry) {
    var opcao = entry[0], itens = entry[1];
    var quantidade = itens.length;
    var completos = itens.filter(function (item) { return item.v.preco !== '' && !isNaN(parseFloat(item.v.preco)); }).length;
    var busca = escaparVariacao([tipoAgrupamento, opcao].concat(
      itens.flatMap(function (item) { return Object.entries(item.v.atributos || {}).map(function (e) { return e[0] + ': ' + e[1]; }); }),
      itens.map(function (item) { return item.v.sku || ''; })
    ).join(' '));
    var detalhes = itens.map(function (item) {
      var v = item.v, idx = item.idx;
      var outrosAtributos = Object.entries(v.atributos || {}).filter(function (e) { return e[0] !== tipoAgrupamento; });
      var combinacao = outrosAtributos.map(function (e) { return e[0] + ': ' + e[1]; }).join(' · ');
      return '<div class="variacao-combinacao-editor">' +
        (combinacao ? '<div class="variacao-combinacao-identificacao"><i class="fas fa-sliders" aria-hidden="true"></i>' + escaparVariacao(combinacao) + '</div>' : '') +
        '<div class="variacao-opcao-detalhes">' + detalhesVariacaoHtml(v, idx, tipoAgrupamento) + '</div>' +
      '</div>';
    }).join('');
    var resumoOpcao = quantidade === 1 ? resumoVariacao(itens[0].v) : quantidade + ' combinações · ' + completos + '/' + quantidade + ' com preço';
    return '<details class="variacao-opcao-card" data-busca="' + busca + '">' +
      '<summary class="variacao-opcao-cabecalho">' +
        '<span class="variacao-opcao-nome"><strong>' + escaparVariacao(opcao) + '</strong><small>' + (quantidade === 1 ? '1 combinação' : quantidade + ' combinações') + '</small></span>' +
        '<span class="variacao-opcao-resumo"><span class="' + (completos === quantidade ? 'status-ok' : 'status-pendente') + '">' + resumoOpcao + '</span><i class="fas fa-chevron-down variacao-opcao-seta" aria-hidden="true"></i></span>' +
      '</summary>' +
      '<div class="variacao-opcao-lista-combinacoes">' + detalhes + '</div>' +
    '</details>';
  }).join('');
  var totalOpcoes = opcoesPorTipo.size;
  var completas = variacoesTemp.filter(function (v) { return v.preco !== '' && !isNaN(parseFloat(v.preco)); }).length;
  grupos.innerHTML = '<details class="variacoes-tipo-grupo" open>' +
    '<summary>' +
      '<span class="variacoes-tipo-titulo"><span class="variacoes-tipo-icone"><i class="fas fa-layer-group" aria-hidden="true"></i></span><strong>' + escaparVariacao(tipoAgrupamento) + '</strong></span>' +
      '<span class="variacoes-tipo-resumo">' + (totalOpcoes === 1 ? '1 opção' : totalOpcoes + ' opções') + ' · ' + completas + '/' + variacoesTemp.length + ' com preço <i class="fas fa-chevron-down variacoes-tipo-seta" aria-hidden="true"></i></span>' +
    '</summary>' +
    '<div class="variacoes-opcoes-lista">' + opcoesHtml + '</div>' +
  '</details><div id="variacoesVazioFiltro" class="variacoes-vazio-filtro" style="display:none;">Nenhuma variação corresponde à busca.</div>';
  filtrarVariacoesVisual();
}

/* ============================================================
   PREVIEW PRODUTO (frontend simulado)
   ============================================================ */
function escaparPreviewLoja(valor) { return EU.sanitize(valor); }
function urlPreviewLoja(valor) {
  var url = String(valor || '').trim();
  if (!url) return '';
  try {
    var parsed = new URL(url, window.location.href);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') ? parsed.href : '';
  } catch (e) { return ''; }
}
function obterTiposPreviewLoja() {
  var cadastrados = atributosTemp.map(function (a) { return a.nome; }).filter(Boolean);
  var dosDados = variacoesTemp.flatMap(function (v) { return Object.keys(v.atributos || {}); });
  var unicos = [];
  cadastrados.concat(dosDados).forEach(function (t) { if (unicos.indexOf(t) === -1) unicos.push(t); });
  return unicos;
}
function obterOpcoesPreviewLoja(tipo) {
  var cadastrado = atributosTemp.find(function (a) { return a.nome === tipo; });
  var doDados = variacoesTemp.map(function (v) { return v.atributos && v.atributos[tipo]; }).filter(Boolean);
  var unicos = [];
  ((cadastrado && cadastrado.opcoes) || []).concat(doDados).forEach(function (o) { if (unicos.indexOf(o) === -1) unicos.push(o); });
  return unicos;
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
function encontrarVariacaoPreviewLoja(tipos) {
  if (!variacoesTemp.length) return null;
  var exata = variacoesTemp.find(function (v) {
    return tipos.every(function (tipo) { return String((v.atributos && v.atributos[tipo]) || '') === String(previewVariacoesSelecionadas[tipo] || ''); });
  });
  return exata || variacoesTemp[0];
}
function selecionarOpcaoPreviewLoja(tipo, opcao) {
  previewVariacoesSelecionadas[tipo] = opcao;
  atualizarPreviewProdutoLoja();
}
function renderizarOpcoesPreviewLoja(tipos, variacaoSelecionada) {
  var container = document.getElementById('previewProdutoVariacoesLoja');
  if (!container) return;
  if (!tipos.length || !variacoesTemp.length) {
    container.innerHTML = '<div class="preview-frontend-config-vazio">As opções do produto aparecerão aqui depois que você gerar as variações.</div>';
    return;
  }
  var opcoesHtml = tipos.map(function (tipo) {
    var opcoes = obterOpcoesPreviewLoja(tipo);
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
  container.querySelectorAll('[data-preview-tipo][data-preview-opcao]').forEach(function (botao) {
    botao.addEventListener('click', function () { selecionarOpcaoPreviewLoja(botao.dataset.previewTipo, botao.dataset.previewOpcao); });
  });
  if (variacaoSelecionada && tipos.length) container.dataset.variacaoPreview = JSON.stringify(variacaoSelecionada.atributos || {});
}
function atualizarPreviewProdutoLoja() {
  var nomeEl = document.getElementById('novoItemNome');
  var tipoEl = document.getElementById('novoTipoProduto');
  var precoEl = document.getElementById('novoItemPreco');
  var nomePreview = document.getElementById('previewProdutoNomeLoja');
  var precoPreview = document.getElementById('previewProdutoPrecoLoja');
  var imagemPreview = document.getElementById('previewProdutoImgLoja');
  if (!nomeEl || !tipoEl || !nomePreview || !precoPreview || !imagemPreview) return;
  var nome = nomeEl.value.trim();
  var tipo = tipoEl.value;
  var precoBase = precoEl ? parseFloat(precoEl.value) : NaN;
  var imagensBase = obterImagensProduto();
  var imagem = imagensBase[0] || '';
  var textoPreco = !isNaN(precoBase) && precoBase >= 0 ? 'R$ ' + precoBase.toFixed(2).replace('.', ',') : 'Informe o preço';
  nomePreview.textContent = nome || 'Nome do produto';
  if (tipo === 'variavel') {
    var tipos = obterTiposPreviewLoja();
    sincronizarSelecaoPreviewLoja(tipos);
    var variacaoAtual = encontrarVariacaoPreviewLoja(tipos);
    renderizarOpcoesPreviewLoja(tipos, variacaoAtual);
    var imagensVariacao = variacaoAtual ? (Array.isArray(variacaoAtual.imagens) ? variacaoAtual.imagens : (variacaoAtual.imagem ? [variacaoAtual.imagem] : [])) : [];
    imagem = imagensVariacao[0] || imagem;
    var precoVariacao = variacaoAtual ? parseFloat(variacaoAtual.preco) : NaN;
    textoPreco = !isNaN(precoVariacao) && precoVariacao >= 0 ? 'R$ ' + precoVariacao.toFixed(2).replace('.', ',') : '<span class="preview-frontend-sem-preco">Informe o preço desta opção</span>';
  } else {
    var config = document.getElementById('previewProdutoVariacoesLoja');
    if (config) config.innerHTML = '<div class="preview-frontend-config-vazio">As opções aparecem somente em produtos com variações.</div>';
  }
  precoPreview.innerHTML = textoPreco;
  var imagemSegura = urlPreviewLoja(imagem);
  imagemPreview.innerHTML = imagemSegura ? '<img src="' + escaparPreviewLoja(imagemSegura) + '" alt="Imagem de ' + escaparPreviewLoja(nome || 'produto') + '" onerror="this.style.display=\'none\'">' : '<i class="fas fa-image" aria-hidden="true"></i>';
}
function selecionarTipoProdutoLoja(tipo) {
  var campoTipo = document.getElementById('novoTipoProduto');
  if (!campoTipo) return;
  campoTipo.value = tipo;
  toggleTipoProduto();
  atualizarPreviewProdutoLoja();
}
function toggleTipoProduto() {
  var tipo = document.getElementById('novoTipoProduto').value;
  document.getElementById('campoProdutoSimples').style.display = tipo === 'simples' ? 'block' : 'none';
  document.getElementById('campoProdutoVariavel').style.display = tipo === 'variavel' ? 'block' : 'none';
  var campoImagens = document.getElementById('campoImagensProduto');
  if (campoImagens) campoImagens.style.display = tipo === 'variavel' ? 'none' : 'block';
  document.querySelectorAll('#tipoProdutoCards .tipo-card').forEach(function (card) {
    var ativo = card.dataset.tipo === tipo;
    card.classList.toggle('selected', ativo);
    card.setAttribute('aria-checked', ativo ? 'true' : 'false');
  });
  if (tipo !== 'variavel') {
    atributosTemp = [];
    variacoesTemp = [];
    renderizarAtributos();
    document.getElementById('variacoesContainer').style.display = 'none';
  }
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
    var cod = '#' + id.slice(0, 6).toUpperCase();
    EU.mostrarToast('Pedido ' + cod + ' agora está ' + novoStatus + '.', 'sucesso');
  } catch (e) { EU.mostrarToast(e.message, 'erro'); }
  finally { EU.hideLoading(); }
}
async function excluirPedido(id) {
  var cod = '#' + id.slice(0, 6).toUpperCase();
  if (!await EU.confirmar('Excluir o pedido ' + cod + '? Essa ação não pode ser desfeita.')) return;
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
  if (await EU.confirmar('Link copiado! Deseja abrir o WhatsApp para enviar ao motoboy?')) window.open('https://wa.me/' + EU.formatarWhatsapp(p.clienteTelefone) + '?text=' + encodeURIComponent('Olá! Link da entrega: ' + link), '_blank');
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
   CARDÁPIO (produtos)
   ============================================================ */
async function carregarCardapio() {
  if (!emailAtual) return;
  var user = FB.auth.currentUser; if (!user) return;
  var snap = await db.collection('lojistas').doc(user.email).collection('cardapio').get();
  var container = document.getElementById('listaCardapio');
  if (!container) return;
  if (snap.empty) { container.innerHTML = '<p style="text-align:center; padding:30px;">Nenhum produto cadastrado.</p>'; return; }
  container.innerHTML = snap.docs.map(function (doc) {
    var s = doc.data();
    var precos = s.tipo === 'variavel' && Array.isArray(s.variacoes) && s.variacoes.length ? s.variacoes.map(function (v) { return parseFloat(v.preco) || 0; }) : [];
    var precoStr = precos.length ? 'R$ ' + Math.min.apply(null, precos).toFixed(2) + ' - R$ ' + Math.max.apply(null, precos).toFixed(2) : 'R$ ' + parseFloat(s.preco || 0).toFixed(2);
    var tipoLabel = s.tipo === 'variavel' ? '<span class="badge-variavel">Com variações</span>' : '';
    var nome = EU.sanitize(s.nome || 'Produto');
    var categoria = EU.sanitize(s.categoria || 'Sem categoria');
    var estoque = s.estoque === '' || s.estoque === undefined ? 'Ilimitado' : EU.sanitize(s.estoque);
    var disponibilidade = s.disponivel !== 'nao';
    return '<div class="item-lista" data-id="' + doc.id + '">' +
      '<div><strong>' + nome + '</strong> ' + tipoLabel + '<br>' +
      '<small>Preço: ' + precoStr + ' | Categoria: ' + categoria + ' | Estoque: ' + estoque + '</small>' +
      '<div class="item-lista-disponibilidade"><label class="toggle-switch" title="' + (disponibilidade ? 'Desativar produto' : 'Ativar produto') + '"><input type="checkbox" ' + (disponibilidade ? 'checked' : '') + ' onchange="toggleAtivoProduto(\'' + doc.id + '\', this.checked)"><span class="slider"></span></label> ' + (disponibilidade ? 'Ativo' : 'Inativo') + '</div></div>' +
      '<div class="acoes">' +
        '<button class="btn-pequeno" onclick="abrirModalEditarProduto(\'' + doc.id + '\')">Editar</button>' +
        '<button class="btn-pequeno" onclick="duplicarProduto(\'' + doc.id + '\')">Duplicar</button>' +
        '<button class="btn-pequeno" style="color:#dc2626;" onclick="excluirItemCardapio(\'' + doc.id + '\')">Excluir</button>' +
      '</div></div>';
  }).join('');
}
async function toggleAtivoProduto(id, ativo) {
  try {
    var doc = await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).get();
    var nome = doc.exists ? (doc.data().nome || '') : '';
    await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).update({ disponivel: ativo ? 'sim' : 'nao' });
    EU.mostrarToast(nome ? 'Produto "' + nome + '" agora está ' + (ativo ? 'ativo' : 'inativo') + '.' : (ativo ? 'Produto ativado!' : 'Produto marcado como inativo.'), 'sucesso');
    await carregarCardapio();
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); await carregarCardapio(); }
}
async function excluirItemCardapio(id) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).get();
  var nome = doc.exists ? (doc.data().nome || 'este produto') : 'este produto';
  if (!await EU.confirmar('Excluir "' + nome + '"? Essa ação não pode ser desfeita.')) return;
  EU.showLoading('Excluindo...');
  try { await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).delete(); await carregarCardapio(); EU.mostrarToast('"' + nome + '" removido.', 'sucesso'); }
  catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
  finally { EU.hideLoading(); }
}

/* ============================================================
   MODAL DE PRODUTO
   ============================================================ */
function abrirModalProdutoLoja() {
  var modal = document.getElementById('modalProduto');
  if (!modal) return;
  modal.classList.add('active');
  var primeiro = document.getElementById('novoItemNome');
  if (primeiro) setTimeout(function () { primeiro.focus(); }, 50);
}
function fecharModalProdutoLoja() {
  var modal = document.getElementById('modalProduto');
  if (modal) modal.classList.remove('active');
}
function resetarFormularioProdutoLoja() {
  produtoEmEdicao = null;
  ['novoItemNome','novoItemCategoria','novoItemDescricao','novoItemImagem','novoItemPreco','novoItemEstoque','novoItemImagensUrl','novoItemImagens'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  var disp = document.getElementById('novoItemDisponivel'); if (disp) disp.value = 'sim';
  var arq = document.getElementById('novoItemImagemFile'); if (arq) arq.value = '';
  var prev = document.getElementById('previewImagensProduto'); if (prev) prev.innerHTML = '';
  var tab = document.getElementById('variacoesContainer'); if (tab) tab.style.display = 'none';
  imagensExtrasUrls = [];
  atributosTemp = [];
  variacoesTemp = [];
  previewVariacoesSelecionadas = {};
  renderizarAtributos();
  renderizarVariacoes();
  toggleTipoProduto();
  atualizarPreviewProdutoLoja();
  var titulo = document.getElementById('tituloModalProduto'); if (titulo) titulo.textContent = 'Novo produto';
  var botao = document.getElementById('btnAdicionarItem');
  if (botao) {
    botao.disabled = false;
    botao.classList.remove('loading');
    var texto = botao.querySelector('.btn-text');
    if (texto) texto.textContent = 'Cadastrar produto';
  }
}
function carregarProdutoNoFormulario(item) {
  var tipo = item.tipo || 'simples';
  var imagens = Array.isArray(item.imagens) && item.imagens.length ? item.imagens.slice() : (item.imagem ? [item.imagem] : []);
  document.getElementById('novoItemNome').value = item.nome || '';
  document.getElementById('novoItemCategoria').value = item.categoria || '';
  document.getElementById('novoItemDescricao').value = item.descricao || '';
  document.getElementById('novoItemDisponivel').value = item.disponivel || 'sim';
  document.getElementById('novoItemImagem').value = imagens[0] || '';
  document.getElementById('novoItemImagensUrl').value = imagens.slice(1).join(',');
  document.getElementById('novoItemImagens').value = imagens.join(',');
  document.getElementById('novoItemPreco').value = item.preco != null ? item.preco : '';
  document.getElementById('novoItemEstoque').value = item.estoque != null ? item.estoque : '';
  document.getElementById('novoItemImagemFile').value = '';
  imagensExtrasUrls = [];
  previewVariacoesSelecionadas = {};
  atributosTemp = (item.atributos || []).map(function (a) { return { nome: a.nome, opcoes: Array.isArray(a.opcoes) ? a.opcoes.slice() : [] }; });
  variacoesTemp = (item.variacoes || []).map(function (v) { return Object.assign({}, v, { imagens: Array.isArray(v.imagens) ? v.imagens.slice() : (v.imagem ? [v.imagem] : []) }); });
  document.getElementById('novoTipoProduto').value = tipo;
  renderizarAtributos();
  renderizarVariacoes();
  document.getElementById('variacoesContainer').style.display = tipo === 'variavel' && variacoesTemp.length ? 'block' : 'none';
  toggleTipoProduto();
  atualizarPreviewImagensExtras();
  atualizarPreviewProdutoLoja();
}
async function abrirModalEditarProduto(id, isDuplicar) {
  var user = FB.auth.currentUser; if (!user) return;
  try {
    var doc = await db.collection('lojistas').doc(user.email).collection('cardapio').doc(id).get();
    if (!doc.exists) return;
    produtoEmEdicao = { id: id, isDuplicar: !!isDuplicar };
    carregarProdutoNoFormulario(doc.data());
    var titulo = document.getElementById('tituloModalProduto');
    if (titulo) titulo.textContent = isDuplicar ? 'Duplicar produto' : 'Editar produto';
    var botao = document.getElementById('btnAdicionarItem');
    if (botao) {
      var texto = botao.querySelector('.btn-text');
      if (texto) texto.textContent = isDuplicar ? 'Duplicar produto' : 'Salvar alterações';
    }
    abrirModalProdutoLoja();
  } catch (e) { EU.mostrarToast('Não foi possível abrir o produto: ' + e.message, 'erro'); }
}
function duplicarProduto(id) { return abrirModalEditarProduto(id, true); }

document.getElementById('btnAdicionarItem').onclick = async function () {
  var btn = this;
  btn.classList.add('loading'); btn.disabled = true;
  try {
    var nome = document.getElementById('novoItemNome').value.trim();
    if (!nome) { EU.mostrarToast('Preencha o nome.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
    var tipo = document.getElementById('novoTipoProduto').value;
    var imagens = obterImagensProduto();
    var itemData = {
      nome: nome,
      categoria: document.getElementById('novoItemCategoria').value.trim(),
      descricao: document.getElementById('novoItemDescricao').value.trim(),
      imagem: tipo === 'simples' ? (imagens[0] || '') : '',
      disponivel: document.getElementById('novoItemDisponivel').value,
      tipo: tipo,
      imagens: tipo === 'simples' ? imagens : []
    };
    if (tipo === 'simples') {
      var preco = parseFloat(document.getElementById('novoItemPreco').value);
      var estoqueTexto = document.getElementById('novoItemEstoque').value.trim();
      if (isNaN(preco) || preco < 0) { EU.mostrarToast('Preço inválido.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      if (estoqueTexto !== '' && !/^\d+$/.test(estoqueTexto)) { EU.mostrarToast('Informe um estoque inteiro válido.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      itemData.preco = preco;
      itemData.estoque = estoqueTexto === '' ? '' : parseInt(estoqueTexto, 10).toString();
    } else {
      if (!atributosTemp.length) { EU.mostrarToast('Adicione pelo menos uma variação para configurar o produto.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      if (!variacoesTemp.length) { EU.mostrarToast('Gere as combinações de variações.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      for (var i = 0; i < variacoesTemp.length; i++) {
        var v = variacoesTemp[i];
        if (!v.preco || isNaN(parseFloat(v.preco))) { EU.mostrarToast('Preencha o preço de todas as variações.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
        var estoqueV = String(v.estoque == null ? '' : v.estoque).trim();
        if (estoqueV !== '' && !/^\d+$/.test(estoqueV)) { EU.mostrarToast('Informe um estoque inteiro válido em todas as variações.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
      }
      itemData.atributos = atributosTemp.map(function (a) { return { nome: a.nome, opcoes: a.opcoes.slice() }; });
      itemData.variacoes = variacoesTemp.map(function (v) {
        var fotos = Array.isArray(v.imagens) ? v.imagens : (v.imagem ? [v.imagem] : []);
        var estoqueV = v.estoque == null ? '' : String(v.estoque).trim();
        return { atributos: Object.assign({}, v.atributos || {}), preco: v.preco, estoque: estoqueV, sku: v.sku || '', imagem: fotos[0] || '', imagens: fotos.slice() };
      });
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
    fecharModalProdutoLoja();
    resetarFormularioProdutoLoja();
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
  finally { btn.classList.remove('loading'); btn.disabled = false; }
};

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
    return '<div class="item-lista"><div><strong>' + EU.sanitize(data.localidade || 'Localidade') + '</strong><br><small>Taxa: R$ ' + taxa.toFixed(2) + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch" title="' + (ativo ? 'Desativar taxa' : 'Ativar taxa') + '"><input type="checkbox" ' + (ativo ? 'checked' : '') + ' onchange="toggleAtivoFrete(\'' + doc.id + '\', this.checked)"><span class="slider"></span></label> ' + (ativo ? 'Ativa' : 'Inativa') + '</div></div><div><button class="btn-pequeno" onclick="editarFreteModal(\'' + doc.id + '\')">Editar</button> <button class="btn-pequeno" onclick="duplicarFrete(\'' + doc.id + '\')">Duplicar</button> <button class="btn-pequeno" style="color:#dc2626" onclick="excluirFrete(\'' + doc.id + '\')">Excluir</button></div></div>';
  }).join('') || '<p style="text-align:center;">Nenhuma taxa configurada.</p>';
}
function abrirModalFreteLoja() {
  var modal = document.getElementById('modalFrete');
  if (!modal) return;
  modal.classList.add('active');
  var campo = document.getElementById('novaLocalidade');
  if (campo) setTimeout(function () { campo.focus(); }, 50);
}
function fecharModalFreteLoja() {
  var modal = document.getElementById('modalFrete');
  if (modal) modal.classList.remove('active');
}
function limparFormularioFreteLoja() {
  var loc = document.getElementById('novaLocalidade'); if (loc) loc.value = '';
  var taxa = document.getElementById('novaTaxa'); if (taxa) taxa.value = '';
  var titulo = document.getElementById('tituloModalFrete'); if (titulo) titulo.textContent = 'Nova taxa de entrega';
}
document.getElementById('btnAdicionarFrete').onclick = async function () {
  var l = document.getElementById('novaLocalidade').value.trim();
  var t = parseFloat(document.getElementById('novaTaxa').value);
  var ativo = 'sim';
  if (!l || !Number.isFinite(t) || t < 0) { EU.mostrarToast('Preencha uma localidade e uma taxa válida.', 'erro'); return; }
  EU.showLoading('Salvando...');
  try {
    await db.collection('lojistas').doc(emailAtual).collection('fretes').add({ localidade: l, taxa: t, ativo: ativo });
    fecharModalFreteLoja(); limparFormularioFreteLoja(); carregarFretes();
    EU.mostrarToast('Taxa "' + l + '" salva!', 'sucesso');
  } catch (e) { EU.mostrarToast(e.message, 'erro'); }
  finally { EU.hideLoading(); }
};
async function excluirFrete(id) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).get();
  var loc = doc.exists ? (doc.data().localidade || 'esta taxa') : 'esta taxa';
  if (!await EU.confirmar('Excluir a taxa de "' + loc + '"? Essa ação não pode ser desfeita.')) return;
  await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).delete();
  carregarFretes();
  EU.mostrarToast('Taxa "' + loc + '" removida.', 'sucesso');
}
async function toggleAtivoFrete(id, ativo) {
  try {
    var doc = await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).get();
    var loc = doc.exists ? (doc.data().localidade || '') : '';
    await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).update({ ativo: ativo ? 'sim' : 'nao' });
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
  var textoBotao = isDuplicar ? 'Duplicar taxa' : 'Salvar taxa';
  modal.innerHTML = '<div class="modal-conteudo entrega-modal-conteudo"><div class="modal-header"><div><span class="modal-eyebrow">Taxas de entrega</span><h3>' + titulo + '</h3></div><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()" aria-label="Fechar">×</button></div><div class="campanha-form"><div class="campanha-secao-titulo">1. DADOS DA ENTREGA</div><div class="campo"><label>Localidade <span class="obrigatorio">*</span></label><input type="text" id="editLoc" value="' + EU.sanitize(loc) + '"></div><div class="campo"><label>Taxa (R$) <span class="obrigatorio">*</span></label><input type="number" step="0.01" min="0" id="editTaxa" value="' + taxa + '"></div><div class="campanha-modal-acoes"><button class="btn-secundario" onclick="this.closest(\'.modal-overlay\').remove()">Cancelar</button><button class="btn-primary" id="salvarFrete"><span class="spinner-btn"></span><span class="btn-text">' + textoBotao + '</span></button></div></div></div>';
  document.body.appendChild(modal);
  document.getElementById('salvarFrete').onclick = async function () {
    var btn = this; btn.classList.add('loading'); btn.disabled = true;
    var dados = { localidade: document.getElementById('editLoc').value.trim(), taxa: parseFloat(document.getElementById('editTaxa').value), ativo: ativo === 'nao' ? 'nao' : 'sim' };
    if (!dados.localidade || !Number.isFinite(dados.taxa) || dados.taxa < 0) { EU.mostrarToast('Preencha uma localidade e uma taxa válida.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
    try {
      var ref = db.collection('lojistas').doc(emailAtual).collection('fretes');
      if (isDuplicar) { await ref.add(dados); EU.mostrarToast('Taxa "' + dados.localidade + '" duplicada!', 'sucesso'); }
      else { await ref.doc(id).update(dados); EU.mostrarToast('Taxa "' + dados.localidade + '" atualizada!', 'sucesso'); }
      await carregarFretes(); modal.remove();
    } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); btn.classList.remove('loading'); btn.disabled = false; }
  };
}

/* ============================================================
   CUPONS
   ============================================================ */
async function carregarCupons() {
  if (!emailAtual) return;
  var snap = await db.collection('lojistas').doc(emailAtual).collection('cupons').get();
  var container = document.getElementById('listaCupons');
  container.innerHTML = snap.docs.map(function (doc) {
    var data = doc.data();
    var validade = data.validade ? new Date(data.validade).toLocaleDateString('pt-BR') : 'Sem validade';
    var minPedido = data.minimoPedido ? 'Mínimo: R$ ' + parseFloat(data.minimoPedido).toFixed(2) : 'Sem mínimo';
    var usos = parseInt(data.usosTotal, 10) || 0;
    var limiteUsos = parseInt(data.limiteUsos, 10);
    var usoTexto = Number.isInteger(limiteUsos) && limiteUsos > 0 ? 'Usos: ' + usos + '/' + limiteUsos : 'Usos: ' + usos + '/Ilimitado';
    var ativo = data.ativo !== 'nao';
    return '<div class="item-lista"><div><strong>' + EU.sanitize(data.codigo) + '</strong><br><small>' + (data.tipo === 'percentual' ? data.valor + '%' : 'R$ ' + parseFloat(data.valor).toFixed(2)) + ' | ' + validade + ' | ' + minPedido + ' | ' + usoTexto + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch" title="' + (ativo ? 'Desativar cupom' : 'Ativar cupom') + '"><input type="checkbox" ' + (ativo ? 'checked' : '') + ' onchange="toggleAtivoCupom(\'' + doc.id + '\', this.checked)"><span class="slider"></span></label> ' + (ativo ? 'Ativo' : 'Inativo') + '</div></div><div><button class="btn-pequeno" onclick="editarCupomModal(\'' + doc.id + '\')">Editar</button> <button class="btn-pequeno" onclick="duplicarCupom(\'' + doc.id + '\')">Duplicar</button> <button class="btn-pequeno" style="color:#dc2626" onclick="excluirCupom(\'' + doc.id + '\')">Excluir</button></div></div>';
  }).join('') || '<p style="text-align:center;">Nenhum cupom criado.</p>';
}
function abrirModalCupomLoja() {
  var modal = document.getElementById('modalCupom');
  if (!modal) return;
  modal.classList.add('active');
  var primeiro = document.getElementById('novoCodigo');
  if (primeiro) setTimeout(function () { primeiro.focus(); }, 50);
}
function fecharModalCupomLoja() {
  var modal = document.getElementById('modalCupom');
  if (modal) modal.classList.remove('active');
}
function limparFormularioCupom() {
  cupomEmEdicao = null;
  ['novoCodigo','novoValor','novoValidade','novoMinimoPedido','novoLimiteUsos'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  var tipo = document.getElementById('novoTipo'); if (tipo) tipo.value = 'percentual';
  var titulo = document.getElementById('tituloModalCupom'); if (titulo) titulo.textContent = 'Novo cupom';
  var botao = document.getElementById('btnAdicionarCupom'); if (botao) botao.textContent = 'Salvar cupom';
}
async function salvarCupomLoja() {
  var cod = document.getElementById('novoCodigo').value.trim().toUpperCase();
  var tipo = document.getElementById('novoTipo').value;
  var ativo = (cupomEmEdicao && cupomEmEdicao.ativo) || 'sim';
  var valor = parseFloat(document.getElementById('novoValor').value);
  var validade = document.getElementById('novoValidade').value;
  var minimoPedido = parseFloat(document.getElementById('novoMinimoPedido').value) || null;
  var limiteTexto = document.getElementById('novoLimiteUsos').value.trim();
  var limiteUsos = limiteTexto === '' ? null : parseInt(limiteTexto, 10);
  if (!cod || isNaN(valor) || valor <= 0) { EU.mostrarToast('Preencha código e valor.', 'erro'); return; }
  if (tipo === 'percentual' && valor > 100) { EU.mostrarToast('O percentual não pode ser maior que 100%.', 'erro'); return; }
  if (limiteTexto !== '' && (!Number.isInteger(limiteUsos) || limiteUsos < 1)) { EU.mostrarToast('O número de usos deve ser um inteiro maior que zero.', 'erro'); return; }
  EU.showLoading(cupomEmEdicao ? (cupomEmEdicao.isDuplicar ? 'Duplicando cupom...' : 'Salvando cupom...') : 'Criando cupom...');
  try {
    var ref = db.collection('lojistas').doc(emailAtual).collection('cupons');
    var dados = { codigo: cod, tipo: tipo, valor: valor, ativo: ativo, validade: validade || null, minimoPedido: minimoPedido, limiteUsos: limiteUsos };
    if (cupomEmEdicao && !cupomEmEdicao.isDuplicar) {
      await ref.doc(cupomEmEdicao.id).update(dados);
      EU.mostrarToast('Cupom "' + cod + '" atualizado!', 'sucesso');
    } else {
      await ref.add(Object.assign({}, dados, { usosTotal: 0, usosPorCliente: {} }));
      EU.mostrarToast(cupomEmEdicao && cupomEmEdicao.isDuplicar ? 'Cupom "' + cod + '" duplicado!' : 'Cupom "' + cod + '" criado!', 'sucesso');
    }
    await carregarCupons();
    fecharModalCupomLoja();
    limparFormularioCupom();
  } catch (e) { EU.mostrarToast(e.message, 'erro'); }
  finally { EU.hideLoading(); }
}
async function toggleAtivoCupom(id, ativo) {
  try {
    var doc = await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).get();
    var cod = doc.exists ? (doc.data().codigo || '') : '';
    await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).update({ ativo: ativo ? 'sim' : 'nao' });
    EU.mostrarToast(cod ? 'Cupom "' + cod + '" agora está ' + (ativo ? 'ativo' : 'inativo') + '.' : (ativo ? 'Cupom ativo!' : 'Cupom inativo.'), 'sucesso');
    await carregarCupons();
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); await carregarCupons(); }
}
async function excluirCupom(id) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).get();
  var cod = doc.exists ? (doc.data().codigo || 'este cupom') : 'este cupom';
  if (!await EU.confirmar('Excluir o cupom "' + cod + '"? Essa ação não pode ser desfeita.')) return;
  await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).delete();
  carregarCupons();
  EU.mostrarToast('Cupom "' + cod + '" removido.', 'sucesso');
}
async function duplicarCupom(id) {
  var snap = await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).get();
  if (!snap.exists) return;
  var cupom = snap.data();
  editarCupomModal(id, cupom.codigo + '_COPIA', cupom.tipo, cupom.valor, cupom.ativo, cupom.validade || '', cupom.minimoPedido || 0, cupom.limiteUsos || 0, true);
}
function editarCupomModal(id, cod, tipo, valor, ativo, validade, minimoPedido, limiteUsos, isDuplicar) {
  cupomEmEdicao = { id: id, isDuplicar: !!isDuplicar, ativo: ativo === 'nao' ? 'nao' : 'sim' };
  document.getElementById('novoCodigo').value = cod || '';
  document.getElementById('novoTipo').value = tipo || 'percentual';
  document.getElementById('novoValor').value = valor != null ? valor : '';
  document.getElementById('novoValidade').value = validade || '';
  document.getElementById('novoMinimoPedido').value = minimoPedido || '';
  document.getElementById('novoLimiteUsos').value = limiteUsos || '';
  document.getElementById('tituloModalCupom').textContent = isDuplicar ? 'Duplicar cupom' : 'Editar cupom';
  document.getElementById('btnAdicionarCupom').textContent = isDuplicar ? 'Duplicar cupom' : 'Salvar alterações';
  abrirModalCupomLoja();
}

/* ============================================================
   PROMOÇÕES
   ============================================================ */
function escaparTextoPromocao(valor) { return EU.sanitize(valor); }
function formatarNomeVariacaoPromocao(produto, variacao) {
  var attrs = variacao && variacao.atributos ? Object.keys(variacao.atributos).map(function (k) { return k + ': ' + variacao.atributos[k]; }).join(', ') : '';
  return (produto.nome || 'Produto') + (attrs ? ' - ' + attrs : '');
}
function alternarModoCampanhaLoja(modo) {
  var btnCupom = document.getElementById('btnModoCupom');
  var btnPromocao = document.getElementById('btnModoPromocao');
  var btnNovoCupom = document.getElementById('btnNovoCupom');
  var btnNovaPromocao = document.getElementById('btnNovaPromocao');
  var listaCupons = document.getElementById('listaCupons');
  var listaPromocoes = document.getElementById('listaPromocoes');
  var mostrarPromocao = modo === 'promocao';
  if (btnNovoCupom) btnNovoCupom.style.display = mostrarPromocao ? 'none' : 'inline-flex';
  if (btnNovaPromocao) btnNovaPromocao.style.display = mostrarPromocao ? 'inline-flex' : 'none';
  if (listaCupons) listaCupons.style.display = mostrarPromocao ? 'none' : 'block';
  if (listaPromocoes) listaPromocoes.style.display = mostrarPromocao ? 'block' : 'none';
  if (btnCupom) { btnCupom.classList.toggle('active', !mostrarPromocao); btnCupom.setAttribute('aria-selected', String(!mostrarPromocao)); }
  if (btnPromocao) { btnPromocao.classList.toggle('active', mostrarPromocao); btnPromocao.setAttribute('aria-selected', String(mostrarPromocao)); }
  if (mostrarPromocao) carregarProdutosParaPromocao();
  else carregarCupons();
}
function abrirModalPromocaoLoja() {
  var modal = document.getElementById('modalPromocao');
  if (!modal) return;
  modal.classList.add('active');
  var primeiro = document.getElementById('novoNomePromocao');
  if (primeiro) setTimeout(function () { primeiro.focus(); }, 50);
}
function fecharModalPromocaoLoja() {
  var modal = document.getElementById('modalPromocao');
  if (modal) modal.classList.remove('active');
}
function obterProdutoPromocaoSelecionado(id) {
  return produtosPromocaoCache.find(function (p) { return String(p.id) === String(id); }) || null;
}
function renderizarProdutosPromocao() {
  var lista = document.getElementById('listaProdutosPromocao');
  if (!lista) return;
  var busca = ((document.getElementById('buscaProdutosPromocao') || {}).value || '').trim().toLowerCase();
  var produtos = produtosPromocaoCache.filter(function (p) { return !busca || String(p.nome || '').toLowerCase().indexOf(busca) !== -1 || String(p.categoria || '').toLowerCase().indexOf(busca) !== -1; });
  if (!produtos.length) {
    lista.innerHTML = '<div class="selecao-produto-vazio"><i class="fas fa-search"></i><br>Nenhum produto encontrado.<br><small>Tente outro nome ou categoria.</small></div>';
  } else {
    lista.innerHTML = produtos.map(function (p) {
      var checked = promocaoProdutosSelecionados.some(function (id) { return String(id) === String(p.id); });
      var tipo = p.tipo === 'variavel' ? 'Com variações' : 'Produto simples';
      var qtdV = p.tipo === 'variavel' && Array.isArray(p.variacoes) ? p.variacoes.length : 0;
      var imagem = p.imagem || (Array.isArray(p.imagens) && p.imagens[0]) || '';
      var imagemHtml = imagem ? '<img class="produto-opcao-promocao-imagem" src="' + escaparTextoPromocao(imagem) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '<span class="produto-opcao-promocao-imagem produto-opcao-promocao-sem-imagem"><i class="fas fa-image"></i></span>';
      return '<label class="produto-opcao-promocao' + (checked ? ' selecionado' : '') + '"><input type="checkbox" data-promocao-produto="' + escaparTextoPromocao(p.id) + '"' + (checked ? ' checked' : '') + '><span class="produto-opcao-promocao-check" aria-hidden="true"><i class="fas fa-check"></i></span>' + imagemHtml + '<span class="produto-opcao-promocao-texto"><strong>' + escaparTextoPromocao(p.nome || 'Produto') + '</strong><small>' + escaparTextoPromocao(p.categoria || 'Sem categoria') + ' · ' + tipo + (qtdV ? ' · ' + qtdV + ' variações' : '') + '</small></span></label>';
    }).join('');
  }
  lista.querySelectorAll('[data-promocao-produto]').forEach(function (input) {
    input.addEventListener('change', function () {
      var id = input.dataset.promocaoProduto;
      if (input.checked && !promocaoProdutosSelecionados.some(function (item) { return String(item) === String(id); })) promocaoProdutosSelecionados.push(id);
      if (!input.checked) promocaoProdutosSelecionados = promocaoProdutosSelecionados.filter(function (item) { return String(item) !== String(id); });
      var card = input.closest('.produto-opcao-promocao');
      if (card) card.classList.toggle('selecionado', input.checked);
      promocaoVariacoesSelecionadas = promocaoVariacoesSelecionadas.filter(function (v) { return promocaoProdutosSelecionados.some(function (item) { return String(item) === String(v.produtoId); }); });
      renderizarProdutosPromocaoSelecionados();
      atualizarAplicacaoVariacoesPromocao();
    });
  });
  renderizarProdutosPromocaoSelecionados();
  atualizarAplicacaoVariacoesPromocao();
}
function renderizarProdutosPromocaoSelecionados() {
  var container = document.getElementById('produtosPromocaoSelecionados');
  if (!container) return;
  var selecionados = promocaoProdutosSelecionados.map(obterProdutoPromocaoSelecionado).filter(Boolean);
  var contador = document.getElementById('contadorProdutosPromocao');
  if (contador) contador.textContent = selecionados.length + (selecionados.length === 1 ? ' selecionado' : ' selecionados');
  container.innerHTML = selecionados.length ? selecionados.map(function (p) {
    return '<span class="selecao-promocao-chip"><i class="fas fa-check"></i>' + escaparTextoPromocao(p.nome) + '<button type="button" data-remover-produto-promocao="' + escaparTextoPromocao(p.id) + '" aria-label="Remover ' + escaparTextoPromocao(p.nome) + '">×</button></span>';
  }).join('') : '<div class="selecao-produto-vazio">Nenhum produto selecionado ainda.</div>';
  container.querySelectorAll('[data-remover-produto-promocao]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.dataset.removerProdutoPromocao;
      promocaoProdutosSelecionados = promocaoProdutosSelecionados.filter(function (item) { return String(item) !== String(id); });
      promocaoVariacoesSelecionadas = promocaoVariacoesSelecionadas.filter(function (v) { return String(v.produtoId) !== String(id); });
      renderizarProdutosPromocao();
    });
  });
}
function atualizarAplicacaoVariacoesPromocao() {
  var selecionados = promocaoProdutosSelecionados.map(obterProdutoPromocaoSelecionado).filter(Boolean);
  var temVariacoes = selecionados.some(function (p) { return p.tipo === 'variavel' && Array.isArray(p.variacoes) && p.variacoes.length; });
  var bloco = document.getElementById('aplicacaoVariacaoPromocao');
  var lista = document.getElementById('listaVariacoesPromocao');
  var aplicacao = document.getElementById('aplicacaoPromocao');
  if (bloco) bloco.style.display = temVariacoes ? 'block' : 'none';
  if (!temVariacoes && aplicacao) aplicacao.value = 'todas';
  if (lista) lista.style.display = temVariacoes && aplicacao && aplicacao.value === 'especificas' ? 'grid' : 'none';
  if (temVariacoes && aplicacao && aplicacao.value === 'especificas') {
    var opcoes = [];
    selecionados.forEach(function (p) {
      if (p.tipo !== 'variavel' || !Array.isArray(p.variacoes)) return;
      p.variacoes.forEach(function (v) {
        var variacaoId = v.sku || JSON.stringify(v.atributos || {});
        var checked = promocaoVariacoesSelecionadas.some(function (item) { return item.produtoId === p.id && item.variacaoId === variacaoId; }) ? ' checked' : '';
        opcoes.push('<label class="variacao-opcao-promocao"><input type="checkbox" data-promocao-variacao-produto="' + escaparTextoPromocao(p.id) + '" data-promocao-variacao-id="' + escaparTextoPromocao(variacaoId) + '"' + checked + '><span>' + escaparTextoPromocao(formatarNomeVariacaoPromocao(p, v)) + '<small style="display:block;color:#64748b;">Preço atual: R$ ' + ((parseFloat(v.preco) || 0).toFixed(2)) + '</small></span></label>');
      });
    });
    lista.innerHTML = opcoes.join('') || '<div style="padding:.8rem;color:#64748b;">Nenhuma variação disponível.</div>';
    lista.querySelectorAll('[data-promocao-variacao-id]').forEach(function (input) {
      input.addEventListener('change', function () {
        var registro = { produtoId: input.dataset.promocaoVariacaoProduto, variacaoId: input.dataset.promocaoVariacaoId };
        if (input.checked) promocaoVariacoesSelecionadas.push(registro);
        else promocaoVariacoesSelecionadas = promocaoVariacoesSelecionadas.filter(function (item) { return !(item.produtoId === registro.produtoId && item.variacaoId === registro.variacaoId); });
      });
    });
  }
}
async function carregarProdutosParaPromocao() {
  var user = FB.auth.currentUser; if (!user) return;
  try {
    var snap = await db.collection('lojistas').doc(user.email).collection('cardapio').get();
    produtosPromocaoCache = snap.docs.map(function (doc) { return Object.assign({ id: doc.id }, doc.data()); }).filter(function (p) { return p.disponivel !== 'nao'; });
    renderizarProdutosPromocao();
  } catch (e) { console.error('[Loja] Falha ao carregar produtos para promoção:', e); EU.mostrarToast('Não foi possível carregar os produtos para a promoção.', 'erro'); }
}
function atualizarModoQuantidadePromocao() {
  var modo = (document.getElementById('modoQuantidadePromocao') && document.getElementById('modoQuantidadePromocao').value) || 'a_cada';
  var ajuda = document.getElementById('ajudaModoQuantidade');
  if (ajuda) ajuda.textContent = modo === 'a_partir'
    ? 'Ex.: a partir de 2 unidades, cada peça custa R$ 5. Com 3 peças, o total será R$ 15.'
    : 'Ex.: a cada 2 unidades, o grupo custa R$ 10. Com 3 peças, será R$ 10 + R$ 5 da sobra.';
  document.querySelectorAll('#faixasPromocao .faixa-preco-label').forEach(function (label) {
    label.textContent = modo === 'a_partir' ? 'Preço por peça (R$)' : 'Preço do grupo (R$)';
  });
}
function atualizarTipoPromocaoLoja() {
  var tipo = (document.getElementById('novoTipoPromocao') && document.getElementById('novoTipoPromocao').value) || 'preco';
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
  var container = document.getElementById('faixasPromocao');
  if (!container) return;
  var div = document.createElement('div');
  div.className = 'faixa-promocao';
  div.innerHTML = '<div class="campo"><label>Quantidade mínima</label><input type="number" min="1" step="1" class="faixa-quantidade" value="' + (faixa && faixa.quantidade || '') + '" placeholder="Ex.: 2"><small class="campo-ajuda">Quantidade necessária para liberar esta condição.</small></div><div class="campo"><label class="faixa-preco-label">Preço do grupo (R$)</label><input type="number" min="0" step="0.01" class="faixa-preco" value="' + (faixa && faixa.preco || '') + '" placeholder="Ex.: 10"><small class="faixa-ajuda">O rótulo muda conforme a regra escolhida.</small></div><button type="button" class="btn-remover-faixa" aria-label="Remover faixa">×</button>';
  div.querySelector('.btn-remover-faixa').addEventListener('click', function () { div.remove(); });
  container.appendChild(div);
  atualizarModoQuantidadePromocao();
}
function obterFaixasPromocao() {
  return Array.from(document.querySelectorAll('#faixasPromocao .faixa-promocao')).map(function (row) {
    return { quantidade: parseInt(row.querySelector('.faixa-quantidade') && row.querySelector('.faixa-quantidade').value), preco: parseFloat(row.querySelector('.faixa-preco') && row.querySelector('.faixa-preco').value) };
  }).filter(function (f) { return !isNaN(f.quantidade) && f.quantidade > 0 && !isNaN(f.preco) && f.preco >= 0; }).sort(function (a, b) { return a.quantidade - b.quantidade; });
}
function limparFormularioPromocao() {
  promocaoProdutosSelecionados = [];
  promocaoVariacoesSelecionadas = [];
  promocaoEmEdicao = null;
  ['novoNomePromocao','novoValorPromocao','novoInicioPromocao','novoFimPromocao'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
  var tipo = document.getElementById('novoTipoPromocao'); if (tipo) tipo.value = 'preco';
  var modo = document.getElementById('modoQuantidadePromocao'); if (modo) modo.value = 'a_cada';
  var aplicacao = document.getElementById('aplicacaoPromocao'); if (aplicacao) aplicacao.value = 'todas';
  var faixas = document.getElementById('faixasPromocao'); if (faixas) faixas.innerHTML = '';
  var titulo = document.getElementById('tituloModalPromocao'); if (titulo) titulo.textContent = 'Nova promoção';
  atualizarTipoPromocaoLoja();
  renderizarProdutosPromocao();
  var botao = document.getElementById('btnAdicionarPromocao'); if (botao) botao.textContent = 'Salvar promoção';
}
function resumirPromocaoLoja(promocao) {
  if (promocao.tipo === 'quantidade' && Array.isArray(promocao.faixas) && promocao.faixas.length) {
    var modo = promocao.quantidadeModo || 'a_cada';
    var prefixo = modo === 'a_partir' ? 'A partir de' : 'A cada';
    var sufixo = modo === 'a_partir' ? 'por peça' : 'por grupo';
    return prefixo + ' ' + promocao.faixas.map(function (f) { return (parseInt(f.quantidade) || 0) + ' un. por R$ ' + (parseFloat(f.preco) || 0).toFixed(2) + ' ' + sufixo; }).join(' · ');
  }
  if (promocao.tipo === 'percentual') return (parseFloat(promocao.valor) || 0) + '% de desconto';
  return 'Preço promocional: R$ ' + (parseFloat(promocao.valor) || 0).toFixed(2);
}
async function carregarPromocoes() {
  var user = FB.auth.currentUser; if (!user) return;
  var container = document.getElementById('listaPromocoes');
  try {
    var snap = await db.collection('lojistas').doc(user.email).collection('promocoes').get();
    if (!container) return;
    container.innerHTML = snap.docs.map(function (doc) {
      var p = doc.data();
      var tipo = resumirPromocaoLoja(p);
      var alvo = Array.isArray(p.produtoIds) ? p.produtoIds.length + ' produto(s)' : 'Sem produtos';
      var validade = p.fim ? 'até ' + new Date(p.fim + 'T23:59:59').toLocaleDateString('pt-BR') : 'Sem validade final';
      var ativo = p.ativo !== 'nao';
      return '<div class="item-lista"><div><strong>' + escaparTextoPromocao(p.nome || 'Promoção') + '</strong><br><small>' + tipo + ' · ' + alvo + ' · ' + validade + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch" title="' + (ativo ? 'Desativar promoção' : 'Ativar promoção') + '"><input type="checkbox" ' + (ativo ? 'checked' : '') + ' onchange="toggleAtivoPromocao(\'' + escaparTextoPromocao(doc.id) + '\', this.checked)"><span class="slider"></span></label> ' + (ativo ? 'Ativa' : 'Inativa') + '</div></div><div class="acoes"><button class="btn-pequeno" onclick="editarPromocao(\'' + escaparTextoPromocao(doc.id) + '\')">Editar</button><button class="btn-pequeno" onclick="duplicarPromocao(\'' + escaparTextoPromocao(doc.id) + '\')">Duplicar</button><button class="btn-pequeno" style="color:#dc2626" onclick="excluirPromocao(\'' + escaparTextoPromocao(doc.id) + '\')">Excluir</button></div></div>';
    }).join('') || '<p style="text-align:center;">Nenhuma promoção criada.</p>';
  } catch (e) { if (container) container.innerHTML = '<p style="text-align:center;">Não foi possível carregar as promoções.</p>'; }
}
function obterDadosFormularioPromocao() {
  var tipo = (document.getElementById('novoTipoPromocao') && document.getElementById('novoTipoPromocao').value) || 'preco';
  var nome = ((document.getElementById('novoNomePromocao') && document.getElementById('novoNomePromocao').value) || '').trim();
  var produtoIds = promocaoProdutosSelecionados.slice();
  var aplicacao = (document.getElementById('aplicacaoPromocao') && document.getElementById('aplicacaoPromocao').value) || 'todas';
  var quantidadeModo = (document.getElementById('modoQuantidadePromocao') && document.getElementById('modoQuantidadePromocao').value) || 'a_cada';
  var dados = { nome: nome, tipo: tipo, ativo: (promocaoEmEdicao && promocaoEmEdicao.ativo) || 'sim', inicio: (document.getElementById('novoInicioPromocao') && document.getElementById('novoInicioPromocao').value) || null, fim: (document.getElementById('novoFimPromocao') && document.getElementById('novoFimPromocao').value) || null, produtoIds: produtoIds, aplicacao: aplicacao, variacoes: aplicacao === 'especificas' ? promocaoVariacoesSelecionadas.slice() : [], quantidadeModo: tipo === 'quantidade' ? quantidadeModo : null };
  if (tipo === 'quantidade') dados.faixas = obterFaixasPromocao();
  else dados.valor = parseFloat(document.getElementById('novoValorPromocao') && document.getElementById('novoValorPromocao').value);
  return dados;
}
function validarDadosPromocao(dados) {
  if (!dados.nome) return 'Informe o nome da promoção.';
  if (!dados.produtoIds.length) return 'Selecione pelo menos um produto.';
  if (dados.tipo === 'quantidade') {
    if (!dados.faixas.length) return 'Adicione pelo menos uma faixa de quantidade.';
    if (dados.faixas.some(function (f) { return f.quantidade < 1 || f.preco < 0; })) return 'Revise as faixas de quantidade.';
  } else if (isNaN(dados.valor) || dados.valor <= 0 || (dados.tipo === 'percentual' && dados.valor > 100)) return 'Informe um valor de promoção válido.';
  if (dados.aplicacao === 'especificas' && !dados.variacoes.length) return 'Escolha pelo menos uma variação.';
  return null;
}
async function salvarPromocaoLoja() {
  var dados = obterDadosFormularioPromocao();
  var erro = validarDadosPromocao(dados);
  if (erro) { EU.mostrarToast(erro, 'erro'); return; }
  var user = FB.auth.currentUser; if (!user) return;
  EU.showLoading(promocaoEmEdicao ? (promocaoEmEdicao.isDuplicar ? 'Duplicando promoção...' : 'Salvando promoção...') : 'Criando promoção...');
  try {
    var ref = db.collection('lojistas').doc(user.email).collection('promocoes');
    if (promocaoEmEdicao && !promocaoEmEdicao.isDuplicar) {
      await ref.doc(promocaoEmEdicao.id).update(Object.assign({}, dados, { atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() }));
      EU.mostrarToast('Promoção "' + dados.nome + '" atualizada!', 'sucesso');
    } else {
      dados.criadoEm = firebase.firestore.FieldValue.serverTimestamp();
      await ref.add(dados);
      EU.mostrarToast(promocaoEmEdicao && promocaoEmEdicao.isDuplicar ? 'Promoção "' + dados.nome + '" duplicada!' : 'Promoção "' + dados.nome + '" criada!', 'sucesso');
    }
    await carregarPromocoes();
    limparFormularioPromocao();
    fecharModalPromocaoLoja();
  } catch (e) { EU.mostrarToast(e.message, 'erro'); }
  finally { EU.hideLoading(); }
}
async function toggleAtivoPromocao(id, ativo) {
  try {
    var doc = await db.collection('lojistas').doc(emailAtual).collection('promocoes').doc(id).get();
    var nome = doc.exists ? (doc.data().nome || '') : '';
    await db.collection('lojistas').doc(emailAtual).collection('promocoes').doc(id).update({ ativo: ativo ? 'sim' : 'nao' });
    EU.mostrarToast(nome ? 'Promoção "' + nome + '" agora está ' + (ativo ? 'ativa' : 'inativa') + '.' : (ativo ? 'Promoção ativa!' : 'Promoção inativa.'), 'sucesso');
    await carregarPromocoes();
  } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); await carregarPromocoes(); }
}
async function excluirPromocao(id) {
  var doc = await db.collection('lojistas').doc(emailAtual).collection('promocoes').doc(id).get();
  var nome = doc.exists ? (doc.data().nome || 'esta promoção') : 'esta promoção';
  if (!await EU.confirmar('Excluir a promoção "' + nome + '"? Essa ação não pode ser desfeita.')) return;
  try { await db.collection('lojistas').doc(emailAtual).collection('promocoes').doc(id).delete(); await carregarPromocoes(); EU.mostrarToast('Promoção "' + nome + '" removida.', 'sucesso'); }
  catch (e) { EU.mostrarToast(e.message, 'erro'); }
}
async function editarPromocao(id, isDuplicar) {
  var user = FB.auth.currentUser; if (!user) return;
  try {
    var snap = await db.collection('lojistas').doc(user.email).collection('promocoes').doc(id).get();
    if (!snap.exists) return;
    var p = snap.data();
    alternarModoCampanhaLoja('promocao');
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
    var aplicacao = document.getElementById('aplicacaoPromocao'); if (aplicacao) aplicacao.value = p.aplicacao || 'todas';
    var faixas = document.getElementById('faixasPromocao'); if (faixas) { faixas.innerHTML = ''; (p.faixas || []).forEach(function (f) { adicionarFaixaPromocao(f); }); }
    var titulo = document.getElementById('tituloModalPromocao'); if (titulo) titulo.textContent = isDuplicar ? 'Duplicar promoção' : 'Editar promoção';
    atualizarTipoPromocaoLoja();
    atualizarModoQuantidadePromocao();
    renderizarProdutosPromocao();
    document.getElementById('btnAdicionarPromocao').textContent = isDuplicar ? 'Duplicar promoção' : 'Salvar alterações';
    abrirModalPromocaoLoja();
  } catch (e) { EU.mostrarToast('Não foi possível abrir a promoção: ' + e.message, 'erro'); }
}
function duplicarPromocao(id) { editarPromocao(id, true); }

function configurarPainelPromocoes() {
  var b1 = document.getElementById('btnNovoCupom'); if (b1) b1.addEventListener('click', function () { limparFormularioCupom(); abrirModalCupomLoja(); });
  var b2 = document.getElementById('btnNovaPromocao'); if (b2) b2.addEventListener('click', async function () { alternarModoCampanhaLoja('promocao'); limparFormularioPromocao(); await carregarProdutosParaPromocao(); abrirModalPromocaoLoja(); });
  var b3 = document.getElementById('btnFecharPromocaoModal'); if (b3) b3.addEventListener('click', function () { fecharModalPromocaoLoja(); limparFormularioPromocao(); });
  var b4 = document.getElementById('btnCancelarPromocaoModal'); if (b4) b4.addEventListener('click', function () { fecharModalPromocaoLoja(); limparFormularioPromocao(); });
  var b5 = document.getElementById('btnFecharCupomModal'); if (b5) b5.addEventListener('click', function () { fecharModalCupomLoja(); limparFormularioCupom(); });
  var b6 = document.getElementById('btnCancelarCupomModal'); if (b6) b6.addEventListener('click', function () { fecharModalCupomLoja(); limparFormularioCupom(); });
  var m1 = document.getElementById('modalCupom'); if (m1) m1.addEventListener('click', function (e) { if (e.target.id === 'modalCupom') { fecharModalCupomLoja(); limparFormularioCupom(); } });
  var m2 = document.getElementById('modalPromocao'); if (m2) m2.addEventListener('click', function (e) { if (e.target.id === 'modalPromocao') { fecharModalPromocaoLoja(); limparFormularioPromocao(); } });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modalCupom') && document.getElementById('modalCupom').classList.contains('active')) { fecharModalCupomLoja(); limparFormularioCupom(); }
    if (document.getElementById('modalPromocao') && document.getElementById('modalPromocao').classList.contains('active')) { fecharModalPromocaoLoja(); limparFormularioPromocao(); }
  });
  var m3 = document.getElementById('btnModoCupom'); if (m3) m3.addEventListener('click', function () { alternarModoCampanhaLoja('cupom'); });
  var m4 = document.getElementById('btnModoPromocao'); if (m4) m4.addEventListener('click', function () { alternarModoCampanhaLoja('promocao'); });
  var t1 = document.getElementById('novoTipoPromocao'); if (t1) t1.addEventListener('change', atualizarTipoPromocaoLoja);
  var t2 = document.getElementById('modoQuantidadePromocao'); if (t2) t2.addEventListener('change', atualizarModoQuantidadePromocao);
  var t3 = document.getElementById('buscaProdutosPromocao'); if (t3) t3.addEventListener('input', renderizarProdutosPromocao);
  var t4 = document.getElementById('limparBuscaProdutosPromocao'); if (t4) t4.addEventListener('click', function () { var b = document.getElementById('buscaProdutosPromocao'); if (b) b.value = ''; renderizarProdutosPromocao(); if (b) b.focus(); });
  var t5 = document.getElementById('aplicacaoPromocao'); if (t5) t5.addEventListener('change', atualizarAplicacaoVariacoesPromocao);
  var t6 = document.getElementById('btnAdicionarFaixaPromocao'); if (t6) t6.addEventListener('click', function () { adicionarFaixaPromocao(); });
  var t7 = document.getElementById('btnAdicionarCupom'); if (t7) t7.addEventListener('click', salvarCupomLoja);
  var t8 = document.getElementById('btnAdicionarPromocao'); if (t8) t8.addEventListener('click', salvarPromocaoLoja);
  adicionarFaixaPromocao();
  atualizarTipoPromocaoLoja();
}

/* ============================================================
   MODAIS DE CADASTRO GENÉRICOS
   ============================================================ */
function abrirModalCadastro(id) { var m = document.getElementById(id); if (m) m.classList.add('active'); }
function fecharModalCadastro(id) { var m = document.getElementById(id); if (m) m.classList.remove('active'); }

function configurarModaisCadastroLoja() {
  var b1 = document.getElementById('btnNovoProduto'); if (b1) b1.addEventListener('click', function () { resetarFormularioProdutoLoja(); abrirModalProdutoLoja(); });
  var b2 = document.getElementById('btnFecharProdutoModal'); if (b2) b2.addEventListener('click', function () { fecharModalProdutoLoja(); resetarFormularioProdutoLoja(); });
  var b3 = document.getElementById('btnCancelarProdutoModal'); if (b3) b3.addEventListener('click', function () { fecharModalProdutoLoja(); resetarFormularioProdutoLoja(); });
  var b4 = document.getElementById('btnNovoFrete'); if (b4) b4.addEventListener('click', function () { limparFormularioFreteLoja(); abrirModalFreteLoja(); });
  var b5 = document.getElementById('btnFecharFreteModal'); if (b5) b5.addEventListener('click', function () { fecharModalFreteLoja(); limparFormularioFreteLoja(); });
  var b6 = document.getElementById('btnCancelarFreteModal'); if (b6) b6.addEventListener('click', function () { fecharModalFreteLoja(); limparFormularioFreteLoja(); });
  var m1 = document.getElementById('modalProduto'); if (m1) m1.addEventListener('click', function (e) { if (e.target.id === 'modalProduto') { fecharModalProdutoLoja(); resetarFormularioProdutoLoja(); } });
  var m2 = document.getElementById('modalFrete'); if (m2) m2.addEventListener('click', function (e) { if (e.target.id === 'modalFrete') { fecharModalFreteLoja(); limparFormularioFreteLoja(); } });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (document.getElementById('modalProduto') && document.getElementById('modalProduto').classList.contains('active')) { fecharModalProdutoLoja(); resetarFormularioProdutoLoja(); }
    if (document.getElementById('modalFrete') && document.getElementById('modalFrete').classList.contains('active')) { fecharModalFreteLoja(); limparFormularioFreteLoja(); }
  });
}

/* ============================================================
   RESUMO (cliques nos cards)
   ============================================================ */
function abrirModal(titulo, conteudo) {
  var modal = document.createElement('div');
  modal.className = 'modal-overlay active';
  modal.innerHTML = '<div class="modal-conteudo"><div class="modal-header"><h3>' + titulo + '</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">×</button></div><div class="modal-body">' + conteudo + '</div></div>';
  document.body.appendChild(modal);
}
function mostrarPedidosPeriodo() { if (!pedidosAtuais.length) return EU.mostrarToast('Nenhum pedido.', 'erro'); var lista = pedidosAtuais.map(function (p) { return '<div onclick="verDetalhesPedido(\'' + p.id + '\')">#' + (p.codigoCurto || p.id.slice(0, 6)) + ' - R$ ' + (p.total || 0).toFixed(2) + ' - ' + p.clienteNome + '</div>'; }).join(''); abrirModal('Lista de Pedidos', lista); }
function mostrarRankingVendas() { if (!rankingVendas.length) return EU.mostrarToast('Nenhuma venda.', 'erro'); var lista = rankingVendas.map(function (r, i) { return '<div>' + (i + 1) + 'º ' + r[0] + ' - ' + r[1] + ' vendidos</div>'; }).join(''); abrirModal('Itens Mais Vendidos', lista); }
function mostrarPedidoMaisCaro() { if (!pedidosAtuais.length) return; var maisCaro = pedidosAtuais.slice().sort(function (a, b) { return (b.total || 0) - (a.total || 0); })[0]; abrirModal('Maior Venda', '<div><h3>#' + (maisCaro.codigoCurto || maisCaro.id.slice(0, 6)) + '</h3><p>R$ ' + (maisCaro.total || 0).toFixed(2) + '</p><p>Cliente: ' + maisCaro.clienteNome + '</p><button class="btn-primary" onclick="verDetalhesPedido(\'' + maisCaro.id + '\')">Ver Pedido</button></div>'); }
function verDetalhesPedido(id) { var el = document.querySelector('.pedido-card[data-id="' + id + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.querySelectorAll('.modal-overlay').forEach(function (m) { m.remove(); }); }

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
    if (t === 'itens') carregarCardapio();
    if (t === 'entrega') carregarFretes();
    if (t === 'cupons') { carregarCupons(); carregarPromocoes(); carregarProdutosParaPromocao(); }
  });
});
function toggleCollapse(headerElement, contentId) {
  var content = document.getElementById(contentId);
  var btn = headerElement.querySelector('.collapse-btn');
  if (!content || !btn) return;
  if (content.classList.contains('open')) { content.classList.remove('open'); btn.innerHTML = '+'; btn.setAttribute('aria-label', 'Expandir'); headerElement.setAttribute('aria-expanded', 'false'); }
  else { content.classList.add('open'); btn.innerHTML = '\u2212'; btn.setAttribute('aria-label', 'Recolher'); headerElement.setAttribute('aria-expanded', 'true'); }
}

/* ============================================================
   BOOTSTRAP
   ============================================================ */
configurarModaisCadastroLoja();
configurarPainelPromocoes();
alternarModoCampanhaLoja('cupom');

window.toggleTipoProduto = toggleTipoProduto;
window.selecionarTipoProdutoLoja = selecionarTipoProdutoLoja;
window.adicionarAtributo = adicionarAtributo;
window.removerAtributo = removerAtributo;
window.gerarVariacoes = gerarVariacoes;
window.uploadImagensProduto = uploadImagensProduto;
window.uploadImagensVariacao = uploadImagensVariacao;
window.removerImagemExtra = removerImagemExtra;
window.removerImagemVariacao = removerImagemVariacao;
window.atualizarStatus = atualizarStatus;
window.excluirPedido = excluirPedido;
window.imprimirTicket = imprimirTicket;
window.falarComCliente = falarComCliente;
window.compartilharMotoboy = compartilharMotoboy;
window.abrirModalEditarProduto = abrirModalEditarProduto;
window.duplicarProduto = duplicarProduto;
window.excluirItemCardapio = excluirItemCardapio;
window.toggleAtivoProduto = toggleAtivoProduto;
window.toggleAtivoFrete = toggleAtivoFrete;
window.duplicarFrete = duplicarFrete;
window.excluirFrete = excluirFrete;
window.editarFreteModal = editarFreteModal;
window.toggleAtivoCupom = toggleAtivoCupom;
window.duplicarCupom = duplicarCupom;
window.excluirCupom = excluirCupom;
window.editarCupomModal = editarCupomModal;
window.toggleAtivoPromocao = toggleAtivoPromocao;
window.editarPromocao = editarPromocao;
window.duplicarPromocao = duplicarPromocao;
window.excluirPromocao = excluirPromocao;
window.abrirModalRepetirDados = abrirModalRepetirDados;
window.fecharModalRepetirDados = fecharModalRepetirDados;
window.aplicarRepetirDados = aplicarRepetirDados;
window.selecionarTodosRepetirDados = selecionarTodosRepetirDados;
window.renderizarVariacoes = renderizarVariacoes;
window.filtrarVariacoesVisual = filtrarVariacoesVisual;
window.atualizarPreviewProdutoLoja = atualizarPreviewProdutoLoja;
window.atualizarPreviewImagensExtras = atualizarPreviewImagensExtras;
window.atualizarImagensProdutoPorUrl = atualizarImagensProdutoPorUrl;
window.mostrarPedidosPeriodo = mostrarPedidosPeriodo;
window.mostrarRankingVendas = mostrarRankingVendas;
window.mostrarPedidoMaisCaro = mostrarPedidoMaisCaro;
window.verDetalhesPedido = verDetalhesPedido;
window.toggleCollapse = toggleCollapse;

/* ============================================================
   AUTH + INÍCIO
   ============================================================ */
Auth.iniciar({
  tipo: 'lojista',
  contexto: 'loja',
  prefixosEsperados: PREFIXOS_LOJA,
  aoEntrar: function (user, dados) {
    emailAtual = user.email;
    estId = dados.estabelecimentoId;

    document.getElementById('periodoSelect').addEventListener('change', carregarPedidos);
    document.getElementById('statusFiltroSelect').addEventListener('change', carregarPedidos);
    document.getElementById('ordemSelect').addEventListener('change', carregarPedidos);
    document.getElementById('tipoPedidoFiltro').addEventListener('change', carregarPedidos);

    carregarPedidos();
    carregarCardapio();
    carregarFretes();
    carregarCupons();
    carregarPromocoes();

    // Transição: esconde overlay quando tudo carregou
    if (window.EconomizeiPainel && EconomizeiPainel.Transicao) {
      setTimeout(function () { EconomizeiPainel.Transicao.esconderOverlay(); }, 300);
    }
  }
});

})();
