/*
 * economizei-loja.js
 * Módulo frontend público da Loja.
 * Carregar depois de economizei-core.js e antes da interação da página.
 * Não embute core, shell Blogger ou módulo Pedidos.
 */
(function() {
    'use strict';
    if (!window.Economizei) window.Economizei = {};
// MÓDULO LOJA – COMPLETO (CORRIGIDO)
// ============================================================

window.abrirModalLoja = function(idx) {
    var Core = Economizei.Core;
    var UI = Economizei.UI;
    var Cards = Economizei.Cards;
    var COLUNAS = Economizei.Horario.COLUNAS;

    var est = Cards.dadosProcessados[idx];
    if (!est) {
        UI.mostrarToast('Estabelecimento não encontrado.');
        return;
    }
    var nomeEstab = est[COLUNAS.NOME];
    var logoEstab = est[COLUNAS.IMAGEM] || '';
    var estId = est[COLUNAS.ID_UNICO];
    var carrinho = [];
    var cupomDesconto = 0;
    var currentLojistaId = null;
    var produtosCache = [];
    var fretesCache = [];
    var statusLojaAtual = 'aberta';
    var unsubscribeCardapio = null;
    var unsubscribeFretes = null;
    var unsubscribeStatusLoja = null;

    // ===== FUNÇÃO AUXILIAR: normalizar imagens =====
    function normalizarImagens(imagens) {
        var lista = [];
        if (Array.isArray(imagens)) lista = imagens;
        else if (typeof imagens === 'string') lista = imagens.split(',');
        return lista.map(function(s) { return String(s || '').trim(); }).filter(function(s, index, arr) {
            return s !== '' && arr.indexOf(s) === index;
        });
    }

    function obterImagensBaseProduto(produto) {
        var imagens = [];
        if (produto && produto.imagem) imagens.push(String(produto.imagem).trim());
        imagens = imagens.concat(normalizarImagens(produto && produto.imagens));
        return normalizarImagens(imagens);
    }

    function obterImagensVariacao(variacao) {
        if (!variacao) return [];
        var imagens = [];
        if (variacao.imagem) imagens.push(String(variacao.imagem).trim());
        imagens = imagens.concat(normalizarImagens(variacao.imagens || variacao.imagensAdicionais || variacao.fotos));
        return normalizarImagens(imagens);
    }

    function obterImagensProduto(produto) {
        var imagens = obterImagensBaseProduto(produto);
        var variacoes = produto && Array.isArray(produto.variacoes) ? produto.variacoes : [];
        variacoes.forEach(function(variacao) {
            imagens = imagens.concat(obterImagensVariacao(variacao));
        });
        return normalizarImagens(imagens);
    }

    function obterImagemPrincipalProduto(produto) {
        var imagensBase = obterImagensBaseProduto(produto);
        if (imagensBase.length > 0) return imagensBase[0];
        var imagensTodas = obterImagensProduto(produto);
        return imagensTodas.length > 0 ? imagensTodas[0] : null;
    }

    // ===== FUNÇÕES AUXILIARES =====

    function gerarComprovanteLoja(pedido, codigoCurto) {
        var itensHTML = pedido.itens ? '<ul>' + pedido.itens.map(function(i) {
            var nomeItem = i.nome + (i.atributos ? ' (' + Object.values(i.atributos).join(', ') + ')' : '');
            return '<li>' + i.quantidade + 'x ' + nomeItem + ' - R$ ' + (i.precoUnitario * i.quantidade).toFixed(2) + '</li>';
        }).join('') + '</ul>' : '';
        var dados = '<h2>Comprovante de Pedido</h2>' +
            '<p style="text-align:center;"><strong>Pedido #' + codigoCurto + '</strong><br>Data: ' + new Date().toLocaleString() + '</p>' +
            '<div class="info"><p><strong>Estabelecimento:</strong> ' + (pedido.estabelecimentoNome || '') + '</p>' +
            '<p><strong>Cliente:</strong> ' + (pedido.clienteNome || '') + '</p>' +
            '<p><strong>Endereço:</strong> ' + (pedido.endereco || '') + '</p>' +
            '<p><strong>Telefone:</strong> ' + (pedido.clienteTelefone || '') + '</p></div>' +
            '<div class="itens"><h3>Itens</h3>' + itensHTML + '</div>' +
            '<div class="total">Subtotal: R$ ' + (pedido.subtotal || 0).toFixed(2) + '<br>' +
            'Frete: R$ ' + (pedido.taxaEntrega || 0).toFixed(2) + '<br>' +
            'Total: R$ ' + (pedido.total || 0).toFixed(2) + '</div>' +
            '<p><strong>Pagamento:</strong> ' + (pedido.formaPagamento || '') + (pedido.trocoPara ? ' (Troco para R$ ' + parseFloat(pedido.trocoPara).toFixed(2) + ')' : '') + '</p>' +
            '<p><strong>Observação:</strong> ' + (pedido.observacao || 'Nenhuma') + '</p>';
        var conteudo = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Comprovante de Pedido</title><style>' +
            'body{font-family:Arial,sans-serif;margin:0;padding:1rem;background:#f2f4f7;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;box-sizing:border-box;}' +
            '.comprovante{width:100%;max-width:600px;background:white;border-radius:1rem;padding:1.5rem;box-shadow:0 2px 10px rgba(0,0,0,0.1);margin:0 auto;}' +
            'h2{color:#0a66c2;text-align:center;font-size:1.3rem;}.info{background:#f8fafc;padding:1rem;border-radius:0.5rem;margin:1rem 0;font-size:0.9rem;}.info p{margin:0.3rem 0;}' +
            '.itens{border-top:1px solid #ddd;margin:1rem 0;padding:0.5rem 0;}.itens ul{list-style:none;padding:0;}.itens li{padding:0.3rem 0;border-bottom:1px solid #eee;font-size:0.9rem;}' +
            '.total{font-weight:bold;font-size:1.2rem;text-align:right;margin-top:1rem;}.obrigado{text-align:center;margin-top:1.5rem;color:#64748b;font-size:0.85rem;}' +
            '@media (max-width:480px){.comprovante{padding:1rem;}h2{font-size:1.1rem;}.info{font-size:0.8rem;}}</style></head><body><div class="comprovante">' + dados + '<p class="obrigado">Obrigado pela preferência!</p></div></body></html>';
        var win = window.open();
        win.document.write(conteudo);
        win.document.close();
    }

    function mostrarPopupConfirmacaoLoja(opcoes) {
        var overlay = document.createElement('div');
        overlay.className = 'popup-confirmacao';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', opcoes.titulo);
        overlay.innerHTML = '<div class="popup-confirmacao-card">' +
            '<div class="popup-confirmacao-header"><h3>' + opcoes.titulo + '</h3><button class="btn-favorito" style="color:white;" onclick="this.closest(\'.popup-confirmacao\').remove()" aria-label="Fechar">&times;</button></div>' +
            '<div class="popup-confirmacao-body"><p>Seu pedido foi enviado com sucesso!</p>' +
            '<div class="popup-confirmacao-codigo"><p class="label">Código</p><p class="valor">#' + opcoes.codigo + '</p>' +
            '<button class="btn-adicionar-filtro" style="background:white;color:var(--primary);border:1px solid var(--primary);padding:0.5rem 1rem;margin-top:0.5rem;" onclick="navigator.clipboard.writeText(\'' + opcoes.codigo + '\').then(()=>alert(\'Código copiado!\'))">📋 Copiar código</button></div>' +
            '<div class="popup-confirmacao-botoes">' + opcoes.botoes + '</div></div>' +
            '<div class="popup-confirmacao-footer"><button class="btn-modal-fechar" onclick="this.closest(\'.popup-confirmacao\').remove(); ' + (opcoes.onClose || '') + '">Fechar</button></div></div>';
        document.body.appendChild(overlay);
        UI.trapFocus(overlay);
    }

    // ===== IMAGEM EM TELA CHEIA =====
    function abrirModalImagemFullLoja(produto) {
        var imagens = obterImagensProduto(produto);

        if (imagens.length === 0) {
            UI.mostrarToast('Sem imagem para este produto.');
            return;
        }

        var currentIndex = 0;
        var modal = document.createElement('div');
        modal.className = 'modal-imagem-full';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Imagem de ' + produto.nome);
        modal.style.cssText = 'position:fixed; inset:0; background:#000; z-index:20000; display:flex; align-items:center; justify-content:center; width:100vw; height:100vh; margin:0; padding:0;';

        function atualizarModal() {
            var precoContexto = produto.__precoSelecionado !== undefined && produto.__precoSelecionado !== null ? parseFloat(produto.__precoSelecionado) : NaN;
            var precoBase = !isNaN(precoContexto) ? precoContexto : (parseFloat(produto.preco) || 0);
            if (isNaN(precoContexto) && produto.tipo === 'variavel' && produto.variacoes && produto.variacoes.length > 0) {
                var precos = produto.variacoes.map(function(v) { return parseFloat(v.preco) || 0; });
                precoBase = Math.min.apply(null, precos);
            }
            var html = '<div class="container-imagem" style="display:flex; flex-wrap:wrap; justify-content:center; align-items:center; width:100%; height:100%; background:#000; position:relative;">' +
                '<div class="fechar" onclick="this.closest(\'.modal-imagem-full\').remove()" aria-label="Fechar imagem" style="position:absolute; top:1rem; right:1rem; color:white; font-size:2rem; cursor:pointer; background:rgba(0,0,0,0.5); width:2rem; height:2rem; border-radius:50%; display:flex; align-items:center; justify-content:center; z-index:10;">×</div>' +
                '<div class="lado-esquerdo" style="flex:2; min-width:200px; text-align:center; padding:1rem; display:flex; flex-direction:column; justify-content:center; height:100%;">' +
                '<img src="' + imagens[currentIndex] + '" class="imagem-principal" alt="' + produto.nome + '" style="max-width:100%; max-height:70vh; object-fit:contain; margin:auto;">' +
                (imagens.length > 1 ? '<div class="miniaturas" style="display:flex; gap:0.5rem; justify-content:center; margin-top:1rem; flex-wrap:wrap;">' +
                    imagens.map(function(img, idx) {
                        return '<img src="' + img + '" class="miniatura ' + (idx === currentIndex ? 'ativa' : '') + '" data-idx="' + idx + '" alt="Miniatura ' + (idx+1) + '" style="width:50px; height:50px; object-fit:cover; border-radius:0.5rem; cursor:pointer; border:' + (idx === currentIndex ? '2px solid #0a66c2' : '2px solid transparent') + ';">';
                    }).join('') + '</div>' : '') +
                '</div>' +
                '<div class="lado-direito" style="flex:1; padding:1rem; background:#111; color:white; border-radius:0; height:100%; display:flex; flex-direction:column; justify-content:center; gap:1rem;">' +
                '<div class="produto-nome" style="font-size:1.2rem; font-weight:700; color:white;">' + Core.sanitize(produto.nome) + '</div>' +
                '<div class="preco" style="font-size:1.2rem; font-weight:700; color:#0a66c2;">R$ ' + precoBase.toFixed(2) + '</div>' +
                '<div class="descricao" style="font-size:0.9rem; color:#ccc;">' + (produto.descricao || 'Sem descrição') + '</div>' +
                '<div class="produto-quantidade-simples" style="display:flex; align-items:center; gap:8px; margin:8px 0;">' +
                '<button id="menosQtdImg" style="background:#333; color:white; border:none; border-radius:50%; width:26px; height:26px; font-size:14px; cursor:pointer;" aria-label="Diminuir quantidade">−</button>' +
                '<input type="number" id="qtdImg" value="1" min="1" style="width:60px; text-align:center; border:1px solid #444; border-radius:2rem; font-size:12px; padding:4px; background:#222; color:white;" aria-label="Quantidade">' +
                '<button id="maisQtdImg" style="background:#333; color:white; border:none; border-radius:50%; width:26px; height:26px; font-size:14px; cursor:pointer;" aria-label="Aumentar quantidade">+</button>' +
                '</div>' +
                '<button class="btn-adicionar-simples" id="addImagem" style="background:#0a66c2; color:white; border:none; border-radius:2rem; padding:10px; font-size:14px; font-weight:600; cursor:pointer;">Adicionar ao carrinho</button>' +
                '</div></div>';
            modal.innerHTML = html;

            modal.querySelectorAll('.miniatura').forEach(function(mini) {
                mini.addEventListener('click', function() {
                    currentIndex = parseInt(mini.dataset.idx);
                    atualizarModal();
                });
            });

            var qtdInput = modal.querySelector('#qtdImg');
            var menosBtn = modal.querySelector('#menosQtdImg');
            var maisBtn = modal.querySelector('#maisQtdImg');
            var precoSpan = modal.querySelector('.preco');

            function atualizarPrecoImagem() {
                var qtd = parseInt(qtdInput.value) || 1;
                var total = precoBase * qtd;
                precoSpan.textContent = 'R$ ' + total.toFixed(2);
            }
            menosBtn.addEventListener('click', function() { qtdInput.stepDown(); atualizarPrecoImagem(); });
            maisBtn.addEventListener('click', function() { qtdInput.stepUp(); atualizarPrecoImagem(); });
            qtdInput.addEventListener('change', atualizarPrecoImagem);
            atualizarPrecoImagem();

            modal.querySelector('#addImagem').addEventListener('click', function() {
                var qtd = parseInt(qtdInput.value) || 1;
                if (produto.tipo === 'variavel' && produto.variacoes && produto.variacoes.length > 0) {
                    modal.remove();
                    abrirModalVariacoes(produto);
                    return;
                }
                if (produto.estoque !== null && produto.estoque !== undefined && produto.estoque !== '') {
                    var estoqueDisp = parseInt(produto.estoque);
                    if (!isNaN(estoqueDisp) && qtd > estoqueDisp) {
                        UI.mostrarToast('Estoque insuficiente. Disponível: ' + estoqueDisp, 'erro');
                        return;
                    }
                }
                var existing = carrinho.find(function(i) { return i.id === produto.id && !i.variacaoId; });
                if (existing) {
                    existing.quantidade += qtd;
                } else {
                    carrinho.push({
                        id: produto.id,
                        nome: produto.nome,
                        preco: precoBase,
                        quantidade: qtd,
                        imagem: produto.imagem || null,
                        variacaoId: null,
                        estoque: produto.estoque
                    });
                }
                atualizarCarrinhoLoja();
                UI.mostrarToast('Produto adicionado ao carrinho');
                modal.remove();
                UI.restoreFocus();
            });
        }

        atualizarModal();
        document.body.appendChild(modal);
        UI.trapFocus(modal);
    }

    // ===== MODAL DE VARIAÇÕES =====
function abrirModalVariacoes(produto) {
    var atributos = produto.atributos || [];
    var variacoes = produto.variacoes || [];
    if (variacoes.length === 0) {
        UI.mostrarToast('Este produto não possui variações disponíveis.');
        return;
    }

    var primeiraComEstoque = null;
    for (var i = 0; i < variacoes.length; i++) {
        var est = parseInt(variacoes[i].estoque) || 0;
        if (est > 0) {
            primeiraComEstoque = variacoes[i];
            break;
        }
    }

    if (!primeiraComEstoque) {
        UI.mostrarToast('Todas as variações estão esgotadas.');
        return;
    }

    var selecaoAtual = {};
    for (var attr in primeiraComEstoque.atributos) {
        selecaoAtual[attr] = primeiraComEstoque.atributos[attr];
    }

    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.display = 'flex';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Escolher variação de ' + produto.nome);

    // ===== LAYOUT PADRONIZADO DO MÓDULO PEDIDOS =====
    var imagensPrimeiraVariacao = obterImagensVariacao(primeiraComEstoque);
    var imagemInicialVariacao = imagensPrimeiraVariacao[0] || obterImagemPrincipalProduto(produto) || 'https://via.placeholder.com/300';
    modal.innerHTML = '<div class="modal-conteudo modal-variacao-full">' +
        '<div class="modal-header"><div><span class="modal-eyebrow">Escolha uma opção</span><h3>' + Core.sanitize(produto.nome) + '</h3></div><button class="btn-modal-fechar" onclick="this.closest(\'.modal-overlay\').remove()" aria-label="Fechar">✕</button></div>' +
        '<div class="modal-config-body">' +
        '<main class="modal-config-main">' +
        '<div class="modal-step"><div class="modal-step-number">1</div><div class="modal-step-content"><div class="modal-step-heading"><div><h4>Escolha a variação</h4><p>Selecione uma opção em cada grupo.</p></div><span class="modal-required">Obrigatório</span></div><div id="atributosContainer" class="modal-options-list"></div></div></div>' +
        '</main>' +
        '<aside class="modal-order-summary"><h4>Resumo da escolha</h4>' +
        '<img id="variacaoImagem" class="variation-summary-image" src="' + imagemInicialVariacao + '" alt="' + Core.sanitize(produto.nome) + '" loading="lazy">' +
        '<p class="variation-summary-description">' + Core.sanitize(produto.descricao || 'Sem descrição') + '</p>' +
        '<div id="variacaoInfo">Preço: R$ ' + (parseFloat(primeiraComEstoque.preco) || 0).toFixed(2) + '<br>Estoque disponível: ' + (parseInt(primeiraComEstoque.estoque) || 0) + '</div>' +
        '<div class="variation-quantity"><button id="variacaoMenosQtd" aria-label="Diminuir quantidade">−</button><input type="number" id="variacaoQtd" value="1" min="1" aria-label="Quantidade"><button id="variacaoMaisQtd" aria-label="Aumentar quantidade">+</button></div>' +
        '</aside>' +
        '</div>' +
        '<div class="modal-config-footer"><div class="modal-total"><span>Total da escolha</span><strong id="variacaoTotal">R$ ' + (parseFloat(primeiraComEstoque.preco) || 0).toFixed(2) + '</strong></div><button class="btn-pedido-cta" id="btnAddVariacao">Adicionar ao carrinho</button></div>' +
        '</div>';

    document.body.appendChild(modal);
    UI.trapFocus(modal);

    var atributosContainer = document.getElementById('atributosContainer');
    var variacaoImagem = document.getElementById('variacaoImagem');
    var variacaoInfo = document.getElementById('variacaoInfo');
    var qtdInput = document.getElementById('variacaoQtd');
    var btnAdd = document.getElementById('btnAddVariacao');

    btnAdd.disabled = false;

    variacaoImagem.onclick = function() {
        var prodClone = JSON.parse(JSON.stringify(produto));
        var variacaoSelecionada = null;
        for (var vi = 0; vi < variacoes.length; vi++) {
            var candidata = variacoes[vi];
            var corresponde = true;
            for (var va in selecaoAtual) {
                if (candidata.atributos[va] !== selecaoAtual[va]) {
                    corresponde = false;
                    break;
                }
            }
            if (corresponde) {
                variacaoSelecionada = candidata;
                break;
            }
        }
        var imagensSelecionadas = obterImagensVariacao(variacaoSelecionada);
        if (imagensSelecionadas.length === 0) imagensSelecionadas = obterImagensBaseProduto(produto);
        prodClone.imagem = imagensSelecionadas[0] || obterImagemPrincipalProduto(produto) || '';
        prodClone.imagens = imagensSelecionadas.slice(1);
        if (variacaoSelecionada) {
            prodClone.__precoSelecionado = parseFloat(variacaoSelecionada.preco) || 0;
            prodClone.__estoqueSelecionado = variacaoSelecionada.estoque;
            prodClone.__variacaoSelecionada = JSON.parse(JSON.stringify(variacaoSelecionada));
        }
        abrirModalImagemFullLoja(prodClone);
    };

    function renderizarAtributos() {
        atributosContainer.innerHTML = '';
        atributos.forEach(function(attr) {
            var div = document.createElement('div');
            div.className = 'modal-option-group';
            var label = document.createElement('span');
            label.className = 'modal-option-label';
            label.textContent = attr.nome;
            div.appendChild(label);

            var opcoesDiv = document.createElement('div');
            opcoesDiv.className = 'modal-option-buttons';
            (attr.opcoes || []).forEach(function(opcao) {
                var btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-tamanho-modal';
                if (selecaoAtual[attr.nome] === opcao) btn.classList.add('ativo');
                btn.textContent = opcao;
                btn.dataset.attr = attr.nome;
                btn.dataset.opcao = opcao;
                btn.onclick = function() {
                    selecaoAtual[attr.nome] = opcao;
                    opcoesDiv.querySelectorAll('.btn-tamanho-modal').forEach(function(b) {
                        b.classList.toggle('ativo', b.dataset.opcao === opcao && b.dataset.attr === attr.nome);
                    });
                    atualizarVariacaoSelecionada();
                };
                opcoesDiv.appendChild(btn);
            });
            div.appendChild(opcoesDiv);
            atributosContainer.appendChild(div);
        });
    }

    function atualizarVariacaoSelecionada() {
        var encontrada = null;
        for (var i = 0; i < variacoes.length; i++) {
            var v = variacoes[i];
            var match = true;
            for (var attr in selecaoAtual) {
                if (v.atributos[attr] !== selecaoAtual[attr]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                encontrada = v;
                break;
            }
        }

        if (encontrada) {
            var preco = parseFloat(encontrada.preco) || 0;
            var estoque = parseInt(encontrada.estoque) || 0;
            variacaoInfo.innerHTML = 'Preço: R$ ' + preco.toFixed(2) + '<br>Estoque disponível: ' + estoque;
            var variacaoTotal = document.getElementById('variacaoTotal');
            if (variacaoTotal) variacaoTotal.textContent = 'R$ ' + preco.toFixed(2);
            var imagensEncontradas = obterImagensVariacao(encontrada);
            variacaoImagem.src = imagensEncontradas[0] || obterImagemPrincipalProduto(produto) || 'https://via.placeholder.com/150';
            qtdInput.max = estoque > 0 ? estoque : 1;
            if (parseInt(qtdInput.value) > estoque && estoque > 0) {
                qtdInput.value = estoque;
            }
            btnAdd.disabled = (estoque <= 0);
        } else {
            variacaoInfo.innerHTML = 'Combinação não disponível.';
            var variacaoTotal = document.getElementById('variacaoTotal');
            if (variacaoTotal) variacaoTotal.textContent = 'Indisponível';
            variacaoImagem.src = obterImagemPrincipalProduto(produto) || 'https://via.placeholder.com/150';
            btnAdd.disabled = true;
        }
    }

    document.getElementById('variacaoMenosQtd').onclick = function() {
        var val = parseInt(qtdInput.value) || 1;
        if (val > 1) qtdInput.value = val - 1;
    };
    document.getElementById('variacaoMaisQtd').onclick = function() {
        var val = parseInt(qtdInput.value) || 1;
        var max = parseInt(qtdInput.max) || 999;
        if (val < max) qtdInput.value = val + 1;
    };

    btnAdd.onclick = function() {
        if (btnAdd.disabled) return;
        var qtd = parseInt(qtdInput.value) || 1;
        var encontrada = null;
        for (var i = 0; i < variacoes.length; i++) {
            var v = variacoes[i];
            var match = true;
            for (var attr in selecaoAtual) {
                if (v.atributos[attr] !== selecaoAtual[attr]) {
                    match = false;
                    break;
                }
            }
            if (match) {
                encontrada = v;
                break;
            }
        }
        if (!encontrada) {
            UI.mostrarToast('Selecione uma combinação válida.', 'erro');
            return;
        }
        var estoqueDisp = parseInt(encontrada.estoque) || 0;
        if (qtd > estoqueDisp) {
            UI.mostrarToast('Estoque insuficiente. Disponível: ' + estoqueDisp, 'erro');
            return;
        }

        var atributosStr = '';
        for (var attr in selecaoAtual) {
            atributosStr += (atributosStr ? ', ' : '') + attr + ': ' + selecaoAtual[attr];
        }
        var nomeCompleto = produto.nome + (atributosStr ? ' (' + atributosStr + ')' : '');

        var existing = carrinho.find(function(item) {
            return item.id === produto.id && item.variacaoId === encontrada.sku;
        });
        if (existing) {
            existing.quantidade += qtd;
        } else {
            carrinho.push({
                id: produto.id,
                nome: nomeCompleto,
                preco: parseFloat(encontrada.preco) || 0,
                quantidade: qtd,
                imagem: encontrada.imagem || produto.imagem || null,
                variacaoId: encontrada.sku,
                atributos: selecaoAtual,
                estoque: encontrada.estoque
            });
        }
        atualizarCarrinhoLoja();
        UI.mostrarToast('Produto adicionado ao carrinho');
        modal.remove();
        UI.restoreFocus();
    };

    renderizarAtributos();
    atualizarVariacaoSelecionada();
}
    // ===== RENDERIZAÇÃO DE PRODUTOS =====
    function renderizarProdutosLoja(produtos) {
        if (!produtos || produtos.length === 0) {
            return '<p style="text-align:center;padding:2rem;">Nenhum produto disponível.</p>';
        }
        var categorias = {};
        produtos.forEach(function(p) {
            var cat = p.categoria || 'Geral';
            if (!categorias[cat]) categorias[cat] = [];
            categorias[cat].push(p);
        });
        var html = '';
        for (var cat in categorias) {
            html += '<div class="categoria-group">' +
                '<div class="categoria-titulo-modal" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === \'none\' ? \'grid\' : \'none\';">' + Core.sanitize(cat) + ' ▼</div>' +
                '<div class="produtos-grid">';
            categorias[cat].forEach(function(prod) {
                html += gerarHTMLProdutoLoja(prod);
            });
            html += '</div></div>';
        }
        return html;
    }

    function gerarHTMLProdutoLoja(prod) {
        var tipo = prod.tipo || 'simples';
        var temVariacoes = (tipo === 'variavel' && prod.variacoes && prod.variacoes.length > 0);
        var esgotado = false;
        var imagensProduto = obterImagensProduto(prod);
        var imagemPrincipal = imagensProduto[0] || null;

        if (tipo === 'variavel') {
            var totalEstoque = prod.variacoes.reduce(function(acc, v) {
                var est = parseInt(v.estoque) || 0;
                return acc + est;
            }, 0);
            esgotado = (totalEstoque <= 0);
        } else {
            var est = parseInt(prod.estoque);
            if (!isNaN(est) && est !== null && est !== undefined) {
                esgotado = (est <= 0);
            }
        }

        var imgHtml = imagemPrincipal ?
            '<img src="' + imagemPrincipal + '" loading="lazy" alt="' + Core.sanitize(prod.nome) + '" onclick="window.abrirModalImagemFullLoja(' + JSON.stringify(prod).replace(/"/g, '&quot;') + ')" style="cursor:pointer;">' :
            '<div style="width:100%;aspect-ratio:1;background:#f1f5f9;border-radius:0.5rem;display:flex;align-items:center;justify-content:center;">📷</div>';

        var precoExibido = '';
        if (temVariacoes) {
            var precos = prod.variacoes.map(function(v) { return parseFloat(v.preco) || 0; });
            var minPreco = Math.min.apply(null, precos);
            var maxPreco = Math.max.apply(null, precos);
            if (minPreco === maxPreco) {
                precoExibido = 'R$ ' + minPreco.toFixed(2);
            } else {
                precoExibido = 'A partir de R$ ' + minPreco.toFixed(2);
            }
        } else {
            precoExibido = 'R$ ' + (parseFloat(prod.preco) || 0).toFixed(2);
        }

        var estoqueInfo = '';
        if (tipo === 'variavel') {
            var totalEstoque2 = prod.variacoes.reduce(function(acc, v) {
                var est2 = parseInt(v.estoque) || 0;
                return acc + est2;
            }, 0);
            if (!isNaN(totalEstoque2) && totalEstoque2 !== null && totalEstoque2 !== undefined) {
                estoqueInfo = '<div style="font-size:0.65rem; color:' + (totalEstoque2 <= 5 ? '#dc3545' : '#64748b') + ';">Estoque total: ' + totalEstoque2 + '</div>';
            }
        } else {
            var estGeral = parseInt(prod.estoque);
            if (!isNaN(estGeral) && estGeral !== null && estGeral !== undefined) {
                estoqueInfo = '<div style="font-size:0.65rem; color:' + (estGeral <= 5 ? '#dc3545' : '#64748b') + ';">Estoque: ' + estGeral + '</div>';
            }
        }

        var botaoHtml = '';
        if (temVariacoes) {
            botaoHtml = '<button class="btn-escolher" data-prod-id="' + prod.id + '" data-tipo="variavel" ' + (esgotado ? 'disabled' : '') + '>' + (esgotado ? 'Indisponível' : 'Escolher') + '</button>';
        } else {
            botaoHtml = '<div class="produto-quantidade-simples">' +
                '<button class="qtd-btn-simples" data-prod-id="' + prod.id + '" data-delta="-1" aria-label="Diminuir quantidade">−</button>' +
                '<input type="number" id="qtd_simples_' + prod.id + '" value="1" min="1" style="width:3rem; text-align:center;" aria-label="Quantidade">' +
                '<button class="qtd-btn-simples" data-prod-id="' + prod.id + '" data-delta="1" aria-label="Aumentar quantidade">+</button>' +
                '</div>' +
                '<button class="btn-adicionar-simples" data-prod-id="' + prod.id + '" data-preco="' + (parseFloat(prod.preco) || 0) + '" ' + (esgotado ? 'disabled' : '') + '>' + (esgotado ? 'Indisponível' : 'Adicionar') + '</button>';
        }

        return '<div class="produto-card" data-prod-id="' + prod.id + '">' +
            imgHtml +
            '<div class="card-content-produto">' +
            '<div class="produto-nome">' + Core.sanitize(prod.nome) + '</div>' +
            '<div class="produto-preco">' + precoExibido + '</div>' +
            estoqueInfo +
            '</div>' +
            botaoHtml +
            '</div>';
    }

    // ===== CARRINHO =====
    function atualizarCarrinhoLoja() {
        var container = document.getElementById('carrinhoLista');
        if (!container) return;
        if (carrinho.length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:1rem;">Carrinho vazio</p>';
            recalcularTotalLoja();
            return;
        }
        var subtotal = 0;
        container.innerHTML = carrinho.map(function(item) {
            var subtotalItem = item.preco * item.quantidade;
            subtotal += subtotalItem;
            return '<div class="item-carrinho">' +
                '<img src="' + (item.imagem || 'https://via.placeholder.com/40') + '" class="item-carrinho-imagem" onerror="this.style.display=\'none\'">' +
                '<div style="flex:1"><strong>' + Core.sanitize(item.nome) + '</strong><br>R$ ' + item.preco.toFixed(2) + '</div>' +
                '<input type="number" min="1" value="' + item.quantidade + '" class="qtd-item" data-id="' + item.id + '" data-variacao="' + (item.variacaoId || '') + '" onchange="alterarQuantidadeLoja(\'' + item.id + '\', this.value, \'' + (item.variacaoId || '') + '\')">' +
                '<button class="btn-pequeno" onclick="removerDoCarrinhoLoja(\'' + item.id + '\', \'' + (item.variacaoId || '') + '\')">✕</button>' +
                '</div>';
        }).join('');
        document.getElementById('carrinhoSubtotal').innerText = subtotal.toFixed(2);
        recalcularTotalLoja();
        atualizarBadgeCarrinhoLoja();
    }

    function recalcularTotalLoja() {
        var subtotal = carrinho.reduce(function(acc, i) { return acc + i.preco * i.quantidade; }, 0);
        var frete = parseFloat(document.getElementById('selectFreteLoja')?.value) || 0;
        var total = subtotal + frete - cupomDesconto;
        if (total < 0) total = 0;
        document.getElementById('totalLoja').innerText = total.toFixed(2);
    }

    function adicionarAoCarrinhoLoja(prodId) {
        if (statusLojaAtual !== 'aberta') {
            UI.mostrarToast('A loja está fechada ou pausada no momento.', 'erro');
            return;
        }
        var produto = produtosCache.find(function(p) { return p.id === prodId; });
        if (!produto) return;
        if (produto.tipo === 'variavel' && produto.variacoes && produto.variacoes.length > 0) {
            abrirModalVariacoes(produto);
            return;
        }
        if (produto.estoque !== null && produto.estoque !== undefined && produto.estoque !== '') {
            var estoqueDisp = parseInt(produto.estoque);
            if (!isNaN(estoqueDisp) && estoqueDisp <= 0) {
                UI.mostrarToast('Produto esgotado.', 'erro');
                return;
            }
        }
        var qtdInput = document.getElementById('qtd_simples_' + prodId);
        var quantidade = qtdInput ? parseInt(qtdInput.value) : 1;
        if (isNaN(quantidade) || quantidade < 1) quantidade = 1;

        var existing = carrinho.find(function(i) { return i.id === prodId && !i.variacaoId; });
        if (existing) {
            existing.quantidade += quantidade;
        } else {
            carrinho.push({
                id: produto.id,
                nome: produto.nome,
                preco: parseFloat(produto.preco) || 0,
                quantidade: quantidade,
                imagem: produto.imagem || null,
                variacaoId: null,
                estoque: produto.estoque
            });
        }
        atualizarCarrinhoLoja();
        UI.mostrarToast('Produto adicionado ao carrinho');
    }

    function removerDoCarrinhoLoja(id, variacaoId) {
        if (!confirm('Remover este item do carrinho?')) return;
        carrinho = carrinho.filter(function(i) {
            if (variacaoId) {
                return !(i.id === id && i.variacaoId === variacaoId);
            }
            return i.id !== id;
        });
        atualizarCarrinhoLoja();
    }

    function alterarQuantidadeLoja(id, qtd, variacaoId) {
        qtd = parseInt(qtd);
        if (isNaN(qtd) || qtd < 1) qtd = 1;
        var item = carrinho.find(function(i) {
            if (variacaoId) {
                return i.id === id && i.variacaoId === variacaoId;
            }
            return i.id === id && !i.variacaoId;
        });
        if (item) {
            if (item.estoque !== null && item.estoque !== undefined && item.estoque !== '') {
                var estoqueMax = parseInt(item.estoque);
                if (!isNaN(estoqueMax) && qtd > estoqueMax) {
                    UI.mostrarToast('Estoque insuficiente. Disponível: ' + estoqueMax, 'erro');
                    atualizarCarrinhoLoja();
                    return;
                }
            }
            item.quantidade = qtd;
            atualizarCarrinhoLoja();
        }
    }

    function atualizarBadgeCarrinhoLoja() {
        var total = carrinho.reduce(function(acc, i) { return acc + i.quantidade; }, 0);
        var badge = document.getElementById('cartBadgeLoja');
        if (badge) {
            if (total > 0) {
                badge.textContent = total;
                badge.style.display = 'inline-block';
                badge.setAttribute('aria-label', total + ' itens no carrinho');
            } else {
                badge.style.display = 'none';
            }
        }
    }

    // ===== CUPOM COM FIRESTORE =====
    function aplicarCupomLoja() {
        var cod = document.getElementById('cupomLoja').value.trim().toUpperCase();
        var statusDiv = document.getElementById('cupomLojaStatus');
        if (!cod) { statusDiv.innerHTML = 'Digite um código.'; return; }

        Core.db.collection('lojistas').where('estabelecimentoId', '==', estId).limit(1).get()
            .then(function(snap) {
                if (snap.empty) { statusDiv.innerHTML = '<span style="color:#dc3545;">❌ Erro ao validar cupom.</span>'; return; }
                var lojistaId = snap.docs[0].id;
                return Core.db.collection('lojistas').doc(lojistaId).collection('cupons')
                    .where('codigo', '==', cod)
                    .where('ativo', '==', 'sim')
                    .limit(1).get();
            })
            .then(function(snapCupons) {
                if (snapCupons.empty) {
                    cupomDesconto = 0;
                    statusDiv.innerHTML = '<span style="color:#dc3545;">❌ Cupom inválido ou expirado</span>';
                    recalcularTotalLoja();
                    return;
                }
                var cupom = snapCupons.docs[0].data();
                if (cupom.validade && new Date(cupom.validade) < new Date()) {
                    cupomDesconto = 0;
                    statusDiv.innerHTML = '<span style="color:#dc3545;">❌ Cupom expirado</span>';
                    recalcularTotalLoja();
                    return;
                }
                var subtotal = carrinho.reduce(function(acc, i) { return acc + i.preco * i.quantidade; }, 0);
                var frete = parseFloat(document.getElementById('selectFreteLoja')?.value) || 0;
                var totalPedido = subtotal + frete;
                if (cupom.minimoPedido && totalPedido < cupom.minimoPedido) {
                    cupomDesconto = 0;
                    statusDiv.innerHTML = '<span style="color:#dc3545;">❌ Pedido mínimo: R$ ' + cupom.minimoPedido.toFixed(2) + '</span>';
                    recalcularTotalLoja();
                    return;
                }
                var desconto = cupom.tipo === 'percentual' ? totalPedido * cupom.valor / 100 : cupom.valor;
                if (desconto > totalPedido) desconto = totalPedido;
                cupomDesconto = desconto;
                statusDiv.innerHTML = '<span style="color:#10b981;">✅ Cupom aplicado! Desconto de ' + (cupom.tipo === 'percentual' ? cupom.valor + '%' : 'R$ ' + cupom.valor.toFixed(2)) + '</span>';
                recalcularTotalLoja();
            })
            .catch(function(err) {
                cupomDesconto = 0;
                statusDiv.innerHTML = '<span style="color:#dc3545;">❌ Erro ao validar cupom</span>';
                recalcularTotalLoja();
                console.error(err);
            });
    }

    // ===== TROCO =====
    function toggleTrocoLoja() {
        var val = document.getElementById('formaPagamentoLoja')?.value;
        var wrapper = document.getElementById('trocoParaWrapperLoja');
        var trocoInput = document.getElementById('trocoParaLoja');
        var checkbox = document.getElementById('semTrocoCheckboxLoja');
        if (checkbox && !checkbox.dataset.listenerAdded) {
            checkbox.dataset.listenerAdded = 'true';
            checkbox.addEventListener('change', toggleTrocoLoja);
        }
        var dinheiro = val === 'Dinheiro';
        if (wrapper) wrapper.style.display = dinheiro ? 'block' : 'none';
        if (trocoInput) {
            trocoInput.disabled = !dinheiro || !!(checkbox && checkbox.checked);
            if (checkbox && checkbox.checked) trocoInput.value = '';
        }
    }

    // ===== FINALIZAR PEDIDO =====
    function finalizarPedidoLoja() {
        if (statusLojaAtual !== 'aberta') {
            UI.mostrarToast('A loja está fechada ou pausada no momento. Tente novamente mais tarde.', 'erro');
            return;
        }
        if (carrinho.length === 0) {
            UI.mostrarToast('Adicione itens ao carrinho.', 'erro');
            return;
        }
        var nome = document.getElementById('clienteNomeLoja').value.trim();
        var tel = document.getElementById('clienteTelLoja').value.trim();
        var end = document.getElementById('enderecoLoja').value.trim();
        if (!nome || nome.length < 2) {
            UI.mostrarToast('Por favor, informe seu nome completo.', 'erro');
            return;
        }
        var telNumerico = tel.replace(/\D/g, '');
        if (!telNumerico || telNumerico.length < 10) {
            UI.mostrarToast('Telefone inválido. Informe DDD + número.', 'erro');
            return;
        }
        if (!end) {
            UI.mostrarToast('Informe o endereço para entrega.', 'erro');
            return;
        }
        var formaPagamento = document.getElementById('formaPagamentoLoja').value;
        var semTrocoCheckbox = document.getElementById('semTrocoCheckboxLoja');
        var trocoInput = document.getElementById('trocoParaLoja');
        var semTroco = !!(semTrocoCheckbox && semTrocoCheckbox.checked);
        var trocoValor = trocoInput ? trocoInput.value.trim() : '';
        if (formaPagamento === 'Dinheiro' && !semTroco && !trocoValor) {
            UI.mostrarToast('Informe o valor para troco, ou marque "Não preciso de troco".', 'erro');
            return;
        }
        salvarDadosClienteLocal(nome, telNumerico, end);

        var subtotal = carrinho.reduce(function(acc, i) { return acc + i.preco * i.quantidade; }, 0);
        var frete = parseFloat(document.getElementById('selectFreteLoja')?.value) || 0;
        var total = Math.max(0, subtotal + frete - cupomDesconto);
        var pedidoItens = carrinho.map(function(i) {
            return {
                nome: i.nome,
                quantidade: i.quantidade,
                precoUnitario: i.preco,
                variacaoId: i.variacaoId || null,
                atributos: i.atributos || null
            };
        });
        var codigoCurto = Math.random().toString(36).substring(2, 8).toUpperCase();
        var pedido = {
            estabelecimentoId: estId,
            estabelecimentoNome: nomeEstab,
            clienteId: Core.getCurrentUser()?.uid || null,
            clienteNome: nome,
            clienteTelefone: telNumerico,
            endereco: end,
            itens: pedidoItens,
            subtotal: subtotal,
            taxaEntrega: frete,
            total: total,
            formaPagamento: formaPagamento,
            trocoPara: formaPagamento === 'Dinheiro' && !semTroco ? trocoValor : '',
            observacao: document.getElementById('obsLoja').value,
            status: 'pendente',
            codigoCurto: codigoCurto,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!currentLojistaId) {
            UI.mostrarToast('Erro: lojista não identificado.', 'erro');
            return;
        }
        Core.db.collection('pedidos').add(pedido)
            .then(function() {
                var updates = carrinho.map(function(item) {
                    if (item.estoque !== null && item.estoque !== undefined && item.estoque !== '') {
                        var novoEstoque = Math.max(0, parseInt(item.estoque) - item.quantidade);
                        if (item.variacaoId) {
                            return Core.db.collection('lojistas').doc(currentLojistaId).collection('cardapio').doc(item.id).get()
                                .then(function(doc) {
                                    if (doc.exists) {
                                        var data = doc.data();
                                        if (data.tipo === 'variavel' && data.variacoes) {
                                            var variacoes = data.variacoes.map(function(v) {
                                                if (v.sku === item.variacaoId) {
                                                    v.estoque = novoEstoque.toString();
                                                }
                                                return v;
                                            });
                                            return Core.db.collection('lojistas').doc(currentLojistaId).collection('cardapio').doc(item.id)
                                                .update({ variacoes: variacoes });
                                        }
                                    }
                                    return Promise.resolve();
                                });
                        } else {
                            return Core.db.collection('lojistas').doc(currentLojistaId).collection('cardapio').doc(item.id)
                                .update({ estoque: novoEstoque.toString() });
                        }
                    }
                    return Promise.resolve();
                });
                return Promise.all(updates);
            })
            .then(function() {
                gerarComprovanteLoja(pedido, codigoCurto);
                mostrarPopupConfirmacaoLoja({
                    titulo: '✅ Pedido Confirmado!',
                    codigo: codigoCurto,
                    botoes: '<button class="btn-adicionar-filtro" onclick="fecharModalLoja(); document.getElementById(\'consultaRastreio\').value=\'' + codigoCurto + '\'; this.closest(\'.popup-confirmacao\').remove();">🔍 Acompanhar</button>' +
                        '<button class="btn-adicionar-filtro" style="background:#2c3e50;" onclick="gerarComprovanteLoja(' + JSON.stringify(pedido).replace(/"/g, '&quot;') + ', \'' + codigoCurto + '\'); this.closest(\'.popup-confirmacao\').remove();">🖨️ Comprovante</button>',
                    onClose: 'fecharModalLoja()'
                });
                carrinho = [];
                atualizarCarrinhoLoja();
            })
            .catch(function(err) {
                UI.mostrarToast('Erro ao finalizar pedido: ' + err.message, 'erro');
            });
    }

    // ===== CONSULTAR PEDIDO =====
    function consultarPedidoRastreio() {
        var cod = document.getElementById('consultaRastreio').value.trim().toUpperCase();
        var resDiv = document.getElementById('resultadoRastreio');
        if (!cod) { resDiv.innerHTML = '<p style="color:#dc3545;">Digite o código do pedido.</p>'; return; }
        Core.db.collection('pedidos').where('codigoCurto', '==', cod).limit(1).get()
            .then(function(snap) {
                if (snap.empty) { resDiv.innerHTML = '<p style="color:#dc3545;">🔍 Pedido não encontrado.</p>'; return; }
                var p = snap.docs[0].data();
                var statusMap = {
                    'pendente': { label: 'Aguardando Loja', icon: '⏳', color: '#f59e0b' },
                    'confirmado': { label: 'Pedido Confirmado', icon: '✅', color: '#10b981' },
                    'em_preparo': { label: 'Sendo Preparado', icon: '👨‍🍳', color: '#6366f1' },
                    'saiu_entrega': { label: 'Saiu para Entrega', icon: '🛵', color: '#3b82f6' },
                    'concluido': { label: 'Entregue', icon: '🏁', color: '#10b981' },
                    'cancelado': { label: 'Cancelado', icon: '❌', color: '#ef4444' }
                };
                var s = statusMap[p.status] || statusMap.pendente;
                resDiv.innerHTML = '<div style="background:' + s.color + '10; border:2px solid ' + s.color + '; border-radius:1rem; padding:1rem;">' +
                    '<div style="text-align:center;"><span style="font-size:2rem;">' + s.icon + '</span><h3 style="color:' + s.color + ';">' + s.label + '</h3></div>' +
                    '<p><strong>Data:</strong> ' + (p.criadoEm ? new Date(p.criadoEm.toDate()).toLocaleString() : '---') + '</p>' +
                    '<p><strong>Total:</strong> R$ ' + p.total.toFixed(2) + '</p>' +
                    '<p><strong>Itens:</strong> ' + (p.itens ? p.itens.map(function(i) { return i.quantidade + 'x ' + i.nome; }).join(', ') : '') + '</p>' +
                    '<p><strong>Pagamento:</strong> ' + p.formaPagamento + (p.trocoPara ? ' (Troco para R$ ' + parseFloat(p.trocoPara).toFixed(2) + ')' : '') + '</p></div>';
            });
    }

    // ===== HISTÓRICO =====
    function carregarHistoricoLoja(estIdLocal) {
        if (!Core.getCurrentUser()) return;
        var container = document.getElementById('listaHistoricoLoja');
        if (!container) return;
        Core.db.collection('pedidos').where('clienteId', '==', Core.getCurrentUser().uid)
            .where('estabelecimentoId', '==', estIdLocal)
            .orderBy('criadoEm', 'desc').limit(20).get()
            .then(function(snap) {
                if (snap.empty) { container.innerHTML = '<p>Nenhum pedido anterior.</p>'; return; }
                var html = '';
                snap.forEach(function(doc) {
                    var p = doc.data();
                    var codigo = p.codigoCurto || doc.id.slice(0,6).toUpperCase();
                    html += '<div style="border:1px solid var(--gray-200); border-radius:0.75rem; padding:0.75rem; margin-bottom:0.5rem; background:white;">' +
                        '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">' +
                        '<div><strong>#' + codigo + '</strong> <span style="background:' + (p.status === 'pendente' ? '#fff7ed' : p.status === 'concluido' ? '#ecfdf5' : '#f1f5f9') + '; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.7rem;">' + (p.status || 'pendente') + '</span></div>' +
                        '<div>' + (p.criadoEm ? new Date(p.criadoEm.toDate()).toLocaleString() : '---') + '</div></div>' +
                        '<div><strong>Total:</strong> R$ ' + p.total.toFixed(2) + '</div>' +
                        '<button class="btn-acao btn-qrcode" style="margin-top:0.5rem;" onclick="gerarComprovanteLoja(' + JSON.stringify(p).replace(/"/g, '&quot;') + ', \'' + codigo + '\')">🖨️ Ver comprovante</button>' +
                        '</div>';
                });
                container.innerHTML = html;
            });
    }

    // ===== FECHAR MODAL =====
    window.fecharModalLoja = function() {
        if (unsubscribeCardapio) { unsubscribeCardapio(); unsubscribeCardapio = null; }
        if (unsubscribeFretes) { unsubscribeFretes(); unsubscribeFretes = null; }
        if (unsubscribeStatusLoja) { unsubscribeStatusLoja(); unsubscribeStatusLoja = null; }
        var modal = document.getElementById('modalLoja');
        if (modal) modal.remove();
        UI.restoreFocus();
    };

    // ===== ATUALIZAR STATUS UI =====
    function atualizarStatusLojaUI(statusLoja, statusMessage) {
        var msgDiv = document.getElementById('statusLojaMsgLoja');
        var statusBadge = document.getElementById('statusLojaBadgeLoja');
        var btnFinalizar = document.getElementById('btnFinalizarCompra');
        var bloqueado = (statusLoja === 'fechada' || statusLoja === 'pausada');
        var statusTexto = statusLoja === 'fechada' ? 'Loja fechada' : (statusLoja === 'pausada' ? 'Pedidos pausados' : 'Aceitando pedidos');
        var mensagem = String(statusMessage || '').trim();
        statusLojaAtual = statusLoja;
        if (statusBadge) {
            statusBadge.className = 'modal-estabelecimento-status status-' + statusLoja;
            statusBadge.textContent = statusTexto;
        }
        if (msgDiv) {
            var deveExibirMensagem = bloqueado || mensagem !== '';
            msgDiv.className = 'status-' + statusLoja;
            msgDiv.style.display = deveExibirMensagem ? 'block' : 'none';
            msgDiv.innerHTML = '<span class="modal-status-label">Aviso da loja</span><span class="modal-status-text">' + Core.sanitize(mensagem || (statusLoja === 'fechada' ? 'A loja está fechada no momento.' : 'Os pedidos estão pausados no momento.')) + '</span>';
            msgDiv.setAttribute('role', 'alert');
        }
        if (btnFinalizar) {
            btnFinalizar.disabled = bloqueado;
            btnFinalizar.style.opacity = bloqueado ? '0.5' : '1';
            btnFinalizar.style.pointerEvents = bloqueado ? 'none' : 'auto';
        }
    }

    // ===== EXPOR FUNÇÃO GLOBAL =====
    window.abrirModalImagemFullLoja = abrirModalImagemFullLoja;

    // ===== INICIALIZAR MODAL =====
    Core.db.collection('lojistas').where('estabelecimentoId', '==', estId).limit(1).get()
        .then(function(snap) {
            if (snap.empty) {
                UI.mostrarToast('Estabelecimento não configurado para loja.', 'erro');
                return;
            }
            var lojistaDoc = snap.docs[0];
            currentLojistaId = lojistaDoc.id;
            var lojistaData = lojistaDoc.data();
            atualizarStatusLojaUI(lojistaData.statusLoja || 'aberta', lojistaData.statusMessage || '');

            // Listeners em tempo real
            unsubscribeStatusLoja = Core.db.collection('lojistas').doc(currentLojistaId).onSnapshot(function(doc) {
                if (doc.exists) {
                    var data = doc.data();
                    atualizarStatusLojaUI(data.statusLoja || 'aberta', data.statusMessage || '');
                }
            });

            unsubscribeCardapio = Core.db.collection('lojistas').doc(currentLojistaId).collection('cardapio')
                .onSnapshot(function(snapCardapio) {
                    var produtos = [];
                    snapCardapio.forEach(function(doc) {
                        var data = doc.data();
                        if (data.disponivel !== 'nao') {
                            var imagens = normalizarImagens(data.imagens);
                            var variacoesNormalizadas = Array.isArray(data.variacoes) ? data.variacoes.map(function(variacao) {
                                var copia = {};
                                for (var campo in variacao) copia[campo] = variacao[campo];
                                var imagensVariacao = obterImagensVariacao(variacao);
                                copia.imagens = imagensVariacao;
                                copia.imagem = copia.imagem || imagensVariacao[0] || '';
                                return copia;
                            }) : [];
                            var imagemPrincipal = data.imagem || imagens[0] || null;
                            if (!imagemPrincipal) {
                                for (var indiceImagem = 0; indiceImagem < variacoesNormalizadas.length; indiceImagem++) {
                                    var imagensDaVariacao = obterImagensVariacao(variacoesNormalizadas[indiceImagem]);
                                    if (imagensDaVariacao.length > 0) {
                                        imagemPrincipal = imagensDaVariacao[0];
                                        break;
                                    }
                                }
                            }

                            var prod = {
                                id: doc.id,
                                nome: data.nome,
                                preco: parseFloat(data.preco) || 0,
                                imagem: imagemPrincipal,
                                descricao: data.descricao || '',
                                estoque: data.estoque !== undefined && data.estoque !== '' ? parseInt(data.estoque) : null,
                                categoria: data.categoria || 'Geral',
                                tipo: data.tipo || 'simples',
                                atributos: data.atributos || [],
                                variacoes: variacoesNormalizadas,
                                imagens: imagens
                            };

                            if (prod.tipo === 'variavel' && prod.variacoes.length > 0) {
                                prod.variacoes = prod.variacoes.map(function(v) {
                                    if (!v.sku) {
                                        var skuParts = [];
                                        for (var attr in v.atributos) {
                                            skuParts.push(v.atributos[attr].substring(0, 3).toUpperCase());
                                        }
                                        v.sku = prod.id.substring(0, 4) + '-' + skuParts.join('-');
                                    }
                                    return v;
                                });
                            }
                            produtos.push(prod);
                        }
                    });
                    produtosCache = produtos;
                    var container = document.getElementById('produtosContainer');
                    if (container) {
                        container.innerHTML = renderizarProdutosLoja(produtos);
                    }
                });

            unsubscribeFretes = Core.db.collection('lojistas').doc(currentLojistaId).collection('fretes')
                .onSnapshot(function(snapFretes) {
                    var fretes = [];
                    snapFretes.forEach(function(doc) {
                        fretes.push({
                            localidade: doc.data().localidade,
                            taxa: parseFloat(doc.data().taxa) || 0
                        });
                    });
                    fretesCache = fretes;
                    var select = document.getElementById('selectFreteLoja');
                    if (select) {
                        select.innerHTML = '<option value="">Selecione o frete</option>' +
                            fretes.map(function(f) {
                                return '<option value="' + f.taxa + '">' + f.localidade + ' - R$ ' + f.taxa.toFixed(2) + '</option>';
                            }).join('') +
                            (fretes.length === 0 ? '<option value="0">Retirada no local - Grátis</option>' : '');
                    }
                });

            // Construir HTML do modal
            var logoHtml = logoEstab ? '<img src="' + Core.sanitize(logoEstab) + '" alt="Logo de ' + Core.sanitize(nomeEstab) + '" loading="eager" referrerpolicy="no-referrer">' : '<span aria-hidden="true">🛍️</span>';
            var modalHtml = '<div class="modal-overlay" id="modalLoja" style="display:flex;" role="dialog" aria-modal="true" aria-labelledby="modalLojaTitulo">' +
                '<div class="modal-conteudo fullscreen">' +
                '<div class="modal-header"><div class="modal-estabelecimento-brand"><div class="modal-estabelecimento-logo">' + logoHtml + '</div><div class="modal-estabelecimento-meta"><h3 id="modalLojaTitulo">' + Core.sanitize(nomeEstab) + '</h3><span id="statusLojaBadgeLoja" class="modal-estabelecimento-status status-aberta">Aceitando pedidos</span></div></div>' +
                '<button class="btn-modal-fechar" onclick="fecharModalLoja()" aria-label="Fechar loja">✕</button></div>' +
                '<div class="modal-tabs">' +
                '<button class="modal-tab active" data-tab="produtos">📦 Produtos</button>' +
                '<button class="modal-tab" data-tab="carrinho">🛒 Carrinho <span class="cart-tab-badge" id="cartBadgeLoja" style="display:none;">0</span></button>' +
                '<button class="modal-tab" data-tab="acompanhar">🔍 Acompanhar</button>' +
                (Core.getCurrentUser() ? '<button class="modal-tab" data-tab="historico">📋 Histórico</button>' : '') +
                '</div>' +
                '<div class="modal-body">' +
                '<div id="tabProdutos" class="modal-tab-content active">' +
                '<div id="statusLojaMsgLoja" style="display:none; background:#fef3c7; border:1px solid #f59e0b; border-radius:0.75rem; padding:0.75rem; margin-bottom:0.75rem; text-align:center; font-weight:600; color:#92400e;" role="alert"></div>' +
                '<div id="produtosContainer">Carregando produtos...</div>' +
                '</div>' +
                '<div id="tabCarrinho" class="modal-tab-content">' +
                '<div class="carrinho-layout">' +
                '<div class="carrinho-col-esquerda" id="carrinhoLista"><p style="text-align:center;padding:1rem;">Carrinho vazio</p></div>' +
                '<div class="carrinho-col-direita">' +
                '<strong>Resumo do pedido</strong>' +
                '<div>Subtotal: R$ <span id="carrinhoSubtotal">0.00</span></div>' +
                '<select id="selectFreteLoja" class="input-pedido" onchange="recalcularTotalLoja()" aria-label="Selecione o frete"><option value="">Selecione o frete</option></select>' +
                '<div style="display:flex; gap:0.5rem; margin:0.5rem 0;">' +
                '<input type="text" id="cupomLoja" class="input-pedido" style="margin:0;flex:1;" placeholder="Código do cupom" aria-label="Código do cupom">' +
                '<button class="btn-aplicar-cupom" onclick="aplicarCupomLoja()">Aplicar</button>' +
                '</div>' +
                '<div id="cupomLojaStatus" style="font-size:0.75rem; margin-bottom:0.5rem;"></div>' +
                '<div><strong>Total: R$ <span id="totalLoja" class="total-loja">0.00</span></strong></div>' +
                '<div style="margin:0.75rem 0;"></div>' +
                '<strong>Pagamento</strong>' +
                '<select id="formaPagamentoLoja" class="input-pedido" onchange="toggleTrocoLoja()" aria-label="Forma de pagamento">' +
                '<option value="Dinheiro">Dinheiro</option><option value="Cartão na entrega">Cartão na entrega</option><option value="Pix">Pix</option></select>' +
                '<div id="trocoParaWrapperLoja" style="display:block;"><input type="number" id="trocoParaLoja" class="input-pedido" placeholder="Troco para quanto?" aria-label="Troco para quanto"><label class="sem-troco-label"><input type="checkbox" id="semTrocoCheckboxLoja"> Não preciso de troco</label></div>' +
                '<div class="cliente-info">' +
                '<div class="form-row">' +
                '<input type="text" id="clienteNomeLoja" class="input-pedido" placeholder="Seu nome*" value="' + (Core.getUserDisplayName() || '') + '" aria-label="Seu nome" required>' +
                '<input type="tel" id="clienteTelLoja" class="input-pedido" placeholder="Telefone*" maxlength="15" aria-label="Telefone" required>' +
                '</div>' +
                '<input type="text" id="enderecoLoja" class="input-pedido" placeholder="Endereço completo*" aria-label="Endereço completo" required>' +
                '<textarea id="obsLoja" rows="2" class="input-pedido" placeholder="Observações (ex: portão azul, apartamento 101)" aria-label="Observações do pedido"></textarea>' +
                '<button class="btn-pedido-cta" id="btnFinalizarCompra" onclick="finalizarPedidoLoja()">Confirmar Pedido</button>' +
                '</div></div></div></div>' +
                '<div id="tabAcompanhar" class="modal-tab-content">' +
                '<input type="text" id="consultaRastreio" class="input-pedido" placeholder="Código do pedido" aria-label="Código do pedido">' +
                '<div style="display:flex; gap:0.5rem;">' +
                '<button class="btn-consultar-pedido" onclick="consultarPedidoRastreio()" style="flex:1;">Consultar</button>' +
                '<button class="btn-limpar-historico" onclick="document.getElementById(\'consultaRastreio\').value=\'\'; document.getElementById(\'resultadoRastreio\').innerHTML=\'\';">Limpar</button>' +
                '</div>' +
                '<div id="resultadoRastreio" style="margin-top:1rem;"></div>' +
                '</div>' +
                (Core.getCurrentUser() ? '<div id="tabHistorico" class="modal-tab-content"><div id="listaHistoricoLoja"></div></div>' : '') +
                '</div></div></div>';

            document.body.insertAdjacentHTML('beforeend', modalHtml);
            atualizarStatusLojaUI(lojistaData.statusLoja || 'aberta', lojistaData.statusMessage || '');

            // Pré-preencher dados do cliente
            var saved = carregarDadosClienteLocal();
            if (saved) {
                if (saved.nome && document.getElementById('clienteNomeLoja')) {
                    document.getElementById('clienteNomeLoja').value = saved.nome;
                }
                if (saved.telefone && document.getElementById('clienteTelLoja')) {
                    document.getElementById('clienteTelLoja').value = saved.telefone;
                }
                if (saved.endereco && document.getElementById('enderecoLoja')) {
                    document.getElementById('enderecoLoja').value = saved.endereco;
                }
            }

            // Máscara de telefone
            var telInput = document.getElementById('clienteTelLoja');
            if (telInput) {
                telInput.addEventListener('input', function() {
                    var value = this.value.replace(/\D/g, '');
                    if (value.length > 11) value = value.slice(0, 11);
                    var formatted = '';
                    if (value.length > 0) {
                        formatted = '(' + value.slice(0, 2);
                        if (value.length > 2) formatted += ') ' + value.slice(2, 7);
                        if (value.length > 7) formatted += '-' + value.slice(7, 11);
                    }
                    this.value = formatted;
                });
            }

            // Configurar abas
            document.querySelectorAll('#modalLoja .modal-tab').forEach(function(tab) {
                tab.onclick = function() {
                    document.querySelectorAll('#modalLoja .modal-tab').forEach(function(t) {
                        t.classList.remove('active');
                    });
                    tab.classList.add('active');
                    document.querySelectorAll('#modalLoja .modal-tab-content').forEach(function(c) {
                        c.classList.remove('active');
                    });
                    var tabId = tab.dataset.tab;
                    var contentId = 'tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1);
                    document.getElementById(contentId).classList.add('active');
                    if (tabId === 'historico' && Core.getCurrentUser()) {
                        carregarHistoricoLoja(estId);
                    }
                    if (tabId === 'acompanhar') {
                        var resDiv = document.getElementById('resultadoRastreio');
                        if (resDiv && resDiv.innerHTML.trim() === '') resDiv.innerHTML = '';
                    }
                };
            });

            // Inicializar carrinho e toggles
            toggleTrocoLoja();
            atualizarCarrinhoLoja();

            // Expor funções para uso inline
            window.adicionarAoCarrinhoLoja = adicionarAoCarrinhoLoja;
            window.removerDoCarrinhoLoja = removerDoCarrinhoLoja;
            window.alterarQuantidadeLoja = alterarQuantidadeLoja;
            window.recalcularTotalLoja = recalcularTotalLoja;
            window.aplicarCupomLoja = aplicarCupomLoja;
            window.toggleTrocoLoja = toggleTrocoLoja;
            window.finalizarPedidoLoja = finalizarPedidoLoja;
            window.consultarPedidoRastreio = consultarPedidoRastreio;
            window.fecharModalLoja = window.fecharModalLoja;
            window.gerarComprovanteLoja = gerarComprovanteLoja;

            // ===== EVENT DELEGATION PARA TODOS OS BOTÕES =====
            var produtosContainer = document.getElementById('produtosContainer');
            if (produtosContainer) {
                produtosContainer.addEventListener('click', function(e) {
                    // Botões de quantidade (qtd-btn-simples)
                    var qtdBtn = e.target.closest('.qtd-btn-simples');
                    if (qtdBtn) {
                        var prodId = qtdBtn.dataset.prodId;
                        var delta = parseInt(qtdBtn.dataset.delta);
                        var input = document.getElementById('qtd_simples_' + prodId);
                        if (input) {
                            var val = parseInt(input.value) || 1;
                            val = Math.max(1, val + delta);
                            input.value = val;
                        }
                        return;
                    }

                    // Botão "Escolher" (variações)
                    var btnEscolher = e.target.closest('.btn-escolher');
                    if (btnEscolher) {
                        var prodId = btnEscolher.dataset.prodId;
                        var produto = produtosCache.find(function(p) { return p.id === prodId; });
                        if (produto && produto.tipo === 'variavel') {
                            abrirModalVariacoes(produto);
                        }
                        return;
                    }

                    // Botão "Adicionar" (produtos simples)
                    var btnAdicionar = e.target.closest('.btn-adicionar-simples');
                    if (btnAdicionar) {
                        var prodId = btnAdicionar.dataset.prodId;
                        adicionarAoCarrinhoLoja(prodId);
                    }
                });
            }

            UI.trapFocus(document.getElementById('modalLoja'));

            // Fechar com ESC
            document.addEventListener('keydown', function escHandler(e) {
                if (e.key === 'Escape') {
                    var modal = document.getElementById('modalLoja');
                    if (modal && modal.style.display !== 'none') {
                        fecharModalLoja();
                        document.removeEventListener('keydown', escHandler);
                    }
                }
            });

        })
        .catch(function(err) {
            UI.mostrarToast('Erro ao carregar dados: ' + err.message, 'erro');
        });
};
    // ============================================================
})();
