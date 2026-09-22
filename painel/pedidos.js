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
    var ultimoPedidoTimestamp = Date.now();
    var pedidosAtuais = [];
    var rankingVendas = [];
    var saboresGlobais = [];
    var extrasGlobais = [];
    var cardapioCompletoCache = [];
    var cardapioCacheCarregado = false;

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
            if (campoUrl === 'novoItemImagem' && typeof atualizarPreviewProduto === 'function') atualizarPreviewProduto();
            EU.mostrarToast('Imagem enviada!', 'sucesso');
        } catch (e) { EU.mostrarToast('Erro ao enviar imagem: ' + e.message, 'erro'); }
        finally { EU.hideLoading(); }
    }
    function uploadImagemProduto(input) { if (input.files && input.files[0]) uploadImagem(input.files[0], 'novoItemImagem', 'previewItemImagem'); }
    function uploadImagemSabor(input)   { if (input.files && input.files[0]) uploadImagem(input.files[0], 'novoSaborImagem', 'previewSaborImagem'); }
    function uploadImagemExtra(input)   { if (input.files && input.files[0]) uploadImagem(input.files[0], 'novoExtraImagem', 'previewExtraImagem'); }

    function atualizarBadgePendentes() {
        var pendentes = pedidosAtuais.filter(function (p) { return p.status === 'pendente'; }).length;
        var badge = document.getElementById('badgePendentes');
        if (pendentes > 0) { badge.textContent = pendentes; badge.style.display = 'inline-block'; }
        else badge.style.display = 'none';
    }
    function carregarPedidos() {
        if (unsubscribePedidos) unsubscribePedidos();
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
            pedidosArray.sort(function (a, b) { return (b.criadoEm && b.criadoEm.toDate ? b.criadoEm.toDate().getTime() : 0) - (a.criadoEm && a.criadoEm.toDate ? a.criadoEm.toDate().getTime() : 0); });
            var agora = Date.now();
            pedidosArray.forEach(function (p) {
                var ts = p.criadoEm && p.criadoEm.toDate ? p.criadoEm.toDate().getTime() : 0;
                if (ts > ultimoPedidoTimestamp && agora - ultimoPedidoTimestamp > 1000) { notificarNovoPedido(p); ultimoPedidoTimestamp = ts; }
            });
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
        try { await db.collection('pedidos').doc(id).update({ status: novoStatus }); EU.mostrarToast('Status atualizado!', 'sucesso'); }
        catch (e) { EU.mostrarToast(e.message, 'erro'); }
        finally { EU.hideLoading(); }
    }
    async function excluirPedido(id) {
        if (!confirm('Excluir?')) return;
        EU.showLoading('Excluindo...');
        try { await db.collection('pedidos').doc(id).delete(); }
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
        if (confirm('Link copiado! Abrir WhatsApp?')) window.open('https://wa.me/' + EU.formatarWhatsapp(p.clienteTelefone) + '?text=' + encodeURIComponent('Olá! Link da entrega: ' + link), '_blank');
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

    async function carregarCardapio() {
        if (!emailAtual) return;
        var container = document.getElementById('listaCardapio');
        var snap = await db.collection('lojistas').doc(emailAtual).collection('cardapio').get();
        var todosItens = snap.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); });
        cardapioCompletoCache = todosItens;
        var termo = (document.getElementById('buscaProdutoInput') || {}).value;
        termo = termo ? termo.trim().toLowerCase() : '';
        var itens = termo ? todosItens.filter(function (s) { return (s.nome || '').toLowerCase().indexOf(termo) !== -1 || (s.categoria || '').toLowerCase().indexOf(termo) !== -1; }) : todosItens;
        if (itens.length === 0) { container.innerHTML = '<p style="text-align:center; padding:30px;">' + (termo ? 'Nenhum produto encontrado.' : 'Nenhum item cadastrado.') + '</p>'; return; }
        container.innerHTML = itens.map(function (s) {
            var precosStr = '';
            if (s.precos && typeof s.precos === 'object') precosStr = Object.keys(s.precos).map(function (t) { return t + ': R$ ' + parseFloat(s.precos[t]).toFixed(2); }).join(' | ');
            else precosStr = 'Geral: R$ ' + parseFloat(s.preco || s.valor || 0).toFixed(2);
            var disp = s.disponivel !== 'nao';
            return '<div class="item-lista" data-id="' + s.id + '"><div><strong>' + EU.sanitize(s.nome) + '</strong><br><small>Preços: ' + precosStr + ' | Categorias: ' + EU.sanitize(s.categoria || s.categorias || 'Todas') + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch"><input type="checkbox" ' + (disp ? 'checked' : '') + ' onchange="toggleDisponibilidadeProduto(\'' + s.id + '\', this.checked)"><span class="slider"></span></label> ' + (disp ? 'Disponível' : 'Indisponível') + '</div></div><div class="acoes"><button class="btn-pequeno" onclick="abrirModalEditarProduto(\'' + s.id + '\')">Editar</button><button class="btn-pequeno" onclick="duplicarProduto(\'' + s.id + '\')">Duplicar</button><button class="btn-pequeno" style="color:#dc2626;" onclick="excluirItemCardapio(\'' + s.id + '\')">Excluir</button></div></div>';
        }).join('');
    }
    async function toggleDisponibilidadeProduto(id, disp) {
        try { await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).update({ disponivel: disp ? 'sim' : 'nao' }); EU.mostrarToast(disp ? 'Produto disponível!' : 'Produto indisponível.', 'sucesso'); }
        catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); carregarCardapio(); }
    }
    async function excluirItemCardapio(id) {
        if (!confirm('Excluir este item do cardápio?')) return;
        EU.showLoading('Excluindo...');
        try { await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).delete(); await carregarCardapio(); EU.mostrarToast('Item removido!', 'sucesso'); }
        catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
        finally { EU.hideLoading(); }
    }
    function duplicarProduto(id) { abrirModalEditarProduto(id, true); }

    async function abrirModalEditarProduto(id, isDuplicar) {
        var doc = await db.collection('lojistas').doc(emailAtual).collection('cardapio').doc(id).get();
        if (!doc.exists) return;
        var item = doc.data();
        var modal = document.createElement('div'); modal.className = 'modal-overlay active';
        var titulo = isDuplicar ? 'Duplicar Produto' : 'Editar Produto';
        var tipoHtml = '';
        if (item.tipo === 'simples') {
            tipoHtml = '<div class="campo"><label>Preço (R$) <span class="obrigatorio">*</span></label><input type="number" step="0.01" id="editPreco" value="' + (item.preco || 0) + '"></div>';
        } else if (item.tipo === 'tamanhos') {
            var tams = (item.tamanhos || []).map(function (t) { return '<tr><td><input type="text" value="' + EU.sanitize(t.nome) + '" class="tam-nome"></td><td><input type="number" step="0.01" value="' + t.preco + '" class="tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>'; }).join('');
            tipoHtml = '<div class="campo"><label>Tamanhos <span class="obrigatorio">*</span></label><table class="tabela-tamanhos"><tbody id="editTamanhosContainer">' + (tams || '<tr><td><input type="text" placeholder="Nome" class="tam-nome"></td><td><input type="number" step="0.01" placeholder="Preço" class="tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>') + '</tbody></table><button type="button" class="btn-pequeno" onclick="adicionarLinhaTamanho(\'editTamanhosContainer\')">+ Adicionar tamanho</button></div><div class="campo"><label>Adicionais disponíveis</label><div id="editExtrasCheckboxLista" class="checkbox-group"></div></div>';
        } else if (item.tipo === 'personalizavel') {
            var tamsP = (item.tamanhosDisponiveis || []).map(function (t) { return '<tr><td><input type="text" value="' + EU.sanitize(t.nome) + '" class="tam-perso-nome"></td><td><input type="number" value="' + (t.maxSabores || 1) + '" class="tam-perso-max"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>'; }).join('');
            tipoHtml = '<div class="campo"><label>Tamanhos disponíveis <span class="campo-ajuda">(opcional)</span></label><table class="tabela-tamanhos"><tbody id="editTamanhosPersoContainer">' + tamsP + '</tbody></table><button type="button" class="btn-pequeno" onclick="adicionarLinhaTamanho(\'editTamanhosPersoContainer\')">+ Adicionar tamanho</button></div><div class="campo"><label>Sabores disponíveis</label><div id="editSaboresCheckboxLista" class="checkbox-group"></div></div><div class="campo"><label>Adicionais disponíveis</label><div id="editExtrasCheckboxListaPersonalizavel" class="checkbox-group"></div></div>';
        }
        var nomePadrao = isDuplicar ? item.nome + ' (cópia)' : item.nome;
        var isIlim = item.estoqueIlimitado !== false && (item.estoque === '' || item.estoque === null || item.estoque === undefined);
        modal.innerHTML = '<div class="modal-conteudo"><div class="modal-header"><h3>' + titulo + '</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div><div class="campo"><label>Nome <span class="obrigatorio">*</span></label><input type="text" id="editNome" value="' + EU.sanitize(nomePadrao) + '"></div><div class="campo"><label>Categoria</label><input type="text" id="editCategoria" value="' + EU.sanitize(item.categoria || '') + '" onchange="atualizarEditCheckboxes()"></div><div class="campo"><label>Descrição</label><textarea id="editDescricao" rows="2">' + EU.sanitize(item.descricao || '') + '</textarea></div>' + tipoHtml + '<div class="campo"><label>Imagem</label><div class="upload-imagem-container"><input type="text" id="editImagem" value="' + EU.sanitize(item.imagem || '') + '" placeholder="URL"><input type="file" id="editImagemFile" accept="image/*" onchange="uploadImagemEdit(this)"><button type="button" class="btn-pequeno" onclick="document.getElementById(\'editImagemFile\').click()">Selecionar</button></div><div id="previewEditImagem">' + (item.imagem ? '<img src="' + EU.sanitize(item.imagem) + '" class="preview-imagem">' : '') + '</div></div><div class="campo estoque-controle"><label>Controle de estoque</label><div class="estoque-ajuda">Deixe ilimitado ou informe uma quantidade inteira.</div><label class="checkbox-inline-label"><input type="checkbox" id="editEstoqueIlimitado" ' + (isIlim ? 'checked' : '') + ' onchange="toggleEstoqueIlimitado(this, \'editEstoque\')"> Não controlar estoque (ilimitado)</label><input type="number" min="0" step="1" id="editEstoque" value="' + (item.estoque != null ? item.estoque : '') + '" placeholder="Quantidade disponível" ' + (isIlim ? 'disabled' : '') + '></div><div class="campo"><label>Disponível</label><select id="editDisponivel"><option value="sim"' + (item.disponivel === 'sim' ? ' selected' : '') + '>Sim</option><option value="nao"' + (item.disponivel === 'nao' ? ' selected' : '') + '>Não</option></select></div><button class="btn-primary" id="saveEditProduto"><span class="spinner-btn"></span><span class="btn-text">' + (isDuplicar ? 'Duplicar' : 'Salvar') + '</span></button></div>';
        document.body.appendChild(modal);
        window.uploadImagemEdit = async function (input) {
            if (!input.files || !input.files[0]) return;
            EU.showLoading('Enviando imagem...');
            try { var url = await enviarImagemCloudinary(input.files[0]); document.getElementById('editImagem').value = url; document.getElementById('previewEditImagem').innerHTML = '<img src="' + url + '" class="preview-imagem">'; EU.mostrarToast('Imagem enviada!', 'sucesso'); }
            catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
            finally { EU.hideLoading(); }
        };
        if (item.tipo === 'tamanhos') await carregarEditExtrasCheckboxes(item.extrasPermitidos || []);
        else if (item.tipo === 'personalizavel') { await carregarEditSaboresCheckboxes(item.saboresPermitidos || []); await carregarEditExtrasCheckboxesPersonalizavel(item.extrasPermitidos || []); }
        async function carregarEditExtrasCheckboxes(sel) {
            var snap = await db.collection('lojistas').doc(emailAtual).collection('extras').get();
            var extras = snap.docs.map(function (d) { return { id: d.id, nome: d.data().nome, categorias: d.data().categorias || '' }; });
            var cat = document.getElementById('editCategoria').value.trim();
            var filtered = cat ? extras.filter(function (e) { return !e.categorias || e.categorias === '' || e.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(cat) !== -1; }) : extras;
            document.getElementById('editExtrasCheckboxLista').innerHTML = filtered.map(function (e) { return '<label for="ed_it_ex_' + e.id + '" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:4px 0;"><input type="checkbox" id="ed_it_ex_' + e.id + '" value="' + e.id + '"' + (sel.indexOf(e.id) !== -1 ? ' checked' : '') + '> ' + EU.sanitize(e.nome) + '</label>'; }).join('');
        }
        async function carregarEditExtrasCheckboxesPersonalizavel(sel) {
            var snap = await db.collection('lojistas').doc(emailAtual).collection('extras').get();
            var extras = snap.docs.map(function (d) { return { id: d.id, nome: d.data().nome, categorias: d.data().categorias || '' }; });
            var cat = document.getElementById('editCategoria').value.trim();
            var filtered = cat ? extras.filter(function (e) { return !e.categorias || e.categorias === '' || e.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(cat) !== -1; }) : extras;
            document.getElementById('editExtrasCheckboxListaPersonalizavel').innerHTML = filtered.map(function (e) { return '<label for="ed_pe_ex_' + e.id + '" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:4px 0;"><input type="checkbox" id="ed_pe_ex_' + e.id + '" value="' + e.id + '"' + (sel.indexOf(e.id) !== -1 ? ' checked' : '') + '> ' + EU.sanitize(e.nome) + '</label>'; }).join('');
        }
        async function carregarEditSaboresCheckboxes(sel) {
            var snap = await db.collection('lojistas').doc(emailAtual).collection('sabores').get();
            var sabores = snap.docs.map(function (d) { return { id: d.id, nome: d.data().nome, categorias: d.data().categorias || '' }; });
            var cat = document.getElementById('editCategoria').value.trim();
            var filtered = cat ? sabores.filter(function (s) { return !s.categorias || s.categorias === '' || s.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(cat) !== -1; }) : sabores;
            document.getElementById('editSaboresCheckboxLista').innerHTML = filtered.map(function (s) { return '<label for="ed_sa_' + s.id + '" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:4px 0;"><input type="checkbox" id="ed_sa_' + s.id + '" value="' + s.id + '"' + (sel.indexOf(s.id) !== -1 ? ' checked' : '') + '> ' + EU.sanitize(s.nome) + '</label>'; }).join('');
        }
        window.atualizarEditCheckboxes = function () {
            var exAtuais = Array.from(document.querySelectorAll('#editExtrasCheckboxLista input:checked, #editExtrasCheckboxListaPersonalizavel input:checked')).map(function (cb) { return cb.value; });
            var sabAtuais = Array.from(document.querySelectorAll('#editSaboresCheckboxLista input:checked')).map(function (cb) { return cb.value; });
            if (item.tipo === 'tamanhos') carregarEditExtrasCheckboxes(exAtuais);
            else if (item.tipo === 'personalizavel') { carregarEditSaboresCheckboxes(sabAtuais); carregarEditExtrasCheckboxesPersonalizavel(exAtuais); }
        };
        document.getElementById('saveEditProduto').onclick = async function () {
            var btn = this; btn.classList.add('loading'); btn.disabled = true;
            try {
                var nome = document.getElementById('editNome').value.trim();
                if (!nome) { EU.mostrarToast('Nome obrigatório.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
                var updates = { nome: nome, categoria: document.getElementById('editCategoria').value.trim(), descricao: document.getElementById('editDescricao').value.trim(), imagem: document.getElementById('editImagem').value.trim(), estoque: document.getElementById('editEstoqueIlimitado').checked ? '' : Number.parseInt(document.getElementById('editEstoque').value, 10), estoqueIlimitado: document.getElementById('editEstoqueIlimitado').checked, disponivel: document.getElementById('editDisponivel').value, tipo: item.tipo };
                if (item.tipo === 'simples') {
                    var preco = parseFloat(document.getElementById('editPreco').value);
                    if (isNaN(preco) || preco < 0) { EU.mostrarToast('Preço inválido.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
                    updates.preco = preco;
                } else if (item.tipo === 'tamanhos') {
                    var tams = [];
                    document.querySelectorAll('#editTamanhosContainer tr').forEach(function (tr) { var inputs = tr.querySelectorAll('input'); if (inputs.length === 2) { var n = inputs[0].value.trim(), p = parseFloat(inputs[1].value); if (n && !isNaN(p)) tams.push({ nome: n, preco: p }); } });
                    if (tams.length === 0) { EU.mostrarToast('Adicione pelo menos um tamanho.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
                    updates.tamanhos = tams;
                    updates.extrasPermitidos = Array.from(document.querySelectorAll('#editExtrasCheckboxLista input:checked')).map(function (cb) { return cb.value; });
                } else if (item.tipo === 'personalizavel') {
                    updates.tamanhosDisponiveis = coletarTamanhos('editTamanhosPersoContainer');
                    updates.tamanhoObrigatorio = false;
                    updates.saboresPermitidos = Array.from(document.querySelectorAll('#editSaboresCheckboxLista input:checked')).map(function (cb) { return cb.value; });
                    updates.saboresObrigatorios = false;
                    updates.extrasPermitidos = Array.from(document.querySelectorAll('#editExtrasCheckboxListaPersonalizavel input:checked')).map(function (cb) { return cb.value; });
                }
                var ref = db.collection('lojistas').doc(emailAtual).collection('cardapio');
                if (isDuplicar) { await ref.add(updates); EU.mostrarToast('Produto duplicado!', 'sucesso'); }
                else { await ref.doc(id).update(updates); EU.mostrarToast('Produto atualizado!', 'sucesso'); }
                await carregarCardapio();
                modal.remove();
            } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
            finally { btn.classList.remove('loading'); btn.disabled = false; }
        };
    }

    function abrirModalCadastro(id) { var m = document.getElementById(id); if (m) m.classList.add('active'); }
    function fecharModalCadastro(id) { var m = document.getElementById(id); if (m) m.classList.remove('active'); }
    function fecharModalProdutoCadastro() { fecharModalCadastro('modalProduto'); }
    function abrirModalSaborCadastro() { abrirModalCadastro('modalSabor'); setTimeout(function () { var el = document.getElementById('novoSaborNome'); if (el) el.focus(); }, 50); }
    function fecharModalSaborCadastro() { fecharModalCadastro('modalSabor'); }
    function abrirModalExtraCadastro() { abrirModalCadastro('modalExtra'); setTimeout(function () { var el = document.getElementById('novoExtraNome'); if (el) el.focus(); }, 50); }
    function fecharModalExtraCadastro() { fecharModalCadastro('modalExtra'); }
    function linhaPrecoSaborInicial() { return '<tr><td><input type="text" placeholder="Ex.: G" class="sabor-tam-nome"></td><td><input type="number" step="0.01" placeholder="0,00" class="sabor-tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>'; }
    function linhaTamanhoInicial() { return '<tr><td><input type="text" placeholder="Ex.: P" class="tam-nome"></td><td><input type="number" step="0.01" placeholder="0,00" class="tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>'; }
    function linhaTamanhoPersonalizavelInicial() { return '<tr><td><input type="text" placeholder="Ex.: Pequeno" class="tam-perso-nome"></td><td><input type="number" placeholder="1" class="tam-perso-max" value="1"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td></tr>'; }
    function limparFormularioProdutoCadastro() {
        ['novoItemNome','novoItemCategoria','novoItemDescricao','novoItemImagem','novoItemPreco','novoItemEstoque'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
        var disp = document.getElementById('novoItemDisponivel'); if (disp) disp.value = 'sim';
        var arq = document.getElementById('novoItemImagemFile'); if (arq) arq.value = '';
        var prev = document.getElementById('previewItemImagem'); if (prev) prev.innerHTML = '';
        var ilim = document.getElementById('novoItemEstoqueIlimitado'); if (ilim) { ilim.checked = true; toggleEstoqueIlimitado(ilim, 'novoItemEstoque'); }
        var tam = document.getElementById('listaTamanhosAdicionar'); if (tam) tam.innerHTML = linhaTamanhoInicial();
        var tamP = document.getElementById('listaTamanhosPerso'); if (tamP) tamP.innerHTML = linhaTamanhoPersonalizavelInicial();
        var sab = document.getElementById('saboresCheckboxLista'); if (sab) sab.innerHTML = '';
        var ex = document.getElementById('extrasCheckboxLista'); if (ex) ex.innerHTML = '';
        var exP = document.getElementById('extrasCheckboxListaPersonalizavel'); if (exP) exP.innerHTML = '';
        atualizarPreviewProduto();
    }
    function limparFormularioSaborCadastro() {
        ['novoSaborNome','novoSaborImagem','novoSaborDescricao','saborCategorias'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
        var arq = document.getElementById('novoSaborImagemFile'); if (arq) arq.value = '';
        var prev = document.getElementById('previewSaborImagem'); if (prev) prev.innerHTML = '';
        var pr = document.getElementById('listaPrecosSabor'); if (pr) pr.innerHTML = linhaPrecoSaborInicial();
        var t = document.getElementById('tituloModalSabor'); if (t) t.textContent = 'Novo sabor';
        var b = document.getElementById('btnAdicionarSabor'); if (b) { var s = b.querySelector('.btn-text'); if (s) s.textContent = 'Cadastrar sabor'; b.disabled = false; b.classList.remove('loading'); }
    }
    function limparFormularioExtraCadastro() {
        ['novoExtraNome','novoExtraPreco','novoExtraImagem','novoExtraDescricao','novoExtraTamanhos','extraCategorias'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; });
        var max = document.getElementById('novoExtraMax'); if (max) max.value = '1';
        var arq = document.getElementById('novoExtraImagemFile'); if (arq) arq.value = '';
        var prev = document.getElementById('previewExtraImagem'); if (prev) prev.innerHTML = '';
        var t = document.getElementById('tituloModalExtra'); if (t) t.textContent = 'Novo adicional';
        var b = document.getElementById('btnAdicionarExtra'); if (b) { var s = b.querySelector('.btn-text'); if (s) s.textContent = 'Cadastrar adicional'; b.disabled = false; b.classList.remove('loading'); }
    }
    function limparFormularioFreteCadastro() { ['novaLocalidade','novaTaxa'].forEach(function (id) { var el = document.getElementById(id); if (el) el.value = ''; }); var t = document.getElementById('tituloModalFrete'); if (t) t.textContent = 'Nova taxa de entrega'; }
    function limparFormularioCupomCadastro() { var c = document.getElementById('novoCodigo'); if (c) c.value = ''; var tp = document.getElementById('novoTipo'); if (tp) tp.value = 'percentual'; var v = document.getElementById('novoValor'); if (v) v.value = ''; var t = document.getElementById('tituloModalCupom'); if (t) t.textContent = 'Novo cupom'; }
    function limparFormularioMesaCadastro() { var m = document.getElementById('novaMesa'); if (m) m.value = ''; var t = document.getElementById('tituloModalMesa'); if (t) t.textContent = 'Nova mesa'; }

    async function toggleTipoProduto() {
        var tipo = document.getElementById('tipoProduto').value;
        document.getElementById('campoPrecoSimples').style.display = tipo === 'simples' ? 'block' : 'none';
        document.getElementById('campoTamanhos').style.display = tipo === 'tamanhos' ? 'block' : 'none';
        document.getElementById('campoPersonalizavel').style.display = tipo === 'personalizavel' ? 'block' : 'none';
        document.querySelectorAll('.tipo-card').forEach(function (c) { c.classList.toggle('selected', c.dataset.tipo === tipo); });
        var erroSabores = document.getElementById('erroItemSabores'); if (erroSabores) erroSabores.style.display = 'none';
        if (tipo === 'tamanhos') { await carregarExtrasCheckboxes('tamanhos'); }
        else if (tipo === 'personalizavel') {
            var categoria = document.getElementById('novoItemCategoria').value.trim();
            await carregarSaboresCheckboxes(categoria);
            await carregarExtrasCheckboxes('personalizavel', categoria);
            verificarAvisoSemSabores();
        }
    }
    function selecionarTipoProduto(tipo) { document.getElementById('tipoProduto').value = tipo; toggleTipoProduto(); }
    function verificarAvisoSemSabores() { var a = document.getElementById('avisoSemSabores'); if (a) a.style.display = saboresGlobais.length === 0 ? 'flex' : 'none'; }
    function irParaCadastroSabor() { fecharModalProdutoCadastro(); limparFormularioSaborCadastro(); abrirModalSaborCadastro(); }
    function toggleEstoqueIlimitado(checkbox, inputId) {
        var input = document.getElementById(inputId); if (!input) return;
        if (checkbox.checked) { input.value = ''; input.disabled = true; input.placeholder = 'Ilimitado'; }
        else { input.disabled = false; input.placeholder = 'Ex: 20'; input.focus(); }
    }
    function atualizarPreviewProduto() {
        var nomeEl = document.getElementById('novoItemNome'), precoEl = document.getElementById('novoItemPreco'), imagemEl = document.getElementById('novoItemImagem');
        var nomeLbl = document.getElementById('previewProdutoNome'), precoLbl = document.getElementById('previewProdutoPreco');
        if (!nomeEl || !nomeLbl) return;
        nomeLbl.textContent = nomeEl.value.trim() || 'Nome do produto';
        var preco = parseFloat(precoEl ? precoEl.value : NaN);
        precoLbl.textContent = !isNaN(preco) ? 'R$ ' + preco.toFixed(2) : 'R$ 0,00';
        var img = document.getElementById('previewProdutoImg'), ph = document.getElementById('previewProdutoImgPlaceholder');
        var url = imagemEl ? imagemEl.value.trim() : '';
        if (url) { img.src = url; img.style.display = 'block'; ph.style.display = 'none'; img.onerror = function () { img.style.display = 'none'; ph.style.display = 'flex'; }; }
        else { img.style.display = 'none'; ph.style.display = 'flex'; }
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
        if (tr && tr.parentElement.children.length > 1) tr.remove();
        else EU.mostrarToast('É necessário manter pelo menos uma linha.', 'erro');
    }
    function coletarTamanhos(tbodyId) {
        var tbody = document.getElementById(tbodyId); if (!tbody) return [];
        var result = [];
        tbody.querySelectorAll('tr').forEach(function (tr) {
            var inputs = tr.querySelectorAll('input');
            var nome = inputs[0] && inputs[0].value.trim();
            if (!nome || inputs.length !== 2) return;
            if (tbodyId === 'listaTamanhosPerso' || tbodyId === 'editTamanhosPersoContainer') {
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
            if (inputs.length === 2) { var nome = inputs[0].value.trim(), preco = parseFloat(inputs[1].value); if (nome && !isNaN(preco)) precos[nome] = preco; }
        });
        return precos;
    }
    async function atualizarCheckboxesPorCategoria() {
        var categoria = document.getElementById('novoItemCategoria').value.trim();
        var tipo = document.getElementById('tipoProduto').value;
        if (tipo === 'personalizavel') { await carregarSaboresCheckboxes(categoria); await carregarExtrasCheckboxes('personalizavel', categoria); verificarAvisoSemSabores(); }
        else if (tipo === 'tamanhos') { await carregarExtrasCheckboxes('tamanhos', categoria); }
    }
    async function carregarSaboresCheckboxes(categoriaForcada) {
        if (!emailAtual) return;
        var snap = await db.collection('lojistas').doc(emailAtual).collection('sabores').get();
        saboresGlobais = snap.docs.map(function (d) { return { id: d.id, nome: d.data().nome, categorias: d.data().categorias || '', disponivel: d.data().disponivel !== 'nao' }; }).filter(function (s) { return s.disponivel; });
        var container = document.getElementById('saboresCheckboxLista');
        var categoria = categoriaForcada === '__todos__' ? '' : (categoriaForcada || document.getElementById('novoItemCategoria').value.trim());
        var filtered = saboresGlobais;
        if (categoria) filtered = saboresGlobais.filter(function (s) { return !s.categorias || s.categorias === '' || s.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(categoria) !== -1; });
        if (saboresGlobais.length === 0) container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Nenhum sabor disponível cadastrado ainda.</p>';
        else if (filtered.length === 0) container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Nenhum sabor com a categoria "' + EU.sanitize(categoria) + '". <a href="javascript:void(0)" onclick="carregarSaboresCheckboxes(\'__todos__\')" style="color:var(--primary); font-weight:600;">ver todos</a>.</p>';
        else container.innerHTML = filtered.map(function (s) { return '<label for="sabor_' + s.id + '" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:4px 0;"><input type="checkbox" id="sabor_' + s.id + '" value="' + s.id + '" data-nome="' + EU.sanitize(s.nome) + '" onchange="limparErroSabores()"> ' + EU.sanitize(s.nome) + '</label>'; }).join('');
        garantirCheckboxesSaboresInterativos();
    }
    function limparErroSabores() { var e = document.getElementById('erroItemSabores'); if (e) e.style.display = 'none'; }
    function garantirCheckboxesSaboresInterativos() {
        document.querySelectorAll('#saboresCheckboxLista input[type="checkbox"], #editSaboresCheckboxLista input[type="checkbox"]').forEach(function (cb) {
            cb.disabled = false; cb.style.pointerEvents = 'auto'; cb.style.opacity = '1'; cb.style.visibility = 'visible'; cb.style.display = 'inline-block'; cb.style.accentColor = 'var(--primary)';
        });
    }
    async function carregarExtrasCheckboxes(tipo, categoriaForcada) {
        if (!emailAtual) return;
        var snap = await db.collection('lojistas').doc(emailAtual).collection('extras').get();
        extrasGlobais = snap.docs.map(function (d) { return { id: d.id, nome: d.data().nome, categorias: d.data().categorias || '', disponivel: d.data().disponivel !== 'nao' }; }).filter(function (e) { return e.disponivel; });
        var container = tipo === 'personalizavel' ? document.getElementById('extrasCheckboxListaPersonalizavel') : document.getElementById('extrasCheckboxLista');
        var categoria = categoriaForcada === '__todos__' ? '' : (categoriaForcada || document.getElementById('novoItemCategoria').value.trim());
        var filtered = extrasGlobais;
        if (categoria) filtered = extrasGlobais.filter(function (e) { return !e.categorias || e.categorias === '' || e.categorias.split(',').map(function (c) { return c.trim(); }).indexOf(categoria) !== -1; });
        if (extrasGlobais.length === 0) container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Nenhum adicional disponível cadastrado ainda.</p>';
        else if (filtered.length === 0) container.innerHTML = '<p style="text-align:center;color:var(--text-muted);">Nenhum adicional com a categoria "' + EU.sanitize(categoria) + '".</p>';
        else container.innerHTML = filtered.map(function (e) { return '<label for="extra_' + e.id + '" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:4px 0;"><input type="checkbox" id="extra_' + e.id + '" value="' + e.id + '"> ' + EU.sanitize(e.nome) + '</label>'; }).join('');
    }

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
        try { await db.collection('lojistas').doc(emailAtual).collection('sabores').doc(id).update({ disponivel: disp ? 'sim' : 'nao' }); EU.mostrarToast(disp ? 'Sabor disponível!' : 'Sabor indisponível.', 'sucesso'); }
        catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); carregarSabores(); }
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
        modal.innerHTML = '<div class="modal-conteudo"><div class="modal-header"><h3>' + titulo + '</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div><div class="campo"><label>Nome <span class="obrigatorio">*</span></label><input type="text" id="editSaborNome" value="' + EU.sanitize(nomePadrao) + '"></div><div class="campo"><label>Imagem</label><div class="upload-imagem-container"><input type="text" id="editSaborImagem" value="' + EU.sanitize(s.imagem || '') + '" placeholder="URL"><input type="file" id="editSaborImagemFile" accept="image/*" onchange="uploadImagemEditSabor(this)"><button type="button" class="btn-pequeno" onclick="document.getElementById(\'editSaborImagemFile\').click()">Selecionar</button></div><div id="previewEditSaborImagem">' + (s.imagem ? '<img src="' + EU.sanitize(s.imagem) + '" class="preview-imagem">' : '') + '</div></div><div class="campo"><label>Preços por Tamanho <span class="obrigatorio">*</span></label><table class="tabela-tamanhos"><tbody id="editPrecosSabor">' + precosHtml + '</tbody></table><button type="button" class="btn-pequeno" onclick="adicionarLinhaPrecoSaborEdit()">+ Adicionar tamanho</button></div><div class="campo"><label>Descrição</label><textarea id="editSaborDescricao" rows="2">' + EU.sanitize(s.descricao || '') + '</textarea></div><div class="campo"><label>Categorias</label><input type="text" id="editSaborCategorias" value="' + EU.sanitize(s.categorias || '') + '"></div><button class="btn-primary" id="saveSaborEdit"><span class="spinner-btn"></span><span class="btn-text">' + (isDuplicar ? 'Duplicar' : 'Salvar') + '</span></button></div>';
        document.body.appendChild(modal);
        window.uploadImagemEditSabor = async function (input) {
            if (!input.files || !input.files[0]) return;
            EU.showLoading('Enviando imagem...');
            try { var url = await enviarImagemCloudinary(input.files[0]); document.getElementById('editSaborImagem').value = url; document.getElementById('previewEditSaborImagem').innerHTML = '<img src="' + url + '" class="preview-imagem">'; EU.mostrarToast('Imagem enviada!', 'sucesso'); }
            catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
            finally { EU.hideLoading(); }
        };
        window.adicionarLinhaPrecoSaborEdit = function () { var tbody = document.getElementById('editPrecosSabor'); var tr = document.createElement('tr'); tr.innerHTML = '<td><input type="text" placeholder="Ex: G" class="sabor-tam-nome"></td><td><input type="number" step="0.01" placeholder="0.00" class="sabor-tam-preco"></td><td><button type="button" class="btn-pequeno" onclick="removerLinhaTamanho(this)">✕</button></td>'; tbody.appendChild(tr); };
        document.getElementById('saveSaborEdit').onclick = async function () {
            var btn = this; btn.classList.add('loading'); btn.disabled = true;
            try {
                var nome = document.getElementById('editSaborNome').value.trim();
                if (!nome) { EU.mostrarToast('Nome obrigatório.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
                var precos = {};
                document.querySelectorAll('#editPrecosSabor tr').forEach(function (tr) { var inputs = tr.querySelectorAll('input'); if (inputs.length === 2) { var t = inputs[0].value.trim(), p = parseFloat(inputs[1].value); if (t && !isNaN(p)) precos[t] = p; } });
                if (Object.keys(precos).length === 0) { EU.mostrarToast('Adicione pelo menos um tamanho com preço.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
                var saborData = { nome: nome, precos: precos, imagem: document.getElementById('editSaborImagem').value.trim(), descricao: document.getElementById('editSaborDescricao').value.trim(), categorias: document.getElementById('editSaborCategorias').value.trim(), disponivel: isDuplicar ? 'sim' : (s.disponivel || 'sim') };
                if (isDuplicar) { await db.collection('lojistas').doc(emailAtual).collection('sabores').add(saborData); EU.mostrarToast('Sabor duplicado!', 'sucesso'); }
                else { await db.collection('lojistas').doc(emailAtual).collection('sabores').doc(id).update(saborData); EU.mostrarToast('Sabor atualizado!', 'sucesso'); }
                await carregarSabores();
                if (document.getElementById('tipoProduto').value === 'personalizavel') await carregarSaboresCheckboxes(document.getElementById('novoItemCategoria').value.trim());
                modal.remove();
            } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
            finally { btn.classList.remove('loading'); btn.disabled = false; }
        };
    }
    async function excluirSabor(id) { if (confirm('Excluir sabor?')) { await db.collection('lojistas').doc(emailAtual).collection('sabores').doc(id).delete(); carregarSabores(); EU.mostrarToast('Sabor removido!', 'sucesso'); } }
    function duplicarSabor(id) { editarSaborModal(id, true); }

    async function carregarExtras() {
        if (!emailAtual) return;
        var snap = await db.collection('lojistas').doc(emailAtual).collection('extras').get();
        var container = document.getElementById('listaExtras');
        if (snap.empty) { container.innerHTML = '<p style="text-align:center; padding:30px;">Nenhum adicional cadastrado.</p>'; return; }
        container.innerHTML = snap.docs.map(function (doc) {
            var s = doc.data();
            var precosStr = s.precos && typeof s.precos === 'object' ? Object.keys(s.precos).map(function (t) { return t + ': R$ ' + parseFloat(s.precos[t]).toFixed(2); }).join(' | ') : 'Geral: R$ ' + parseFloat(s.preco || s.valor || 0).toFixed(2);
            var disp = s.disponivel !== 'nao';
            return '<div class="item-lista" data-id="' + doc.id + '"><div><strong>' + EU.sanitize(s.nome) + '</strong><br><small>Preços: ' + precosStr + ' | Categorias: ' + EU.sanitize(s.categorias || 'Todas') + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch"><input type="checkbox" ' + (disp ? 'checked' : '') + ' onchange="toggleDisponibilidadeExtra(\'' + doc.id + '\', this.checked)"><span class="slider"></span></label> ' + (disp ? 'Disponível' : 'Indisponível') + '</div></div><div class="acoes"><button class="btn-pequeno" onclick="editarExtraModal(\'' + doc.id + '\')">Editar</button><button class="btn-pequeno" onclick="duplicarExtra(\'' + doc.id + '\')">Duplicar</button><button class="btn-pequeno" style="color:#dc2626;" onclick="excluirExtra(\'' + doc.id + '\')">Excluir</button></div></div>';
        }).join('');
    }
    async function toggleDisponibilidadeExtra(id, disp) {
        try { await db.collection('lojistas').doc(emailAtual).collection('extras').doc(id).update({ disponivel: disp ? 'sim' : 'nao' }); EU.mostrarToast(disp ? 'Adicional disponível!' : 'Adicional indisponível.', 'sucesso'); }
        catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); carregarExtras(); }
    }
    async function editarExtraModal(id, isDuplicar) {
        var doc = await db.collection('lojistas').doc(emailAtual).collection('extras').doc(id).get();
        if (!doc.exists) return;
        var e = doc.data();
        var modal = document.createElement('div'); modal.className = 'modal-overlay active';
        var titulo = isDuplicar ? 'Duplicar adicional' : 'Editar adicional';
        var nomePadrao = isDuplicar ? e.nome + ' (cópia)' : e.nome;
        modal.innerHTML = '<div class="modal-conteudo"><div class="modal-header"><h3>' + titulo + '</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div><div class="campo"><label>Nome <span class="obrigatorio">*</span></label><input type="text" id="editExtraNome" value="' + EU.sanitize(nomePadrao) + '"></div><div class="campo"><label>Preço (R$) <span class="obrigatorio">*</span></label><input type="number" step="0.01" id="editExtraPreco" value="' + (e.preco || 0) + '"></div><div class="campo"><label>Imagem</label><div class="upload-imagem-container"><input type="text" id="editExtraImagem" value="' + EU.sanitize(e.imagem || '') + '" placeholder="URL"><input type="file" id="editExtraImagemFile" accept="image/*" onchange="uploadImagemEditExtra(this)"><button type="button" class="btn-pequeno" onclick="document.getElementById(\'editExtraImagemFile\').click()">Selecionar</button></div><div id="previewEditExtraImagem">' + (e.imagem ? '<img src="' + EU.sanitize(e.imagem) + '" class="preview-imagem">' : '') + '</div></div><div class="campo"><label>Descrição</label><textarea id="editExtraDescricao" rows="2">' + EU.sanitize(e.descricao || '') + '</textarea></div><div class="campo"><label>Máximo por pedido</label><input type="number" id="editExtraMax" value="' + (e.max || 0) + '"></div><div class="campo"><label>Tamanhos permitidos</label><input type="text" id="editExtraTamanhos" value="' + EU.sanitize((e.tamanhosPermitidos || []).join(',')) + '"></div><div class="campo"><label>Categorias</label><input type="text" id="editExtraCategorias" value="' + EU.sanitize(e.categorias || '') + '"></div><button class="btn-primary" id="saveExtraEdit"><span class="spinner-btn"></span><span class="btn-text">' + (isDuplicar ? 'Duplicar' : 'Salvar') + '</span></button></div>';
        document.body.appendChild(modal);
        window.uploadImagemEditExtra = async function (input) {
            if (!input.files || !input.files[0]) return;
            EU.showLoading('Enviando imagem...');
            try { var url = await enviarImagemCloudinary(input.files[0]); document.getElementById('editExtraImagem').value = url; document.getElementById('previewEditExtraImagem').innerHTML = '<img src="' + url + '" class="preview-imagem">'; EU.mostrarToast('Imagem enviada!', 'sucesso'); }
            catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
            finally { EU.hideLoading(); }
        };
        document.getElementById('saveExtraEdit').onclick = async function () {
            var btn = this; btn.classList.add('loading'); btn.disabled = true;
            try {
                var nome = document.getElementById('editExtraNome').value.trim();
                if (!nome) { EU.mostrarToast('Nome obrigatório.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
                var preco = parseFloat(document.getElementById('editExtraPreco').value);
                if (isNaN(preco) || preco < 0) { EU.mostrarToast('Preço inválido.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
                var tStr = document.getElementById('editExtraTamanhos').value.trim();
                var tPerm = tStr ? tStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
                var extraData = { nome: nome, preco: preco, imagem: document.getElementById('editExtraImagem').value.trim(), descricao: document.getElementById('editExtraDescricao').value.trim(), max: parseInt(document.getElementById('editExtraMax').value) || 0, tamanhosPermitidos: tPerm.length ? tPerm : null, categorias: document.getElementById('editExtraCategorias').value.trim(), disponivel: isDuplicar ? 'sim' : (e.disponivel || 'sim') };
                if (isDuplicar) { await db.collection('lojistas').doc(emailAtual).collection('extras').add(extraData); EU.mostrarToast('Adicional duplicado!', 'sucesso'); }
                else { await db.collection('lojistas').doc(emailAtual).collection('extras').doc(id).update(extraData); EU.mostrarToast('Adicional atualizado!', 'sucesso'); }
                await carregarExtras();
                modal.remove();
            } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
            finally { btn.classList.remove('loading'); btn.disabled = false; }
        };
    }
    async function excluirExtra(id) { if (confirm('Excluir adicional?')) { await db.collection('lojistas').doc(emailAtual).collection('extras').doc(id).delete(); carregarExtras(); EU.mostrarToast('Adicional removido!', 'sucesso'); } }
    function duplicarExtra(id) { editarExtraModal(id, true); }

    async function carregarFretes() {
        if (!emailAtual) return;
        var snap = await db.collection('lojistas').doc(emailAtual).collection('fretes').get();
        var container = document.getElementById('listaFretes');
        container.innerHTML = snap.docs.map(function (doc) {
            var f = doc.data();
            var ativo = f.ativo !== 'nao';
            return '<div class="item-lista"><div><strong>' + EU.sanitize(f.localidade) + '</strong><br><small>Taxa: R$ ' + parseFloat(f.taxa).toFixed(2) + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch"><input type="checkbox" ' + (ativo ? 'checked' : '') + ' onchange="toggleAtivoFrete(\'' + doc.id + '\', this.checked)"><span class="slider"></span></label> ' + (ativo ? 'Ativa' : 'Inativa') + '</div></div><div><button class="btn-pequeno" onclick="editarFreteModal(\'' + doc.id + '\')">Editar</button> <button class="btn-pequeno" onclick="duplicarFrete(\'' + doc.id + '\')">Duplicar</button> <button class="btn-pequeno" style="color:#dc2626" onclick="excluirFrete(\'' + doc.id + '\')">Excluir</button></div></div>';
        }).join('') || '<p style="text-align:center;">Nenhuma taxa configurada.</p>';
    }
    async function toggleAtivoFrete(id, ativo) {
        try { await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).update({ ativo: ativo ? 'sim' : 'nao' }); EU.mostrarToast(ativo ? 'Taxa ativa!' : 'Taxa inativa.', 'sucesso'); }
        catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); carregarFretes(); }
    }
    async function editarFreteModal(id, isDuplicar) {
        var snap = await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).get();
        if (!snap.exists) return;
        var f = snap.data();
        var loc = f.localidade || '';
        var taxa = f.taxa || 0;
        var modal = document.createElement('div'); modal.className = 'modal-overlay campanha-modal active';
        var titulo = isDuplicar ? 'Duplicar taxa de entrega' : 'Editar taxa de entrega';
        var locPadrao = isDuplicar ? loc + ' (cópia)' : loc;
        modal.innerHTML = '<div class="modal-conteudo campanha-modal-conteudo"><div class="modal-header"><div><span class="modal-eyebrow">Taxas de entrega</span><h3>' + titulo + '</h3></div><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()" aria-label="Fechar">&times;</button></div><div class="campanha-form"><div class="campanha-secao-titulo">1. DADOS DA ENTREGA</div><div class="campo"><label>Localidade</label><input type="text" id="editLoc" value="' + EU.sanitize(locPadrao) + '"></div><div class="campo"><label>Taxa (R$)</label><input type="number" step="0.01" min="0" id="editTaxa" value="' + taxa + '"></div><div class="campanha-modal-acoes"><button class="btn-secundario" onclick="this.closest(\'.modal-overlay\').remove()">Cancelar</button><button class="btn-primary" id="salvarFrete">' + (isDuplicar ? 'Duplicar taxa' : 'Salvar taxa') + '</button></div></div></div>';
        document.body.appendChild(modal);
        document.getElementById('salvarFrete').onclick = async function () {
            var localidade = document.getElementById('editLoc').value.trim();
            var valor = parseFloat(document.getElementById('editTaxa').value);
            if (!localidade || !Number.isFinite(valor) || valor < 0) { EU.mostrarToast('Informe uma localidade e uma taxa válida.', 'erro'); return; }
            try {
                var ref = db.collection('lojistas').doc(emailAtual).collection('fretes');
                if (isDuplicar) { await ref.add({ localidade: localidade, taxa: valor, ativo: 'sim' }); EU.mostrarToast('Taxa duplicada!', 'sucesso'); }
                else { await ref.doc(id).update({ localidade: localidade, taxa: valor }); EU.mostrarToast('Taxa atualizada!', 'sucesso'); }
                await carregarFretes(); modal.remove();
            } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
        };
    }
    function duplicarFrete(id) { editarFreteModal(id, true); }
    async function excluirFrete(id) { if (confirm('Remover?')) { await db.collection('lojistas').doc(emailAtual).collection('fretes').doc(id).delete(); carregarFretes(); } }

    async function carregarCupons() {
        if (!emailAtual) return;
        var snap = await db.collection('lojistas').doc(emailAtual).collection('cupons').get();
        var container = document.getElementById('listaCupons');
        container.innerHTML = snap.docs.map(function (doc) {
            var c = doc.data();
            var ativo = c.ativo === 'sim';
            return '<div class="item-lista"><div><strong>' + EU.sanitize(c.codigo) + '</strong><br><small>' + (c.tipo === 'percentual' ? c.valor + '%' : 'R$ ' + parseFloat(c.valor).toFixed(2)) + '</small><div class="item-lista-disponibilidade"><label class="toggle-switch"><input type="checkbox" ' + (ativo ? 'checked' : '') + ' onchange="toggleAtivoCupom(\'' + doc.id + '\', this.checked)"><span class="slider"></span></label> ' + (ativo ? 'Ativo' : 'Inativo') + '</div></div><div><button class="btn-pequeno" onclick="editarCupomModal(\'' + doc.id + '\')">Editar</button> <button class="btn-pequeno" onclick="duplicarCupom(\'' + doc.id + '\')">Duplicar</button> <button class="btn-pequeno" style="color:#dc2626" onclick="excluirCupom(\'' + doc.id + '\')">Excluir</button></div></div>';
        }).join('') || '<p style="text-align:center;">Nenhum cupom criado.</p>';
    }
    async function toggleAtivoCupom(id, ativo) {
        try { await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).update({ ativo: ativo ? 'sim' : 'nao' }); EU.mostrarToast(ativo ? 'Cupom ativo!' : 'Cupom inativo.', 'sucesso'); carregarCupons(); }
        catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); carregarCupons(); }
    }
    async function editarCupomModal(id, isDuplicar) {
        var snap = await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).get();
        if (!snap.exists) return;
        var c = snap.data();
        var modal = document.createElement('div'); modal.className = 'modal-overlay campanha-modal active';
        var titulo = isDuplicar ? 'Duplicar cupom' : 'Editar cupom';
        var codigoPadrao = isDuplicar ? (c.codigo || 'NOVO') + ' (CÓPIA)' : (c.codigo || '');
        modal.innerHTML = '<div class="modal-conteudo campanha-modal-conteudo"><div class="modal-header"><div><span class="modal-eyebrow">Cupons</span><h3>' + titulo + '</h3></div><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()" aria-label="Fechar">&times;</button></div><div class="campanha-form"><div class="campanha-secao-titulo">1. CONFIGURAÇÃO DO CUPOM</div><div class="campo"><label>Código</label><input type="text" id="eCod" value="' + EU.sanitize(codigoPadrao) + '"></div><div class="campo"><label>Valor</label><input type="number" step="0.01" min="0" id="eVal" value="' + (c.valor || 0) + '"></div><div class="campo"><label>Ativo</label><select id="eAt"><option value="sim"' + (c.ativo === 'sim' || isDuplicar ? ' selected' : '') + '>Sim</option><option value="nao"' + (c.ativo === 'nao' && !isDuplicar ? ' selected' : '') + '>Não</option></select></div><div class="campanha-modal-acoes"><button class="btn-secundario" onclick="this.closest(\'.modal-overlay\').remove()">Cancelar</button><button class="btn-primary" id="sCup">' + (isDuplicar ? 'Duplicar cupom' : 'Salvar cupom') + '</button></div></div></div>';
        document.body.appendChild(modal);
        document.getElementById('sCup').onclick = async function () {
            var codigo = document.getElementById('eCod').value.trim().toUpperCase();
            var novoValor = parseFloat(document.getElementById('eVal').value);
            var novoAtivo = document.getElementById('eAt').value;
            if (!codigo || !Number.isFinite(novoValor) || novoValor < 0) { EU.mostrarToast('Informe um código e um valor válido.', 'erro'); return; }
            try {
                var ref = db.collection('lojistas').doc(emailAtual).collection('cupons');
                if (isDuplicar) { await ref.add({ codigo: codigo, tipo: c.tipo || 'percentual', valor: novoValor, ativo: novoAtivo, usosTotal: 0, usosPorCliente: {} }); EU.mostrarToast('Cupom duplicado!', 'sucesso'); }
                else { await ref.doc(id).update({ codigo: codigo, valor: novoValor, ativo: novoAtivo }); EU.mostrarToast('Cupom atualizado!', 'sucesso'); }
                await carregarCupons(); modal.remove();
            } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
        };
    }
    function duplicarCupom(id) { editarCupomModal(id, true); }
    async function excluirCupom(id) { if (confirm('Excluir?')) { await db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).delete(); carregarCupons(); } }

    async function carregarMesas() {
        if (!emailAtual) return;
        var snapMesas = await db.collection('lojistas').doc(emailAtual).collection('mesas').get();
        var statusPorMesa = {};
        try {
            var pSnap = await db.collection('pedidos').where('estabelecimentoId', '==', estId).where('status', 'in', ['pendente','confirmado','em_preparo','saiu_entrega']).get();
            pSnap.forEach(function (d) {
                var dados = d.data();
                var n = dados.numeroMesa;
                if (n === null || n === undefined || n === '') return;
                var chave = String(n);
                if (!statusPorMesa[chave]) statusPorMesa[chave] = { temP: false, temA: false };
                if (dados.status === 'pendente' || dados.status === 'confirmado') statusPorMesa[chave].temP = true;
                if (dados.status === 'em_preparo' || dados.status === 'saiu_entrega') statusPorMesa[chave].temA = true;
            });
        } catch (e) { console.warn('Status das mesas indisponível:', e.message); }
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
            if (!snap.empty) { EU.mostrarToast('Essa mesa tem pedido em andamento. Finalize ou cancele antes de excluir.', 'erro'); return; }
        } catch (e) { /* segue com o confirm */ }
        if (confirm('Excluir mesa?')) { await db.collection('lojistas').doc(emailAtual).collection('mesas').doc(id).delete(); carregarMesas(); }
    }
    async function verPedidosMesa(n) {
        var snap = await db.collection('pedidos').where('estabelecimentoId', '==', estId).where('numeroMesa', '==', n).orderBy('criadoEm', 'desc').get();
        if (snap.empty) return EU.mostrarToast('Nenhum pedido.', 'erro');
        var lista = snap.docs.map(function (d) { return '<div>#' + (d.data().codigoCurto || d.id.slice(0, 6)) + ' - R$ ' + (d.data().total || 0).toFixed(2) + ' - ' + d.data().status + '</div>'; }).join('');
        abrirModal('Pedidos da Mesa ' + n, lista);
    }
    function duplicarMesa(numero) {
        var n = Number.parseInt(numero, 10);
        var campo = document.getElementById('novaMesa');
        if (!Number.isInteger(n) || !campo) return;
        campo.value = n + 1;
        var titulo = document.getElementById('tituloModalMesa'); if (titulo) titulo.textContent = 'Duplicar mesa';
        abrirModalCadastro('modalMesa');
        setTimeout(function () { campo.focus(); }, 50);
    }
    function gerarQRCodeMesa(n) {
        var url = 'https://www.economizeirioclaro.com.br/p/onde-comer_13.html?qr=' + estId + '&mesa=' + n;
        var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(url);
        var win = window.open();
        win.document.write('<html><body style="text-align:center;"><h2>Mesa ' + n + '</h2><img src="' + qrUrl + '"><p>' + url + '</p><button onclick="window.print()">Imprimir</button></body></html>');
    }

    function abrirModal(titulo, conteudo) {
        var modal = document.createElement('div');
        modal.className = 'modal-overlay active';
        modal.innerHTML = '<div class="modal-conteudo"><div class="modal-header"><h3>' + titulo + '</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div><div class="modal-body">' + conteudo + '</div></div>';
        document.body.appendChild(modal);
    }
    function mostrarPedidosPeriodo() { if (!pedidosAtuais.length) return EU.mostrarToast('Nenhum pedido.', 'erro'); var lista = pedidosAtuais.map(function (p) { return '<div onclick="verDetalhesPedido(\'' + p.id + '\')">#' + (p.codigoCurto || p.id.slice(0, 6)) + ' - R$ ' + (p.total || 0).toFixed(2) + ' - ' + p.clienteNome + '</div>'; }).join(''); abrirModal('Lista de Pedidos', lista); }
    function mostrarRankingVendas() { if (!rankingVendas.length) return EU.mostrarToast('Nenhuma venda.', 'erro'); var lista = rankingVendas.map(function (r, i) { return '<div>' + (i + 1) + 'º ' + r[0] + ' - ' + r[1] + ' vendidos</div>'; }).join(''); abrirModal('Itens Mais Vendidos', lista); }
    function mostrarPedidoMaisCaro() { if (!pedidosAtuais.length) return; var maisCaro = pedidosAtuais.slice().sort(function (a, b) { return (b.total || 0) - (a.total || 0); })[0]; abrirModal('Maior Venda', '<div><h3>#' + (maisCaro.codigoCurto || maisCaro.id.slice(0, 6)) + '</h3><p>R$ ' + (maisCaro.total || 0).toFixed(2) + '</p><p>Cliente: ' + maisCaro.clienteNome + '</p><button class="btn-primary" onclick="verDetalhesPedido(\'' + maisCaro.id + '\')">Ver Pedido</button></div>'); }
    function verDetalhesPedido(id) { var el = document.querySelector('.pedido-card[data-id="' + id + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); document.querySelectorAll('.modal-overlay').forEach(function (m) { m.remove(); }); }

    document.querySelectorAll('.tab-principal').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var t = this.dataset.tab;
            document.querySelectorAll('.tab-principal').forEach(function (b) { b.classList.remove('active'); b.setAttribute('aria-selected', 'false'); });
            this.classList.add('active'); this.setAttribute('aria-selected', 'true');
            document.querySelectorAll('.tab-painel').forEach(function (p) { p.classList.remove('active'); });
            document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1)).classList.add('active');
            if (t === 'itens') { carregarCardapio(); carregarSabores(); carregarExtras(); carregarSaboresCheckboxes(); carregarExtrasCheckboxes(''); }
            if (t === 'entrega') carregarFretes();
            if (t === 'cupons') carregarCupons();
            if (t === 'mesas') carregarMesas();
        });
    });
    function toggleCollapse(headerElement, contentId) {
        var content = document.getElementById(contentId);
        var btn = headerElement.querySelector('.collapse-btn');
        if (!content || !btn) return;
        if (content.classList.contains('open')) { content.classList.remove('open'); btn.innerHTML = '+'; btn.setAttribute('aria-label', 'Expandir'); headerElement.setAttribute('aria-expanded', 'false'); }
        else { content.classList.add('open'); btn.innerHTML = '\u2212'; btn.setAttribute('aria-label', 'Recolher'); headerElement.setAttribute('aria-expanded', 'true'); }
    }

    // ===== Bootstrap de cadastros =====
    (function configurarModaisCadastroPedidos() {
        var b1 = document.getElementById('btnNovoProduto'); if (b1) b1.addEventListener('click', async function () { limparFormularioProdutoCadastro(); await toggleTipoProduto(); abrirModalCadastro('modalProduto'); setTimeout(function () { var el = document.getElementById('novoItemNome'); if (el) el.focus(); }, 50); });
        var b2 = document.getElementById('btnNovoSabor'); if (b2) b2.addEventListener('click', function () { limparFormularioSaborCadastro(); abrirModalSaborCadastro(); });
        var b3 = document.getElementById('btnNovoExtra'); if (b3) b3.addEventListener('click', function () { limparFormularioExtraCadastro(); abrirModalExtraCadastro(); });
        var b4 = document.getElementById('btnNovoFrete'); if (b4) b4.addEventListener('click', function () { limparFormularioFreteCadastro(); abrirModalCadastro('modalFrete'); setTimeout(function () { var el = document.getElementById('novaLocalidade'); if (el) el.focus(); }, 50); });
        var b5 = document.getElementById('btnNovoCupom'); if (b5) b5.addEventListener('click', function () { limparFormularioCupomCadastro(); abrirModalCadastro('modalCupom'); setTimeout(function () { var el = document.getElementById('novoCodigo'); if (el) el.focus(); }, 50); });
        var b6 = document.getElementById('btnNovaMesa'); if (b6) b6.addEventListener('click', function () { limparFormularioMesaCadastro(); abrirModalCadastro('modalMesa'); setTimeout(function () { var el = document.getElementById('novaMesa'); if (el) el.focus(); }, 50); });
        ['btnFecharProdutoModal','btnCancelarProdutoModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalProdutoCadastro(); limparFormularioProdutoCadastro(); }); });
        ['btnFecharSaborModal','btnCancelarSaborModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalSaborCadastro(); limparFormularioSaborCadastro(); }); });
        ['btnFecharExtraModal','btnCancelarExtraModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalExtraCadastro(); limparFormularioExtraCadastro(); }); });
        ['btnFecharFreteModal','btnCancelarFreteModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalCadastro('modalFrete'); limparFormularioFreteCadastro(); }); });
        ['btnFecharCupomModal','btnCancelarCupomModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalCadastro('modalCupom'); limparFormularioCupomCadastro(); }); });
        ['btnFecharMesaModal','btnCancelarMesaModal'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function () { fecharModalCadastro('modalMesa'); limparFormularioMesaCadastro(); }); });
        ['modalProduto','modalSabor','modalExtra','modalFrete','modalCupom','modalMesa'].forEach(function (id) { var el = document.getElementById(id); if (el) el.addEventListener('click', function (e) { if (e.target.id === id) fecharModalCadastro(id); }); });
        document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; ['modalProduto','modalSabor','modalExtra','modalFrete','modalCupom','modalMesa'].forEach(function (id) { var el = document.getElementById(id); if (el && el.classList.contains('active')) fecharModalCadastro(id); }); });
    })();

    document.getElementById('btnAdicionarItem').onclick = async function () {
        var btn = this; btn.classList.add('loading'); btn.disabled = true;
        try {
            var nome = document.getElementById('novoItemNome').value.trim();
            if (!nome) { EU.mostrarToast('Preencha o nome.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
            var categoria = document.getElementById('novoItemCategoria').value.trim();
            var descricao = document.getElementById('novoItemDescricao').value.trim();
            var imagem = document.getElementById('novoItemImagem').value.trim();
            var disponivel = document.getElementById('novoItemDisponivel').value;
            var estoqueIlimitado = document.getElementById('novoItemEstoqueIlimitado').checked;
            var estoqueInput = document.getElementById('novoItemEstoque').value.trim();
            var estoque = estoqueIlimitado ? '' : Number.parseInt(estoqueInput, 10);
            if (!estoqueIlimitado && (!Number.isInteger(estoque) || estoque < 0)) { EU.mostrarToast('Informe um estoque inteiro válido, ou marque ilimitado.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
            var tipoProduto = document.getElementById('tipoProduto').value;
            var itemData = { nome: nome, categoria: categoria, descricao: descricao, imagem: imagem, disponivel: disponivel, estoque: estoqueIlimitado ? '' : estoque, estoqueIlimitado: estoqueIlimitado, tipo: tipoProduto };
            if (tipoProduto === 'simples') {
                var preco = Number.parseFloat(document.getElementById('novoItemPreco').value);
                if (!Number.isFinite(preco) || preco < 0) { EU.mostrarToast('Preço inválido.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
                itemData.preco = preco;
            } else if (tipoProduto === 'tamanhos') {
                var tams = coletarTamanhos('listaTamanhosAdicionar');
                if (tams.length === 0) { EU.mostrarToast('Adicione pelo menos um tamanho.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
                itemData.tamanhos = tams;
                itemData.extrasPermitidos = Array.from(document.querySelectorAll('#extrasCheckboxLista input:checked')).map(function (cb) { return cb.value; });
            } else if (tipoProduto === 'personalizavel') {
                itemData.tamanhosDisponiveis = coletarTamanhos('listaTamanhosPerso');
                itemData.tamanhoObrigatorio = false;
                itemData.saboresPermitidos = Array.from(document.querySelectorAll('#saboresCheckboxLista input:checked')).map(function (cb) { return cb.value; });
                itemData.saboresObrigatorios = false;
                itemData.extrasPermitidos = Array.from(document.querySelectorAll('#extrasCheckboxListaPersonalizavel input:checked')).map(function (cb) { return cb.value; });
            }
            await db.collection('lojistas').doc(emailAtual).collection('cardapio').add(itemData);
            cardapioCacheCarregado = false;
            await carregarCardapio();
            fecharModalProdutoCadastro(); limparFormularioProdutoCadastro(); selecionarTipoProduto('simples');
            EU.mostrarToast('Produto adicionado!', 'sucesso');
        } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
        finally { btn.classList.remove('loading'); btn.disabled = false; }
    };

    document.getElementById('btnAdicionarSabor').onclick = async function () {
        var btn = this; btn.classList.add('loading'); btn.disabled = true;
        try {
            var nome = document.getElementById('novoSaborNome').value.trim();
            if (!nome) { EU.mostrarToast('Nome obrigatório.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
            var precos = coletarPrecosSabor();
            if (Object.keys(precos).length === 0) { EU.mostrarToast('Adicione pelo menos um tamanho com preço.', 'erro'); btn.classList.remove('loading'); btn.disabled = false; return; }
            await db.collection('lojistas').doc(emailAtual).collection('sabores').add({ nome: nome, precos: precos, imagem: document.getElementById('novoSaborImagem').value.trim(), descricao: document.getElementById('novoSaborDescricao').value.trim(), categorias: document.getElementById('saborCategorias').value.trim(), disponivel: 'sim' });
            await carregarSabores();
            if (document.getElementById('tipoProduto').value === 'personalizavel') { await carregarSaboresCheckboxes(document.getElementById('novoItemCategoria').value.trim()); verificarAvisoSemSabores(); }
            fecharModalSaborCadastro(); limparFormularioSaborCadastro();
            EU.mostrarToast('Sabor salvo!', 'sucesso');
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
            var max = parseInt(document.getElementById('novoExtraMax').value) || 0;
            var tStr = document.getElementById('novoExtraTamanhos').value.trim();
            var tPerm = tStr ? tStr.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : [];
            await db.collection('lojistas').doc(emailAtual).collection('extras').add({ nome: nome, preco: preco, descricao: document.getElementById('novoExtraDescricao').value.trim(), max: max === 0 ? null : max, tamanhosPermitidos: tPerm.length ? tPerm : null, categorias: document.getElementById('extraCategorias').value.trim(), imagem: document.getElementById('novoExtraImagem').value.trim(), disponivel: 'sim' });
            await carregarExtras();
            fecharModalExtraCadastro(); limparFormularioExtraCadastro();
            EU.mostrarToast('Adicional salvo!', 'sucesso');
        } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
        finally { btn.classList.remove('loading'); btn.disabled = false; }
    };

    document.getElementById('btnAdicionarFrete').onclick = async function () {
        var l = document.getElementById('novaLocalidade').value.trim();
        var t = parseFloat(document.getElementById('novaTaxa').value);
        if (!l || isNaN(t)) { EU.mostrarToast('Preencha todos os campos.', 'erro'); return; }
        EU.showLoading('Salvando...');
        try {
            await db.collection('lojistas').doc(emailAtual).collection('fretes').add({ localidade: l, taxa: t, ativo: 'sim' });
            fecharModalCadastro('modalFrete'); limparFormularioFreteCadastro(); carregarFretes();
            EU.mostrarToast('Taxa salva!', 'sucesso');
        } catch (e) { EU.mostrarToast(e.message, 'erro'); }
        finally { EU.hideLoading(); }
    };

    document.getElementById('btnAdicionarCupom').onclick = async function () {
        var cod = document.getElementById('novoCodigo').value.toUpperCase();
        var t = document.getElementById('novoTipo').value;
        var v = parseFloat(document.getElementById('novoValor').value);
        if (!cod || isNaN(v)) { EU.mostrarToast('Dados inválidos.', 'erro'); return; }
        EU.showLoading('Criando...');
        try {
            await db.collection('lojistas').doc(emailAtual).collection('cupons').add({ codigo: cod, tipo: t, valor: v, ativo: 'sim', usosTotal: 0, usosPorCliente: {} });
            fecharModalCadastro('modalCupom'); limparFormularioCupomCadastro(); carregarCupons();
            EU.mostrarToast('Cupom criado!', 'sucesso');
        } catch (e) { EU.mostrarToast(e.message, 'erro'); }
        finally { EU.hideLoading(); }
    };

    document.getElementById('btnAdicionarMesa').onclick = async function () {
        var n = Number.parseInt(document.getElementById('novaMesa').value, 10);
        if (!Number.isInteger(n) || n < 1) { EU.mostrarToast('Número inválido.', 'erro'); return; }
        var ref = db.collection('lojistas').doc(emailAtual).collection('mesas').doc('mesa_' + n);
        try {
            if ((await ref.get()).exists) { EU.mostrarToast('Essa mesa já está cadastrada.', 'erro'); return; }
            await ref.set({ numero: n, status: 'livre' });
            fecharModalCadastro('modalMesa'); limparFormularioMesaCadastro(); await carregarMesas();
            EU.mostrarToast('Mesa adicionada!', 'sucesso');
        } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
    };

    inicializarAutoAddLinha('listaTamanhosAdicionar', function () { adicionarLinhaTamanho('listaTamanhosAdicionar'); });
    inicializarAutoAddLinha('listaTamanhosPerso', function () { adicionarLinhaTamanho('listaTamanhosPerso'); });
    inicializarAutoAddLinha('listaPrecosSabor', function () { adicionarLinhaPrecoSabor(); });
    atualizarPreviewProduto();

    // ===== Exposição global =====
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
    window.notificarNovoPedido = notificarNovoPedido;
    window.abrirModalEditarProduto = abrirModalEditarProduto;
    window.uploadImagemProduto = uploadImagemProduto;
    window.uploadImagemSabor = uploadImagemSabor;
    window.uploadImagemExtra = uploadImagemExtra;
    window.carregarSaboresCheckboxes = carregarSaboresCheckboxes;
    window.carregarExtrasCheckboxes = carregarExtrasCheckboxes;
    window.limparErroSabores = limparErroSabores;
    window.toggleEstoqueIlimitado = toggleEstoqueIlimitado;
    window.irParaCadastroSabor = irParaCadastroSabor;
    window.verificarAvisoSemSabores = verificarAvisoSemSabores;
    window.atualizarPreviewProduto = atualizarPreviewProduto;
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
    window.duplicarProduto = duplicarProduto;
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
    window.excluirMesa = excluirMesa;
    window.verPedidosMesa = verPedidosMesa;
    window.duplicarMesa = duplicarMesa;
    window.verDetalhesPedido = verDetalhesPedido;
    window.toggleCollapse = toggleCollapse;

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
                carregarFretes(),
                carregarCupons(),
                carregarMesas(),
                carregarSabores(),
                carregarExtras()
            ]).then(function () { toggleTipoProduto(); });
        }
    });

})();