/*
 * economizei-loja.js
 * Módulo frontend público da Loja.
 * Carregar depois de economizei-core.js e antes da interação da página.
 * Não embute core, shell Blogger ou módulo Pedidos.
 */
(function() {
    'use strict';
    if (!window.Economizei) window.Economizei = {};

    // ============================================================
    // IDENTIDADE VISUAL COMPARTILHADA COM ONDE COMER/PEDIDOS
    // O módulo continua externo e injeta somente a camada visual do
    // próprio modal. O shell Blogger permanece na página hospedeira.
    // ============================================================
    function instalarEstiloVisualLoja() {
        if (document.getElementById('economizei-loja-visual-compartilhado')) return;
        var style = document.createElement('style');
        style.id = 'economizei-loja-visual-compartilhado';
        style.textContent = `
            #modalLoja.loja-padronizada > .modal-conteudo.fullscreen {
                width:100%; height:100%; max-width:100%; max-height:100%;
                margin:0; border-radius:0; overflow:hidden;
            }
            #modalLoja.loja-padronizada .modal-header {
                padding:.75rem 1rem;
                border-bottom:1px solid var(--gray-200);
                display:flex; justify-content:space-between; align-items:center;
                background:#fff;
            }
            #modalLoja.loja-padronizada .modal-estabelecimento-brand {
                display:flex; align-items:center; justify-content:flex-start; gap:.55rem;
                min-width:0; flex:1; text-align:left;
            }
            #modalLoja.loja-padronizada .modal-estabelecimento-logo {
                width:42px; height:42px; min-width:42px; flex:0 0 42px;
                border-radius:50%; overflow:hidden;
                background:var(--primary-light); border:2px solid var(--primary);
                display:flex; align-items:center; justify-content:center;
                color:var(--primary); font-size:.9rem; font-weight:800;
            }
            #modalLoja.loja-padronizada .modal-estabelecimento-logo img {
                width:100%; height:100%; object-fit:cover; display:block;
            }
            #modalLoja.loja-padronizada .modal-estabelecimento-meta {
                min-width:0; display:flex; flex-direction:column; gap:.1rem;
            }
            #modalLoja.loja-padronizada .modal-estabelecimento-meta h3 {
                margin:0; color:var(--gray-800); font-size:1rem; line-height:1.2;
                white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
            }
            #modalLoja.loja-padronizada .modal-estabelecimento-status {
                display:inline-flex; align-items:center; gap:.3rem;
                font-size:.7rem; font-weight:700; color:var(--gray-500);
            }
            #modalLoja.loja-padronizada .modal-estabelecimento-status::before {
                content:""; width:7px; height:7px; border-radius:50%; background:#94a3b8;
            }
            #modalLoja.loja-padronizada .modal-estabelecimento-status.status-aberta { color:#15803d; }
            #modalLoja.loja-padronizada .modal-estabelecimento-status.status-aberta::before { background:#22c55e; }
            #modalLoja.loja-padronizada .modal-estabelecimento-status.status-pausada { color:#b45309; }
            #modalLoja.loja-padronizada .modal-estabelecimento-status.status-pausada::before { background:#f59e0b; }
            #modalLoja.loja-padronizada .modal-estabelecimento-status.status-fechada { color:#b91c1c; }
            #modalLoja.loja-padronizada .modal-estabelecimento-status.status-fechada::before { background:#ef4444; }
            #modalLoja.loja-padronizada .modal-header > .btn-modal-fechar {
                width:2.25rem; height:2.25rem; min-width:2.25rem; padding:0;
                margin-left:auto; border-radius:50%; display:inline-flex;
                align-items:center; justify-content:center; font-size:0; line-height:1;
            }
            #modalLoja.loja-padronizada .modal-header > .btn-modal-fechar::before {
                content:"\\00D7"; font-size:1.45rem; font-weight:500;
            }
            #modalLoja.loja-padronizada .modal-tabs {
                display:flex; background:var(--gray-100); border-radius:3rem;
                margin:0 .5rem .5rem; padding:.2rem;
            }
            #modalLoja.loja-padronizada .modal-tab {
                flex:1; min-height:2rem; padding:.4rem; border:none; background:none;
                color:var(--gray-700); font-weight:700; border-radius:2rem;
                cursor:pointer; transition:var(--transition); font-size:.8rem;
            }
            #modalLoja.loja-padronizada .modal-tab.active {
                background:#fff; color:var(--primary); box-shadow:0 1px 3px rgba(0,0,0,.1);
            }
            #modalLoja.loja-padronizada .modal-body {
                padding:.75rem; overflow-y:auto; flex:1; min-height:0;
            }
            #modalLoja.loja-padronizada #statusLojaMsgLoja {
                display:flex; align-items:center; justify-content:center; gap:.35rem;
                min-height:2.8rem; box-sizing:border-box;
                border-radius:.75rem!important; padding:.65rem .75rem!important;
                margin-bottom:.75rem!important; text-align:center!important;
                font-weight:600!important;
            }
            #modalLoja.loja-padronizada #statusLojaMsgLoja.status-aberta {
                background:#f0fdf4!important; border-color:#86efac!important; color:#166534!important;
            }
            #modalLoja.loja-padronizada #statusLojaMsgLoja.status-pausada {
                background:#fffbeb!important; border-color:#fcd34d!important; color:#92400e!important;
            }
            #modalLoja.loja-padronizada #statusLojaMsgLoja.status-fechada {
                background:#fef2f2!important; border-color:#fca5a5!important; color:#991b1b!important;
            }
            #modalLoja.loja-padronizada .modal-status-label {
                display:inline-flex; align-items:center; gap:.35rem;
                margin:0; font-size:.8rem; text-transform:none; font-weight:700;
                white-space:nowrap;
            }
            #modalLoja.loja-padronizada .modal-status-label::before {
                content:""; width:8px; height:8px; min-width:8px; border-radius:50%; background:#94a3b8;
            }
            #modalLoja.loja-padronizada #statusLojaMsgLoja.status-aberta .modal-status-label::before { background:#22c55e; }
            #modalLoja.loja-padronizada #statusLojaMsgLoja.status-pausada .modal-status-label::before { background:#f59e0b; }
            #modalLoja.loja-padronizada #statusLojaMsgLoja.status-fechada .modal-status-label::before { background:#ef4444; }
            #modalLoja.loja-padronizada .modal-status-text { display:inline; font-size:.8rem; line-height:1.35; font-weight:650; }
            .popup-confirmacao .popup-confirmacao-close {
                position:static; background:rgba(255,255,255,.18); border-color:rgba(255,255,255,.55); color:#fff;
            }
            .popup-confirmacao .popup-confirmacao-close:hover { background:rgba(255,255,255,.3); color:#fff; }
            #modalLoja.loja-padronizada .categoria-group { margin-bottom:1rem; }
            #modalLoja.loja-padronizada .categoria-titulo-modal {
                font-size:1rem; font-weight:700; color:var(--primary);
                margin:.3rem 0 .5rem; border-left:3px solid var(--primary);
                padding-left:.5rem; cursor:pointer; user-select:none;
            }
            #modalLoja.loja-padronizada .produtos-grid {
                display:grid; grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:.5rem;
            }
            #modalLoja.loja-padronizada .produto-card {
                background:#fff; border:1px solid var(--gray-200);
                border-radius:.75rem; padding:.4rem; text-align:center;
                display:flex; flex-direction:column; height:100%;
            }
            #modalLoja.loja-padronizada .produto-card img {
                width:100%; aspect-ratio:1; object-fit:cover;
                border-radius:.5rem; cursor:pointer;
            }
            #modalLoja.loja-padronizada .card-content-produto {
                flex:1; display:flex; flex-direction:column; min-width:0;
            }
            #modalLoja.loja-padronizada .produto-nome {
                font-weight:600; font-size:.75rem; margin:.2rem 0;
                overflow-wrap:anywhere;
            }
            #modalLoja.loja-padronizada .produto-preco {
                color:var(--primary); font-weight:700; font-size:.8rem;
            }
            #modalLoja.loja-padronizada .btn-escolher,
            #modalLoja.loja-padronizada .btn-adicionar-simples {
                background:var(--primary); color:#fff; border:none; border-radius:2rem;
                padding:.3rem; font-size:.7rem; font-weight:600; cursor:pointer;
                margin-top:auto; width:100%; min-height:2rem;
            }
            #modalLoja.loja-padronizada .btn-escolher:disabled,
            #modalLoja.loja-padronizada .btn-adicionar-simples:disabled {
                background:#94a3b8; cursor:not-allowed;
            }
            #modalLoja.loja-padronizada .carrinho-layout {
                display:flex; flex-wrap:wrap; gap:1rem; align-items:stretch;
            }
            #modalLoja.loja-padronizada .carrinho-col-esquerda {
                flex:2; min-width:200px; background:#fff; border-radius:1rem;
                padding:.5rem; border:1px solid var(--gray-200);
            }
            #modalLoja.loja-padronizada .carrinho-col-direita {
                flex:1; min-width:180px; background:var(--gray-100);
                border-radius:1rem; padding:.75rem; align-self:stretch;
            }
            #modalLoja.loja-padronizada .cliente-info {
                background:#fff; border-radius:1rem; padding:.5rem;
                border:1px solid var(--gray-200); margin-top:.5rem;
            }
            #modalLoja.loja-padronizada .total-loja { font-size:1rem; font-weight:700; color:var(--primary); }
            #modalLoja.loja-padronizada .btn-pedido-cta {
                background:var(--primary); color:#fff; border:none; padding:.75rem;
                border-radius:2rem; font-weight:600; width:100%; cursor:pointer;
                font-size:.9rem; transition:var(--transition);
            }
            #modalLoja.loja-padronizada .btn-pedido-cta:hover { background:var(--primary-dark); }
            #modalLoja.loja-padronizada .btn-pedido-cta:disabled {
                background:#94a3b8; cursor:not-allowed;
            }
            #modalLoja.loja-padronizada .sem-troco-label {
                display:flex; align-items:center; gap:.5rem; width:100%;
                margin:.4rem 0 .55rem; padding:.55rem .65rem; border:1px solid #cbd5e1;
                border-radius:.65rem; background:#f8fafc; color:#334155; font-size:.78rem;
                font-weight:600; line-height:1.3; cursor:pointer;
            }
            #modalLoja.loja-padronizada .sem-troco-label:hover { border-color:var(--primary); background:#eff6ff; }
            #modalLoja.loja-padronizada .sem-troco-label input[type="checkbox"] {
                width:1.1rem; height:1.1rem; margin:0; flex:0 0 auto; accent-color:var(--primary); cursor:pointer;
            }
            #modalLoja.loja-padronizada .sem-troco-label input[type="checkbox"]:focus-visible {
                outline:2px solid var(--primary); outline-offset:2px;
            }
            #modalLoja.loja-padronizada .sem-troco-label:has(input:checked) {
                border-color:#22c55e; background:#f0fdf4; color:#166534;
            }
            #modalLoja.loja-padronizada .cart-tab-badge {
                display:inline-flex; align-items:center; justify-content:center;
                background:#ef4444; color:#fff; font-size:.6rem; font-weight:700;
                border-radius:9999px; min-width:1rem; height:1rem; padding:0 .3rem;
                margin-left:.3rem; vertical-align:middle;
            }
            html.modo-app-inicial, body.modo-app {
                --reserva-barra-app:max(130px,env(safe-area-inset-bottom,0px));
            }
            html.modo-app-inicial #modalLoja.loja-padronizada > .modal-conteudo.fullscreen,
            body.modo-app #modalLoja.loja-padronizada > .modal-conteudo.fullscreen {
                height:calc(100dvh - var(--reserva-barra-app));
                max-height:calc(100dvh - var(--reserva-barra-app));
                margin:0;
            }
            html.modo-app-inicial #modalLoja.loja-padronizada .modal-body,
            body.modo-app #modalLoja.loja-padronizada .modal-body {
                padding-bottom:max(.75rem,var(--reserva-barra-app))!important;
            }
            html.modo-app-inicial #modalLoja.loja-padronizada .modal-config-footer,
            body.modo-app #modalLoja.loja-padronizada .modal-config-footer {
                padding-bottom:max(1rem,var(--reserva-barra-app),env(safe-area-inset-bottom))!important;
            }
            .modal-imagem-full.loja-padronizada .container-imagem {
                box-sizing:border-box;
                padding-bottom:max(1rem,var(--reserva-barra-app,0px),env(safe-area-inset-bottom))!important;
            }
            .modal-imagem-full.loja-padronizada .lado-direito {
                display:grid!important;
                grid-template-columns:minmax(2rem,auto) minmax(3rem,5rem) minmax(2rem,auto) minmax(150px,1fr)!important;
                align-content:start!important; align-items:center!important;
                justify-content:stretch!important; gap:.75rem!important;
                overflow-y:auto!important;
                padding-bottom:max(1rem,var(--reserva-barra-app,0px),env(safe-area-inset-bottom))!important;
            }
            .modal-imagem-full.loja-padronizada .lado-direito > .produto-nome,
            .modal-imagem-full.loja-padronizada .lado-direito > .tamanho-botoes-modal,
            .modal-imagem-full.loja-padronizada .lado-direito > .preco,
            .modal-imagem-full.loja-padronizada .lado-direito > .descricao {
                grid-column:1/-1;
            }
            .modal-imagem-full.loja-padronizada .lado-direito > .produto-quantidade-simples {
                grid-column:1/4; justify-content:flex-start!important; margin:0!important;
            }
            .modal-imagem-full.loja-padronizada .lado-direito > #addImagem {
                grid-column:4; width:100%!important; margin:0!important;
            }
            @media (max-width:768px) {
                #modalLoja.loja-padronizada .modal-header { padding:.65rem .75rem; }
                #modalLoja.loja-padronizada .modal-estabelecimento-logo { width:38px; height:38px; min-width:38px; flex-basis:38px; }
                #modalLoja.loja-padronizada .modal-estabelecimento-meta h3 { font-size:.9rem; }
                #modalLoja.loja-padronizada .modal-estabelecimento-status { font-size:.65rem; }
                #modalLoja.loja-padronizada .modal-tabs { margin:0 .25rem .35rem; }
                #modalLoja.loja-padronizada .modal-tab { min-height:2rem; padding:.3rem; font-size:.7rem; }
                #modalLoja.loja-padronizada .modal-body { padding:.6rem; }
                #modalLoja.loja-padronizada .produtos-grid { grid-template-columns:repeat(auto-fill,minmax(120px,1fr)); gap:.4rem; }
                #modalLoja.loja-padronizada .carrinho-layout { gap:.6rem; }
                #modalLoja.loja-padronizada .carrinho-col-esquerda,
                #modalLoja.loja-padronizada .carrinho-col-direita { min-width:100%; }
                #modalLoja.loja-padronizada .modal-header > .btn-modal-fechar { width:2rem; height:2rem; min-width:2rem; }
            }
            @media (max-width:700px) {
                .modal-imagem-full.loja-padronizada .container-imagem {
                    flex-direction:column!important; align-items:stretch!important;
                }
                .modal-imagem-full.loja-padronizada .lado-esquerdo {
                    height:46vh!important; min-height:180px; flex:0 0 46vh!important; padding:.5rem!important;
                }
                .modal-imagem-full.loja-padronizada .lado-direito {
                    display:flex!important; flex-direction:column!important; min-width:0;
                    width:100%; height:auto; flex:1 1 auto; gap:.5rem; padding:.75rem!important;
                }
                .modal-imagem-full.loja-padronizada .lado-direito > .produto-quantidade-simples {
                    width:100%; justify-content:center!important; grid-column:auto;
                }
                .modal-imagem-full.loja-padronizada .lado-direito > #addImagem {
                    width:100%!important; margin-top:.25rem!important; grid-column:auto;
                }
            }
            @media (pointer:coarse) {
                #modalLoja.loja-padronizada .modal-tab,
                #modalLoja.loja-padronizada .btn-escolher,
                #modalLoja.loja-padronizada .btn-adicionar-simples,
                #modalLoja.loja-padronizada .btn-pedido-cta,
                #modalLoja.loja-padronizada .btn-modal-fechar { min-height:44px; }
                #modalLoja.loja-padronizada .modal-header > .btn-modal-fechar { min-height:44px; min-width:44px; }
            }

            /* Identificação do módulo no card público */
            .badge-modulo-slot {
                height:1.9rem; min-height:1.9rem; flex:0 0 1.9rem;
                display:flex; align-items:center; justify-content:center;
                margin:0 0 .1rem; overflow:visible;
            }
            .badge-modulo-slot .badge-modulo-card { margin:0; }
            .badge-modulo-card {
                position:relative; display:inline-flex; align-items:center; justify-content:center;
                gap:.35rem; margin:.15rem auto .35rem; max-width:100%;
                padding:.28rem .7rem; border:1px solid #bfdbfe; border-radius:999px;
                background:#eff6ff; color:#1d4ed8; font:600 .68rem/1.2 system-ui,sans-serif;
                cursor:help; white-space:nowrap; text-align:center; transition:all .18s ease;
            }
            .badge-modulo-card:hover, .badge-modulo-card:focus-visible,
            .badge-modulo-card.tooltip-aberto {
                background:#dbeafe; border-color:#60a5fa; color:#1e40af;
                box-shadow:0 0 0 3px rgba(59,130,246,.13); outline:none;
            }
            .badge-modulo-card i { font-size:.7rem; }
            .tooltip-modulo-flutuante {
                position:fixed; z-index:30000; width:min(300px,calc(100vw - 1rem));
                padding:.65rem .75rem; border:1px solid rgba(15,23,42,.22); border-radius:.65rem;
                background:#0f172a; color:#fff; box-shadow:0 10px 24px rgba(15,23,42,.24);
                font:500 .76rem/1.4 system-ui,sans-serif; text-align:left; pointer-events:none;
                opacity:0; transform:translateY(3px); transition:opacity .14s ease,transform .14s ease;
            }
            .tooltip-modulo-flutuante.visivel { opacity:1; transform:translateY(0); }
            @media(max-width:640px) {
                .badge-modulo-card { font-size:.65rem; padding:.3rem .6rem; }
                .tooltip-modulo-flutuante { font-size:.78rem; padding:.7rem .8rem; }
            }
        `;
        document.head.appendChild(style);
    }
    instalarEstiloVisualLoja();

    // ===== IDENTIFICAÇÃO DO MÓDULO NOS CARDS PÚBLICOS =====
    function instalarIdentificacaoModulosCards() {
        if (window.__economizeiIdentificacaoModulosCards) return;
        window.__economizeiIdentificacaoModulosCards = true;

        var configuracoes = {
            pedidos: { label: 'Módulo Pedidos', icone: 'fa-utensils', descricao: 'Este cadastro permite fazer pedidos online.' },
            loja: { label: 'Módulo Loja', icone: 'fa-store', descricao: 'Este estabelecimento oferece uma vitrine digital para você comprar online.' },
            transporte: { label: 'Módulo Transporte', icone: 'fa-taxi', descricao: 'Este cadastro permite solicitar corridas/fretes online.' },
            orcamentos: { label: 'Módulo Orçamentos', icone: 'fa-file-invoice-dollar', descricao: 'Este cadastro permite solicitar orçamentos online.' },
            agendamentos: { label: 'Módulo Agendamentos', icone: 'fa-calendar-check', descricao: 'Este cadastro permite realizar agendamentos online.' },
            hospedagem: { label: 'Módulo Hospedagem', icone: 'fa-bed', descricao: 'Este cadastro permite fazer reservas de hospedagem online.' }
        };
        var tooltipAberto = null;

        function normalizar(valor) {
            return String(valor || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        }

        function obterModulo(card) {
            var estilo = normalizar(card.dataset.estilo);
            var aliases = {
                pedido: 'pedidos', pedidos: 'pedidos',
                loja: 'loja', 'loja online': 'loja', ecommerce: 'loja',
                transporte: 'transporte', taxi: 'transporte', taxis: 'transporte',
                orcamento: 'orcamentos', orcamentos: 'orcamentos',
                agendamento: 'agendamentos', agendamentos: 'agendamentos',
                hospedagem: 'hospedagem'
            };
            if (aliases[estilo]) return aliases[estilo];

            return '';
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
            var botao = tooltipAberto.botao;
            var tooltip = tooltipAberto.elemento;
            var rect = botao.getBoundingClientRect();
            var margem = 8;
            var largura = tooltip.offsetWidth;
            var esquerda = rect.left + (rect.width / 2) - (largura / 2);
            esquerda = Math.max(margem, Math.min(esquerda, window.innerWidth - largura - margem));
            var topo = rect.top - tooltip.offsetHeight - margem;
            if (topo < margem) topo = rect.bottom + margem;
            tooltip.style.left = esquerda + 'px';
            tooltip.style.top = Math.max(margem, topo) + 'px';
        }

        function abrirTooltip(botao, modulo) {
            fecharTooltip();
            var meta = configuracoes[modulo];
            if (!meta) return;
            var tooltip = document.createElement('div');
            tooltip.className = 'tooltip-modulo-flutuante';
            tooltip.id = 'tooltip-' + modulo + '-' + Date.now();
            tooltip.setAttribute('role', 'tooltip');
            tooltip.textContent = meta.descricao;
            document.body.appendChild(tooltip);
            botao.classList.add('tooltip-aberto');
            botao.setAttribute('aria-expanded', 'true');
            tooltipAberto = { botao: botao, elemento: tooltip };
            botao.setAttribute('aria-describedby', tooltip.id);
            posicionarTooltip();
            requestAnimationFrame(function() { if (tooltipAberto && tooltipAberto.elemento === tooltip) tooltip.classList.add('visivel'); });
        }

        function vincularBotao(botao, modulo) {
            botao.addEventListener('mouseenter', function() { abrirTooltip(botao, modulo); });
            botao.addEventListener('mouseleave', fecharTooltip);
            botao.addEventListener('focus', function() { abrirTooltip(botao, modulo); });
            botao.addEventListener('blur', fecharTooltip);
            botao.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                abrirTooltip(botao, modulo);
            });
            botao.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') event.stopPropagation();
            });
        }

        function renderizarSelos() {
            document.querySelectorAll('.card').forEach(function(card) {
                var content = card.querySelector('.card-content');
                if (!content) return;
                var slot = content.querySelector('.badge-modulo-slot');
                if (!slot) {
                    slot = document.createElement('div');
                    slot.className = 'badge-modulo-slot';
                    slot.setAttribute('aria-hidden', 'true');
                    var tituloInicial = content.querySelector('.card-title');
                    if (tituloInicial) content.insertBefore(slot, tituloInicial);
                    else content.appendChild(slot);
                }
                var modulo = obterModulo(card);
                var existente = slot.querySelector('.badge-modulo-card') || content.querySelector('.badge-modulo-card');
                if (existente && existente.parentNode !== slot) slot.appendChild(existente);
                if (!modulo) {
                    if (existente) existente.remove();
                    return;
                }
                if (existente && existente.dataset.modulo === modulo) return;
                if (existente) existente.remove();
                var meta = configuracoes[modulo];
                var ariaAtual = card.getAttribute('aria-label') || '';
                if (ariaAtual.indexOf(meta.label) === -1) card.setAttribute('aria-label', ariaAtual + ', ' + meta.label);
                var botao = document.createElement('button');
                botao.type = 'button';
                botao.className = 'badge-modulo-card';
                botao.dataset.modulo = modulo;
                botao.title = meta.descricao;
                botao.setAttribute('aria-label', meta.label + '. Clique para saber mais.');
                botao.setAttribute('aria-expanded', 'false');
                botao.innerHTML = '<i class="fas ' + meta.icone + '" aria-hidden="true"></i><span>' + meta.label + '</span>';
                slot.appendChild(botao);
                vincularBotao(botao, modulo);
            });
        }

        document.addEventListener('click', function(event) {
            if (!event.target.closest('.badge-modulo-card')) fecharTooltip();
        }, true);
        document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') fecharTooltip();
        }, true);
        window.addEventListener('resize', fecharTooltip);
        window.addEventListener('scroll', fecharTooltip, true);
        var lista = document.getElementById('lista') || document.body;
        if (window.MutationObserver) {
            var observer = new MutationObserver(renderizarSelos);
            observer.observe(lista, { childList: true, subtree: true });
        }
        renderizarSelos();
    }
    instalarIdentificacaoModulosCards();

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
    var cupomAtual = null;
    var promocoesCache = [];
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

    function estoqueSemLimite(valor) {
        return valor === undefined || valor === null || String(valor).trim() === '';
    }

    function obterEstoqueNumerico(valor) {
        if (estoqueSemLimite(valor)) return null;
        var numero = parseInt(valor, 10);
        return Number.isFinite(numero) ? numero : null;
    }

    function estoqueDisponivelParaQuantidade(valor, quantidade) {
        var estoque = obterEstoqueNumerico(valor);
        return estoque === null || quantidade <= estoque;
    }

    function textoEstoqueDisponivel(valor) {
        var estoque = obterEstoqueNumerico(valor);
        return estoque === null ? 'Ilimitado' : String(estoque);
    }

    // A identidade visual do modal deve vir do cadastro correspondente em
    // lojistas, como no módulo Pedidos. O campo principal é logoUrl;
    // os demais nomes mantêm compatibilidade com cadastros antigos.
    function obterLogoDoCadastroLoja(data) {
        var candidatos = [data && data.logoUrl, data && data.logo, data && data.imagemLogo, data && data.imagem];
        for (var i = 0; i < candidatos.length; i++) {
            if (typeof candidatos[i] === 'string' && /^https?:\/\//i.test(candidatos[i].trim())) {
                return candidatos[i].trim();
            }
        }
        return '';
    }

    function gerarIniciaisLoja(nome) {
        var partes = String(nome || 'Loja').trim().split(/\s+/).filter(Boolean);
        return (partes.slice(0, 2).map(function(p) { return p.charAt(0); }).join('') || 'L').toUpperCase();
    }

    function obterImagensBaseProduto(produto) {
        if (produto && produto.__imagemFallbackVariacao) return normalizarImagens(produto.imagens);
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
        return obterGaleriaProduto(produto).map(function(item) { return item.url; });
    }

    function obterGaleriaProduto(produto) {
        var galeria = [];
        var urlsVistas = {};
        function adicionar(url, variacao) {
            url = String(url || '').trim();
            if (!url || urlsVistas[url]) return;
            urlsVistas[url] = true;
            galeria.push({ url: url, variacao: variacao || null });
        }
        obterImagensBaseProduto(produto).forEach(function(url) { adicionar(url, null); });
        var variacoes = produto && Array.isArray(produto.variacoes) ? produto.variacoes : [];
        variacoes.forEach(function(variacao) {
            obterImagensVariacao(variacao).forEach(function(url) { adicionar(url, variacao); });
        });
        return galeria;
    }

    function obterImagemPrincipalProduto(produto) {
        var imagensBase = obterImagensBaseProduto(produto);
        if (imagensBase.length > 0) return imagensBase[0];
        var imagensTodas = obterImagensProduto(produto);
        return imagensTodas.length > 0 ? imagensTodas[0] : null;
    }

    // ===== FUNÇÕES AUXILIARES =====

    function gerarComprovanteLoja(pedido, codigoCurto) {
        function numero(valor) {
            var convertido = parseFloat(valor);
            return Number.isFinite(convertido) ? convertido : 0;
        }
        function texto(valor, fallback) {
            var convertido = String(valor === undefined || valor === null ? '' : valor).trim();
            return Core.sanitize(convertido || fallback || '');
        }
        function moeda(valor) { return 'R$ ' + numero(valor).toFixed(2).replace('.', ','); }

        var itens = Array.isArray(pedido.itens) ? pedido.itens : [];
        var itensHTML = itens.length ? '<ul>' + itens.map(function(i) {
            var nomeItem = String(i.nome || 'Item');
            if (i.atributos && typeof i.atributos === 'object') nomeItem += ' (' + Object.keys(i.atributos).map(function(chave) { return chave + ': ' + i.atributos[chave]; }).join(', ') + ')';
            var totalItem = numero(i.precoUnitario) * numero(i.quantidade);
            return '<li><span class="item-quantidade">' + numero(i.quantidade) + 'x</span><span class="item-nome">' + texto(nomeItem, 'Item') + '</span><strong>' + moeda(totalItem) + '</strong></li>';
        }).join('') + '</ul>' : '<p class="vazio">Nenhum item informado.</p>';

        var pagamento = texto(pedido.formaPagamento, 'Não informado');
        if (pagamento === 'Dinheiro' && pedido.trocoPara) pagamento += ' · Troco para ' + moeda(pedido.trocoPara);
        else if (pagamento === 'Dinheiro') pagamento += ' · Não precisa de troco';
        var dataPedido = pedido.criadoEm && typeof pedido.criadoEm.toDate === 'function' ? pedido.criadoEm.toDate() : new Date();
        var dados = '<header class="comprovante-cabecalho"><h1>Comprovante de pedido</h1><p><strong>Pedido #' + texto(codigoCurto, '---') + '</strong><span>' + dataPedido.toLocaleString() + '</span></p></header>' +
            '<section class="info"><div><strong>Estabelecimento</strong><span>' + texto(pedido.estabelecimentoNome, 'Não informado') + '</span></div><div><strong>Cliente</strong><span>' + texto(pedido.clienteNome, 'Não informado') + '</span></div><div><strong>Endereço</strong><span>' + texto(pedido.endereco, 'Não informado') + '</span></div><div><strong>Telefone</strong><span>' + texto(pedido.clienteTelefone, 'Não informado') + '</span></div></section>' +
            '<section class="itens"><h2>Itens do pedido</h2>' + itensHTML + '</section>' +
            '<section class="resumo"><div><span>Subtotal</span><strong>' + moeda(pedido.subtotal) + '</strong></div><div><span>Frete</span><strong>' + moeda(pedido.taxaEntrega) + '</strong></div>' +
            (numero(pedido.descontoPromocoes) > 0 ? '<div class="desconto"><span>Promoções</span><strong>- ' + moeda(pedido.descontoPromocoes) + '</strong></div>' : '') +
            (numero(pedido.descontoAplicado) > 0 ? '<div class="desconto"><span>Cupom</span><strong>- ' + moeda(pedido.descontoAplicado) + '</strong></div>' : '') +
            '<div class="total"><span>Total</span><strong>' + moeda(pedido.total) + '</strong></div></section>' +
            '<section class="detalhes-finais"><p><strong>Pagamento</strong><span>' + pagamento + '</span></p><p><strong>Observação</strong><span>' + texto(pedido.observacao, 'Nenhuma') + '</span></p></section>';

        var conteudo = '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Comprovante de Pedido #' + texto(codigoCurto, '') + '</title><style>' +
            '*{box-sizing:border-box}html{background:#eef2f7}body{font-family:system-ui,-apple-system,"Segoe UI",Arial,sans-serif;margin:0;padding:clamp(.75rem,3vw,2rem);background:#eef2f7;color:#172033;min-width:0}.comprovante{width:100%;max-width:760px;margin:0 auto;background:#fff;border:1px solid #dbe3ee;border-radius:clamp(.75rem,2vw,1.25rem);padding:clamp(1rem,4vw,2rem);box-shadow:0 8px 28px rgba(15,23,42,.1);overflow:hidden}.comprovante-cabecalho{border-bottom:2px solid #e6edf5;padding-bottom:1rem;margin-bottom:1rem}.comprovante-cabecalho h1{margin:0 0 .65rem;color:#0a66c2;font-size:clamp(1.25rem,4vw,1.75rem);line-height:1.2}.comprovante-cabecalho p{display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;margin:0;color:#526174;font-size:clamp(.78rem,2.5vw,.9rem)}.comprovante-cabecalho p strong{color:#172033}.info{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;background:#f7f9fc;border:1px solid #e5ebf3;border-radius:.85rem;padding:clamp(.8rem,3vw,1.1rem);margin-bottom:1.25rem}.info div{min-width:0}.info strong,.detalhes-finais strong{display:block;color:#526174;font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;margin-bottom:.2rem}.info span,.detalhes-finais span{display:block;overflow-wrap:anywhere;font-size:clamp(.82rem,2.5vw,.95rem);line-height:1.4}.itens{margin:0 0 1.25rem}.itens h2{font-size:1rem;margin:0 0 .5rem;color:#172033}.itens ul{list-style:none;padding:0;margin:0;border-top:1px solid #e5ebf3}.itens li{display:grid;grid-template-columns:2.5rem minmax(0,1fr) auto;align-items:start;gap:.5rem;padding:.7rem 0;border-bottom:1px solid #edf1f5;font-size:clamp(.82rem,2.6vw,.95rem)}.item-quantidade{color:#526174;font-weight:700}.item-nome{overflow-wrap:anywhere}.itens li strong{white-space:nowrap;color:#172033}.vazio{color:#64748b;font-size:.9rem}.resumo{border-top:1px solid #dbe3ee;padding-top:.75rem;margin-left:auto;width:min(100%,360px)}.resumo>div{display:flex;justify-content:space-between;gap:1rem;padding:.28rem 0;font-size:clamp(.82rem,2.5vw,.95rem)}.resumo .desconto{color:#15803d}.resumo .total{margin-top:.45rem;padding-top:.65rem;border-top:2px solid #dbe3ee;color:#0a66c2;font-size:clamp(1rem,3.5vw,1.25rem)}.detalhes-finais{display:grid;gap:.75rem;margin-top:1.25rem;padding-top:1rem;border-top:1px solid #e5ebf3}.detalhes-finais p{margin:0}.obrigado{text-align:center;margin:1.5rem 0 0;color:#64748b;font-size:.82rem}@media(max-width:560px){body{padding:.5rem}.comprovante{border-radius:.75rem;padding:1rem}.info{grid-template-columns:1fr;gap:.65rem}.comprovante-cabecalho p{display:block}.comprovante-cabecalho p span{display:block;margin-top:.25rem}.itens li{grid-template-columns:2.25rem minmax(0,1fr);gap:.4rem}.itens li strong{grid-column:2;text-align:right;margin-top:.15rem}.resumo{width:100%}}@media print{html,body{background:#fff}.comprovante{max-width:none;border:0;box-shadow:none;border-radius:0;padding:0}}' +
            '</style></head><body><main class="comprovante">' + dados + '<p class="obrigado">Obrigado pela preferência!</p></main></body></html>';
        var win = window.open('', '_blank');
        if (!win) { UI.mostrarToast('Permita a abertura do comprovante no navegador.', 'erro'); return; }
        win.document.open();
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
            '<div class="popup-confirmacao-header"><h3>' + opcoes.titulo + '</h3><button type="button" class="modal-close-btn popup-confirmacao-close" onclick="this.closest(\'.popup-confirmacao\').remove()" aria-label="Fechar">×</button></div>' +
            '<div class="popup-confirmacao-body"><p>Seu pedido foi enviado com sucesso!</p>' +
            '<div class="popup-confirmacao-codigo"><p class="label">Código</p><p class="valor">#' + opcoes.codigo + '</p>' +
            '<button class="btn-adicionar-filtro" style="background:white;color:var(--primary);border:1px solid var(--primary);padding:0.5rem 1rem;margin-top:0.5rem;" onclick="navigator.clipboard.writeText(\'' + opcoes.codigo + '\').then(()=>alert(\'Código copiado!\'))">📋 Copiar código</button></div>' +
            '<div class="popup-confirmacao-botoes">' + opcoes.botoes + '</div></div>' +
            '<div class="popup-confirmacao-footer"><button class="btn-modal-fechar" onclick="this.closest(\'.popup-confirmacao\').remove(); ' + (opcoes.onClose || '') + '">Fechar</button></div></div>';
        document.body.appendChild(overlay);
        UI.trapFocus(overlay);
    }

    // ===== IMAGEM EM TELA CHEIA =====
    if (!document.getElementById('economizei-loja-image-navigation-style')) {
        var imageNavigationStyle = document.createElement('style');
        imageNavigationStyle.id = 'economizei-loja-image-navigation-style';
        imageNavigationStyle.textContent = '.imagem-navegacao{position:absolute;top:50%;transform:translateY(-50%);z-index:5;width:42px;height:58px;border:1px solid rgba(255,255,255,.35);border-radius:999px;background:rgba(15,23,42,.72);color:#fff;font-size:42px;line-height:42px;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s ease,transform .15s ease}.imagem-navegacao:hover,.imagem-navegacao:focus-visible{background:#0a66c2;outline:2px solid #fff;outline-offset:2px}.imagem-navegacao:active{transform:translateY(-50%) scale(.94)}.imagem-navegacao-anterior{left:.75rem}.imagem-navegacao-seguinte{right:.75rem}@media(max-width:640px){.imagem-navegacao{width:36px;height:50px;font-size:34px}.imagem-navegacao-anterior{left:.4rem}.imagem-navegacao-seguinte{right:.4rem}}';
        document.head.appendChild(imageNavigationStyle);
    }

    function abrirModalImagemFullLoja(produto) {
        var galeria = obterGaleriaProduto(produto);
        var imagens = galeria.map(function(item) { return item.url; });

        if (imagens.length === 0) {
            UI.mostrarToast('Sem imagem para este produto.');
            return;
        }

        var currentIndex = 0;
        var modal = document.createElement('div');
        modal.className = 'modal-imagem-full loja-padronizada';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.setAttribute('aria-label', 'Imagem de ' + produto.nome);
        modal.style.cssText = 'position:fixed; inset:0; background:#000; z-index:20000; display:flex; align-items:center; justify-content:center; width:100vw; height:100vh; margin:0; padding:0;';

        function navegarImagem(delta) {
            if (imagens.length < 2) return;
            currentIndex = (currentIndex + delta + imagens.length) % imagens.length;
            atualizarModal();
        }

        function atualizarModal() {
            var variacaoDaImagem = galeria[currentIndex] && galeria[currentIndex].variacao;
            var precoDaImagem = variacaoDaImagem ? parseFloat(variacaoDaImagem.preco) : NaN;
            var precoSelecionado = !isNaN(precoDaImagem) ? precoDaImagem : (produto.__precoSelecionado !== undefined && produto.__precoSelecionado !== null ? parseFloat(produto.__precoSelecionado) : NaN);
            var precoBase = !isNaN(precoSelecionado) ? precoSelecionado : (parseFloat(produto.preco) || 0);
            if (isNaN(precoSelecionado) && produto.tipo === 'variavel' && produto.variacoes && produto.variacoes.length > 0) {
                var precos = produto.variacoes.map(function(v) { return parseFloat(v.preco) || 0; });
                precoBase = Math.min.apply(null, precos);
            }
            var estoqueDaImagem = variacaoDaImagem ? variacaoDaImagem.estoque : produto.__estoqueSelecionado;
            var estoqueNumerico = obterEstoqueNumerico(estoqueDaImagem);
            var estoqueImagemHtml = estoqueNumerico === null ? '<div class="estoque-imagem" style="font-size:.8rem;color:#cbd5e1;">Estoque disponível: Ilimitado</div>' : '<div class="estoque-imagem" style="font-size:.8rem;color:#cbd5e1;">Estoque disponível: ' + estoqueNumerico + '</div>';
            var html = '<div class="container-imagem" style="display:flex; flex-wrap:wrap; justify-content:center; align-items:center; width:100%; height:100%; background:#000; position:relative;">' +
                '<button type="button" class="modal-close-btn fechar" onclick="this.closest(\'.modal-imagem-full\').remove()" aria-label="Fechar imagem" style="position:absolute; top:1rem; right:1rem; color:white; font-size:1.45rem; cursor:pointer; background:rgba(0,0,0,0.5); border:1px solid rgba(255,255,255,.35); width:2.25rem; height:2.25rem; border-radius:50%; display:flex; align-items:center; justify-content:center; z-index:10;">×</button>' +
                '<div class="lado-esquerdo" style="flex:2; min-width:200px; text-align:center; padding:1rem; display:flex; flex-direction:column; justify-content:center; height:100%; position:relative;">' +
                (imagens.length > 1 ? '<button type="button" id="imagemAnterior" class="imagem-navegacao imagem-navegacao-anterior" aria-label="Imagem anterior" title="Imagem anterior (seta para a esquerda)">‹</button><button type="button" id="imagemSeguinte" class="imagem-navegacao imagem-navegacao-seguinte" aria-label="Próxima imagem" title="Próxima imagem (seta para a direita)">›</button>' : '') +
                '<img src="' + imagens[currentIndex] + '" class="imagem-principal" alt="' + produto.nome + '" style="max-width:100%; max-height:70vh; object-fit:contain; margin:auto;">' +
                (imagens.length > 1 ? '<div class="miniaturas" style="display:flex; gap:0.5rem; justify-content:center; margin-top:1rem; flex-wrap:wrap;">' +
                    imagens.map(function(img, idx) {
                        return '<img src="' + img + '" class="miniatura ' + (idx === currentIndex ? 'ativa' : '') + '" data-idx="' + idx + '" alt="Miniatura ' + (idx+1) + '" style="width:50px; height:50px; object-fit:cover; border-radius:0.5rem; cursor:pointer; border:' + (idx === currentIndex ? '2px solid #0a66c2' : '2px solid transparent') + ';">';
                    }).join('') + '</div>' : '') +
                '</div>' +
                '<div class="lado-direito" style="flex:1; padding:1rem; background:#111; color:white; border-radius:0; height:100%; display:flex; flex-direction:column; justify-content:center; gap:1rem;">' +
                '<div class="produto-nome" style="font-size:1.2rem; font-weight:700; color:white;">' + Core.sanitize(produto.nome) + '</div>' +
                '<div class="preco-unitario-imagem" id="precoUnitarioImagem" style="font-size:.82rem; color:#cbd5e1;">Preço unitário: ' + formatarValorPromocaoLoja(precoBase) + '</div>' +
                '<div class="promocao-imagem-info" style="font-size:.78rem; color:#86efac;"></div>' +
                '<div class="preco" style="font-size:1.2rem; font-weight:700; color:#0a66c2;">Total: ' + formatarValorPromocaoLoja(precoBase) + '</div>' +
                estoqueImagemHtml +
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

            var imagemAnterior = modal.querySelector('#imagemAnterior');
            var imagemSeguinte = modal.querySelector('#imagemSeguinte');
            if (imagemAnterior) imagemAnterior.addEventListener('click', function() { navegarImagem(-1); });
            if (imagemSeguinte) imagemSeguinte.addEventListener('click', function() { navegarImagem(1); });

            var qtdInput = modal.querySelector('#qtdImg');
            var menosBtn = modal.querySelector('#menosQtdImg');
            var maisBtn = modal.querySelector('#maisQtdImg');
            var precoSpan = modal.querySelector('.preco');

            function atualizarPrecoImagem() {
                var qtd = Math.max(1, parseInt(qtdInput.value) || 1);
                qtdInput.value = qtd;
                var variacaoParaCalculo = variacaoDaImagem || produto.__variacaoSelecionada || null;
                var ofertaImagem = calcularOfertaItemLoja({
                    id: produto.id,
                    variacaoId: obterIdVariacaoLoja(variacaoParaCalculo),
                    preco: precoBase,
                    quantidade: qtd,
                    atributos: variacaoParaCalculo && variacaoParaCalculo.atributos ? variacaoParaCalculo.atributos : (produto.__variacaoSelecionada && produto.__variacaoSelecionada.atributos ? produto.__variacaoSelecionada.atributos : null)
                });
                var total = ofertaImagem.subtotalPromocional;
                var unitarioEl = modal.querySelector('#precoUnitarioImagem');
                var promocaoEl = modal.querySelector('.promocao-imagem-info');
                if (unitarioEl) unitarioEl.innerHTML = 'Preço unitário: ' + formatarValorPromocaoLoja(precoBase);
                if (promocaoEl) {
                    if (ofertaImagem.desconto > 0) {
                        promocaoEl.innerHTML = '<strong>Promoção:</strong> ' + ofertaImagem.condicaoPromocao + ' · <strong>Desconto:</strong> -' + formatarValorPromocaoLoja(ofertaImagem.desconto);
                    } else if (ofertaImagem.promocaoDisponivel && ofertaImagem.faixaSeguinte) {
                        var faltamImagem = Math.max(0, ofertaImagem.faixaSeguinte.quantidade - qtd);
                        promocaoEl.innerHTML = '<strong>Oferta:</strong> ' + ofertaImagem.faixaSeguinte.quantidade + ' por ' + formatarValorPromocaoLoja(ofertaImagem.faixaSeguinte.preco) + ' · faltam ' + faltamImagem + ' unidade' + (faltamImagem === 1 ? '' : 's');
                    } else {
                        promocaoEl.innerHTML = '';
                    }
                }
                precoSpan.innerHTML = ofertaImagem.desconto > 0 ? '<s style="color:#94a3b8;font-size:.8rem;">' + formatarValorPromocaoLoja(ofertaImagem.subtotalOriginal) + '</s> <strong style="color:#34d399;">Total com promoção: ' + formatarValorPromocaoLoja(total) + '</strong>' : 'Total: ' + formatarValorPromocaoLoja(total);
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
        var navegacaoTeclado = function(e) {
            if (!document.body.contains(modal)) { document.removeEventListener('keydown', navegacaoTeclado); return; }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                navegarImagem(-1);
            } else if (e.key === 'ArrowRight') {
                e.preventDefault();
                navegarImagem(1);
            } else if (e.key === 'Escape') {
                modal.remove();
                document.removeEventListener('keydown', navegacaoTeclado);
            }
        };
        document.addEventListener('keydown', navegacaoTeclado);
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
        var est = obterEstoqueNumerico(variacoes[i].estoque);
        if (est === null || est > 0) {
            primeiraComEstoque = variacoes[i];
            break;
        }
    }

    if (!primeiraComEstoque) {
        UI.mostrarToast('Todas as variações estão esgotadas.');
        return;
    }

    var selecaoAtual = {};
    var variacaoSelecionadaAtual = primeiraComEstoque;
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
        '<div id="variacaoInfo"><strong>Preço unitário:</strong> ' + formatarValorPromocaoLoja(primeiraComEstoque.preco) + '<br><span>Quantidade: 1</span><br><span>Estoque disponível: ' + textoEstoqueDisponivel(primeiraComEstoque.estoque) + '</span></div>' +
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
            variacaoSelecionadaAtual = encontrada;
            var preco = parseFloat(encontrada.preco) || 0;
            var estoque = obterEstoqueNumerico(encontrada.estoque);
            var imagensEncontradas = obterImagensVariacao(encontrada);
            variacaoImagem.src = imagensEncontradas[0] || obterImagemPrincipalProduto(produto) || 'https://via.placeholder.com/150';
            if (estoque === null) {
                qtdInput.removeAttribute('max');
            } else {
                qtdInput.max = String(estoque);
                if (parseInt(qtdInput.value) > estoque && estoque > 0) qtdInput.value = estoque;
            }
            atualizarTotalVariacaoModal();
            btnAdd.disabled = estoque !== null && estoque <= 0;
        } else {
            variacaoInfo.innerHTML = 'Combinação não disponível.';
            var variacaoTotal = document.getElementById('variacaoTotal');
            if (variacaoTotal) variacaoTotal.textContent = 'Indisponível';
            variacaoImagem.src = obterImagemPrincipalProduto(produto) || 'https://via.placeholder.com/150';
            btnAdd.disabled = true;
        }
    }

    function atualizarTotalVariacaoModal() {
        var totalEl = document.getElementById('variacaoTotal');
        if (!totalEl || !variacaoSelecionadaAtual) return;
        var quantidadeAtual = Math.max(1, parseInt(qtdInput.value) || 1);
        var precoUnitario = parseFloat(variacaoSelecionadaAtual.preco) || 0;
        var ofertaAtual = calcularOfertaItemLoja({ id: produto.id, variacaoId: obterIdVariacaoLoja(variacaoSelecionadaAtual), preco: precoUnitario, quantidade: quantidadeAtual, atributos: variacaoSelecionadaAtual.atributos || null });
        var totalOriginal = precoUnitario * quantidadeAtual;
        var estoqueAtual = obterEstoqueNumerico(variacaoSelecionadaAtual.estoque);
        if (variacaoInfo) {
            var infoHtml = '<div><strong>Preço unitário:</strong> ' + formatarValorPromocaoLoja(precoUnitario) + '</div>';
            infoHtml += '<div><strong>Quantidade:</strong> ' + quantidadeAtual + '</div>';
            if (ofertaAtual.desconto > 0) {
                infoHtml += '<div class="promocao-aplicada-info"><strong>Promoção:</strong> ' + ofertaAtual.condicaoPromocao + '<br><strong>Desconto:</strong> -' + formatarValorPromocaoLoja(ofertaAtual.desconto) + '</div>';
            } else if (ofertaAtual.promocaoDisponivel && ofertaAtual.faixaSeguinte) {
                var faltam = Math.max(0, ofertaAtual.faixaSeguinte.quantidade - quantidadeAtual);
                infoHtml += '<div class="promocao-pendente-info"><strong>Oferta:</strong> ' + ofertaAtual.faixaSeguinte.quantidade + ' por ' + formatarValorPromocaoLoja(ofertaAtual.faixaSeguinte.preco) + '<br>Adicione mais ' + faltam + ' unidade' + (faltam === 1 ? '' : 's') + ' para ativar.</div>';
            }
            infoHtml += '<div><strong>Estoque disponível:</strong> ' + textoEstoqueDisponivel(variacaoSelecionadaAtual.estoque) + '</div>';
            variacaoInfo.innerHTML = infoHtml;
        }
        if (ofertaAtual.desconto > 0) {
            totalEl.innerHTML = '<span class="total-label">Total com promoção</span> <s style="color:#94a3b8;font-size:.8rem;">' + formatarValorPromocaoLoja(totalOriginal) + '</s> <strong style="color:#059669;">' + formatarValorPromocaoLoja(ofertaAtual.subtotalPromocional) + '</strong>';
        } else {
            totalEl.innerHTML = '<span class="total-label">Total</span> <strong>' + formatarValorPromocaoLoja(totalOriginal) + '</strong>';
        }
    }

    document.getElementById('variacaoMenosQtd').onclick = function() {
        var val = parseInt(qtdInput.value) || 1;
        if (val > 1) { qtdInput.value = val - 1; atualizarTotalVariacaoModal(); }
    };
    document.getElementById('variacaoMaisQtd').onclick = function() {
        var val = parseInt(qtdInput.value) || 1;
        var max = qtdInput.max ? parseInt(qtdInput.max, 10) : Infinity;
        if (!Number.isFinite(max) || val < max) { qtdInput.value = val + 1; atualizarTotalVariacaoModal(); }
    };
    qtdInput.addEventListener('input', atualizarTotalVariacaoModal);
    qtdInput.addEventListener('change', atualizarTotalVariacaoModal);

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
        var estoqueDisp = obterEstoqueNumerico(encontrada.estoque);
        if (estoqueDisp !== null && qtd > estoqueDisp) {
            UI.mostrarToast('Estoque insuficiente. Disponível: ' + estoqueDisp, 'erro');
            return;
        }

        var atributosStr = '';
        for (var attr in selecaoAtual) {
            atributosStr += (atributosStr ? ', ' : '') + attr + ': ' + selecaoAtual[attr];
        }
        var nomeCompleto = produto.nome + (atributosStr ? ' (' + atributosStr + ')' : '');

        var variacaoIdCarrinho = obterIdVariacaoLoja(encontrada);
        var existing = carrinho.find(function(item) {
            return item.id === produto.id && item.variacaoId === variacaoIdCarrinho;
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
                variacaoId: variacaoIdCarrinho,
                atributos: JSON.parse(JSON.stringify(selecaoAtual)),
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
            var temEstoqueIlimitado = prod.variacoes.some(function(v) { return estoqueSemLimite(v.estoque); });
            var totalEstoque = prod.variacoes.reduce(function(acc, v) {
                var est = obterEstoqueNumerico(v.estoque);
                return acc + (est === null ? 0 : est);
            }, 0);
            esgotado = !temEstoqueIlimitado && totalEstoque <= 0;
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

        var ofertaProduto = obterOfertaProdutoLoja(prod);
        var promocaoCardHtml = ofertaProduto ? '<div style="font-size:.68rem;color:#059669;font-weight:800;margin-top:.2rem;">' + ofertaProduto.texto + '</div>' : '';
        var estoqueInfo = '';
        if (tipo === 'variavel') {
            var temEstoqueIlimitado2 = prod.variacoes.some(function(v) { return estoqueSemLimite(v.estoque); });
            var totalEstoque2 = prod.variacoes.reduce(function(acc, v) {
                var est2 = obterEstoqueNumerico(v.estoque);
                return acc + (est2 === null ? 0 : est2);
            }, 0);
            if (temEstoqueIlimitado2) {
                estoqueInfo = '<div style="font-size:0.65rem; color:#64748b;">Estoque: Ilimitado</div>';
            } else {
                estoqueInfo = '<div style="font-size:0.65rem; color:' + (totalEstoque2 <= 5 ? '#dc3545' : '#64748b') + ';">Estoque total: ' + totalEstoque2 + '</div>';
            }
        } else {
            var estGeral = obterEstoqueNumerico(prod.estoque);
            if (estGeral === null) {
                estoqueInfo = '<div style="font-size:0.65rem; color:#64748b;">Estoque: Ilimitado</div>';
            } else {
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
            '<div class="produto-preco">' + (ofertaProduto && !ofertaProduto.apenasAlgumas && ofertaProduto.promocao.tipo !== 'quantidade' ? '<s style="color:#94a3b8;font-size:.72rem;margin-right:.25rem;">' + precoExibido + '</s> R$ ' + ofertaProduto.precoPromocional.toFixed(2) : precoExibido) + '</div>' +
            promocaoCardHtml +
            estoqueInfo +
            '</div>' +
            botaoHtml +
            '</div>';
    }

    // ===== PROMOÇÕES AUTOMÁTICAS =====
    function assinaturaAtributosVariacaoLoja(atributos) {
        if (!atributos || typeof atributos !== 'object') return '';
        return Object.keys(atributos).sort().map(function(chave) {
            return chave + '=' + String(atributos[chave]);
        }).join('|');
    }

    function obterIdsVariacaoLoja(variacao) {
        if (!variacao) return [];
        var valores = [];
        ['variacaoId', 'sku', 'id'].forEach(function(campo) {
            if (variacao[campo] !== undefined && variacao[campo] !== null && String(variacao[campo]) !== '') valores.push(String(variacao[campo]));
        });
        var assinatura = assinaturaAtributosVariacaoLoja(variacao.atributos);
        if (assinatura) valores.push(assinatura);
        var ids = [];
        valores.forEach(function(valor) {
            if (ids.indexOf(valor) === -1) ids.push(valor);
            try {
                var possivelObjeto = JSON.parse(valor);
                var assinaturaJson = assinaturaAtributosVariacaoLoja(possivelObjeto);
                if (assinaturaJson && ids.indexOf(assinaturaJson) === -1) ids.push(assinaturaJson);
            } catch (e) {}
        });
        return ids;
    }

    function obterIdVariacaoLoja(variacao) {
        var ids = obterIdsVariacaoLoja(variacao);
        return ids.length ? ids[0] : null;
    }

    function promocaoDentroDaValidadeLoja(promocao) {
        if (!promocao || promocao.ativo !== 'sim') return false;
        var hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        if (promocao.inicio && new Date(promocao.inicio + 'T00:00:00') > hoje) return false;
        if (promocao.fim && new Date(promocao.fim + 'T23:59:59') < new Date()) return false;
        if (promocao.validade && new Date(promocao.validade + 'T23:59:59') < new Date()) return false;
        return true;
    }

    function obterLimiteUsosCupomLoja(cupom) {
        var limite = parseInt(cupom && cupom.limiteUsos, 10);
        return Number.isInteger(limite) && limite > 0 ? limite : null;
    }

    function obterUsosCupomLoja(cupom) {
        var usos = parseInt(cupom && cupom.usosTotal, 10);
        return Number.isInteger(usos) && usos >= 0 ? usos : 0;
    }

    function promocaoAplicaAoItemLoja(promocao, item) {
        if (!promocaoDentroDaValidadeLoja(promocao)) return false;
        if (!Array.isArray(promocao.produtoIds) || !promocao.produtoIds.some(function(id) { return String(id) === String(item.id); })) return false;
        if (promocao.aplicacao === 'especificas') {
            var idsItem = obterIdsVariacaoLoja(item);
            return Array.isArray(promocao.variacoes) && promocao.variacoes.some(function(v) {
                if (String(v.produtoId) !== String(item.id)) return false;
                var idsPromocao = obterIdsVariacaoLoja(v);
                return idsItem.some(function(idItem) { return idsPromocao.indexOf(idItem) !== -1; });
            });
        }
        return true;
    }

    function obterFaixaAplicadaPromocaoLoja(promocao, precoOriginal, quantidade) {
        if (!promocao || promocao.tipo !== 'quantidade' || !Array.isArray(promocao.faixas)) return null;
        var subtotalOriginal = precoOriginal * quantidade;
        var melhor = null;
        if (promocao.quantidadeModo === 'a_partir') {
            promocao.faixas.forEach(function(faixa) {
                var qtdFaixa = parseInt(faixa.quantidade) || 0;
                var precoFaixa = Math.max(0, parseFloat(faixa.preco) || 0);
                if (qtdFaixa <= 0 || quantidade < qtdFaixa) return;
                var totalFaixa = precoFaixa * quantidade;
                if (totalFaixa < subtotalOriginal && (!melhor || precoFaixa < melhor.preco || (precoFaixa === melhor.preco && qtdFaixa > melhor.quantidade))) {
                    melhor = { quantidade: qtdFaixa, preco: precoFaixa, pacotes: 0, restante: 0, subtotalPromocional: totalFaixa };
                }
            });
            return melhor;
        }
        promocao.faixas.forEach(function(faixa) {
            var qtdFaixa = parseInt(faixa.quantidade) || 0;
            var precoFaixa = Math.max(0, parseFloat(faixa.preco) || 0);
            if (qtdFaixa <= 0 || quantidade < qtdFaixa) return;
            var pacotes = Math.floor(quantidade / qtdFaixa);
            var restante = quantidade % qtdFaixa;
            var totalFaixa = pacotes * precoFaixa + restante * precoOriginal;
            if (totalFaixa < subtotalOriginal && (!melhor || totalFaixa < melhor.subtotalPromocional)) {
                melhor = { quantidade: qtdFaixa, preco: precoFaixa, pacotes: pacotes, restante: restante, subtotalPromocional: totalFaixa };
            }
        });
        return melhor;
    }

    function obterProximaFaixaPromocaoLoja(promocao, quantidade) {
        if (!promocao || promocao.tipo !== 'quantidade' || !Array.isArray(promocao.faixas)) return null;
        return promocao.faixas.map(function(faixa) {
            return { quantidade: parseInt(faixa.quantidade) || 0, preco: Math.max(0, parseFloat(faixa.preco) || 0) };
        }).filter(function(faixa) { return faixa.quantidade > quantidade; }).sort(function(a, b) { return a.quantidade - b.quantidade; })[0] || null;
    }

    function calcularSubtotalPromocaoLoja(promocao, precoOriginal, quantidade) {
        var subtotalOriginal = precoOriginal * quantidade;
        if (!promocao) return subtotalOriginal;
        if (promocao.tipo === 'preco') {
            return Math.min(subtotalOriginal, Math.max(0, parseFloat(promocao.valor) || 0) * quantidade);
        }
        if (promocao.tipo === 'percentual') {
            var percentual = Math.min(100, Math.max(0, parseFloat(promocao.valor) || 0));
            return subtotalOriginal * (1 - percentual / 100);
        }
        if (promocao.tipo === 'quantidade') {
            var faixaAplicada = obterFaixaAplicadaPromocaoLoja(promocao, precoOriginal, quantidade);
            return faixaAplicada ? faixaAplicada.subtotalPromocional : subtotalOriginal;
        }
        return subtotalOriginal;
    }

    function formatarValorPromocaoLoja(valor) {
        return 'R$ ' + (Math.max(0, parseFloat(valor) || 0)).toFixed(2).replace('.', ',');
    }

    function obterResumoCondicaoPromocaoLoja(promocao, faixaAplicada, precoOriginal) {
        if (!promocao) return '';
        if (promocao.tipo === 'quantidade' && faixaAplicada) {
            if (promocao.quantidadeModo === 'a_partir') return 'A partir de ' + faixaAplicada.quantidade + ' unidades: ' + formatarValorPromocaoLoja(faixaAplicada.preco) + ' por peça';
            var partes = [];
            if (faixaAplicada.pacotes > 0) {
                partes.push(faixaAplicada.pacotes + ' pacote' + (faixaAplicada.pacotes === 1 ? '' : 's') + ' de ' + faixaAplicada.quantidade + ' por ' + formatarValorPromocaoLoja(faixaAplicada.preco));
            }
            if (faixaAplicada.restante > 0) {
                partes.push(faixaAplicada.restante + ' unidade' + (faixaAplicada.restante === 1 ? '' : 's') + ' por ' + formatarValorPromocaoLoja(precoOriginal));
            }
            return partes.join(' + ');
        }
        if (promocao.tipo === 'quantidade') {
            var primeiraFaixa = Array.isArray(promocao.faixas) ? promocao.faixas.map(function(faixa) {
                return { quantidade: parseInt(faixa.quantidade) || 0, preco: Math.max(0, parseFloat(faixa.preco) || 0) };
            }).filter(function(faixa) { return faixa.quantidade > 0; }).sort(function(a, b) { return a.quantidade - b.quantidade; })[0] : null;
            return primeiraFaixa ? primeiraFaixa.quantidade + ' por ' + formatarValorPromocaoLoja(primeiraFaixa.preco) : 'Oferta por quantidade';
        }
        if (promocao.tipo === 'percentual') return (parseFloat(promocao.valor) || 0) + '% de desconto';
        return 'Preço promocional: ' + formatarValorPromocaoLoja(promocao.valor);
    }

    function calcularOfertaItemLoja(item) {
        var quantidade = Math.max(1, parseInt(item.quantidade) || 1);
        var precoOriginal = Math.max(0, parseFloat(item.preco) || 0);
        var subtotalOriginal = precoOriginal * quantidade;
        var subtotalPromocional = subtotalOriginal;
        var promocao = null;
        var promocaoDisponivel = null;
        var proximaFaixa = null;
        promocoesCache.forEach(function(candidata) {
            if (!promocaoAplicaAoItemLoja(candidata, item)) return;
            var subtotalCandidato = calcularSubtotalPromocaoLoja(candidata, precoOriginal, quantidade);
            if (candidata.tipo === 'quantidade' && subtotalCandidato >= subtotalOriginal) {
                var faixaSeguinte = obterProximaFaixaPromocaoLoja(candidata, quantidade);
                if (faixaSeguinte && !proximaFaixa) {
                    promocaoDisponivel = candidata;
                    proximaFaixa = faixaSeguinte;
                }
            }
            if (subtotalCandidato < subtotalPromocional) {
                subtotalPromocional = subtotalCandidato;
                promocao = candidata;
            }
        });
        var subtotalFinal = Math.max(0, subtotalPromocional);
        var faixaAplicada = promocao && promocao.tipo === 'quantidade' ? obterFaixaAplicadaPromocaoLoja(promocao, precoOriginal, quantidade) : null;
        var promocaoParaExibicao = promocao || promocaoDisponivel;
        var faixaParaExibicao = faixaAplicada || proximaFaixa;
        return {
            promocao: promocao,
            promocaoDisponivel: promocaoDisponivel,
            faixaAplicada: faixaAplicada,
            faixaSeguinte: proximaFaixa,
            precoOriginal: precoOriginal,
            quantidade: quantidade,
            subtotalOriginal: subtotalOriginal,
            subtotalPromocional: subtotalFinal,
            desconto: Math.max(0, subtotalOriginal - subtotalFinal),
            precoUnitarioPromocional: quantidade ? subtotalFinal / quantidade : precoOriginal,
            condicaoPromocao: obterResumoCondicaoPromocaoLoja(promocaoParaExibicao, faixaParaExibicao, precoOriginal)
        };
    }

    function calcularResumoPromocoesLoja() {
        return carrinho.reduce(function(resumo, item) {
            var oferta = calcularOfertaItemLoja(item);
            resumo.subtotalOriginal += oferta.subtotalOriginal;
            resumo.subtotalPromocional += oferta.subtotalPromocional;
            resumo.descontoPromocoes += oferta.desconto;
            if (oferta.promocao) resumo.promocoesAplicadas.push({ id: oferta.promocao.id || null, nome: oferta.promocao.nome || 'Promoção', itemId: item.id, variacaoId: item.variacaoId || null, desconto: oferta.desconto });
            return resumo;
        }, { subtotalOriginal: 0, subtotalPromocional: 0, descontoPromocoes: 0, promocoesAplicadas: [] });
    }

    function obterOfertaProdutoLoja(produto) {
        var candidatos = promocoesCache.filter(function(p) {
            return promocaoDentroDaValidadeLoja(p) && Array.isArray(p.produtoIds) && p.produtoIds.some(function(id) { return String(id) === String(produto.id); });
        });
        if (!candidatos.length) return null;
        var precoBase = produto.tipo === 'variavel' && Array.isArray(produto.variacoes) && produto.variacoes.length ? Math.min.apply(null, produto.variacoes.map(function(v) { return parseFloat(v.preco) || 0; })) : (parseFloat(produto.preco) || 0);
        var melhor = null;
        var melhorPreco = precoBase;
        candidatos.forEach(function(candidata) {
            if (candidata.aplicacao === 'especificas') {
                if (!melhor) melhor = candidata;
                return;
            }
            var precoCandidato = calcularSubtotalPromocaoLoja(candidata, precoBase, 1);
            if (!melhor || precoCandidato < melhorPreco) {
                melhor = candidata;
                melhorPreco = precoCandidato;
            }
        });
        var promocao = melhor || candidatos[0];
        if (promocao.aplicacao === 'especificas') return { promocao: promocao, precoOriginal: precoBase, precoPromocional: precoBase, texto: 'Oferta em algumas variações', apenasAlgumas: true };
        if (promocao.tipo === 'preco' || promocao.tipo === 'percentual') {
            var precoPromocional = calcularSubtotalPromocaoLoja(promocao, precoBase, 1);
            var texto = promocao.tipo === 'percentual' ? (parseFloat(promocao.valor) || 0) + '% OFF' : 'Oferta';
            return { promocao: promocao, precoOriginal: precoBase, precoPromocional: precoPromocional, texto: texto };
        }
        var primeiraFaixa = Array.isArray(promocao.faixas) ? promocao.faixas.map(function(faixa) {
            return { quantidade: parseInt(faixa.quantidade) || 0, preco: Math.max(0, parseFloat(faixa.preco) || 0) };
        }).filter(function(faixa) { return faixa.quantidade > 0; }).sort(function(a, b) { return a.quantidade - b.quantidade; })[0] : null;
        var textoQuantidade = primeiraFaixa
            ? (promocao.quantidadeModo === 'a_partir' ? 'A partir de ' + primeiraFaixa.quantidade + ' un.: ' + formatarValorPromocaoLoja(primeiraFaixa.preco) + '/peça' : 'A cada ' + primeiraFaixa.quantidade + ' un.: ' + formatarValorPromocaoLoja(primeiraFaixa.preco) + '/grupo')
            : 'Oferta por quantidade';
        return { promocao: promocao, precoOriginal: precoBase, precoPromocional: precoBase, texto: textoQuantidade };
    }

    function carregarPromocoesLoja() {
        if (!currentLojistaId) return Promise.resolve();
        return Core.db.collection('lojistas').doc(currentLojistaId).collection('promocoes').get().then(function(snap) {
            promocoesCache = [];
            snap.forEach(function(doc) { promocoesCache.push(Object.assign({ id: doc.id }, doc.data())); });
            var container = document.getElementById('produtosContainer');
            if (container && produtosCache.length) container.innerHTML = renderizarProdutosLoja(produtosCache);
            atualizarCarrinhoLoja();
        }).catch(function(err) {
            promocoesCache = [];
            console.error('Erro ao carregar promoções da Loja:', err);
        });
    }

    function calcularDescontoCupomLoja(subtotal, frete) {
        if (!cupomAtual || !promocaoDentroDaValidadeLoja(Object.assign({ ativo: 'sim' }, cupomAtual))) return 0;
        var limite = obterLimiteUsosCupomLoja(cupomAtual);
        if (limite !== null && obterUsosCupomLoja(cupomAtual) >= limite) return 0;
        var totalPedido = subtotal + frete;
        if (cupomAtual.minimoPedido && totalPedido < parseFloat(cupomAtual.minimoPedido)) return 0;
        var valor = parseFloat(cupomAtual.valor) || 0;
        var desconto = cupomAtual.tipo === 'percentual' ? totalPedido * valor / 100 : valor;
        return Math.min(totalPedido, Math.max(0, desconto));
    }

    // ===== CARRINHO =====
    function atualizarCarrinhoLoja() {
        var container = document.getElementById('carrinhoLista');
        if (!container) return;
        if (carrinho.length === 0) {
            container.innerHTML = '<p style="text-align:center;padding:1rem;">Carrinho vazio</p>';
            recalcularTotalLoja();
            atualizarBadgeCarrinhoLoja();
            return;
        }
        var subtotal = 0;
        container.innerHTML = carrinho.map(function(item) {
            var subtotalItem = item.preco * item.quantidade;
            subtotal += subtotalItem;
            var ofertaItem = calcularOfertaItemLoja(item);
            var precoItemHtml = '<div>Preço unitário: ' + formatarValorPromocaoLoja(item.preco) + '</div>';
            if (ofertaItem.desconto > 0) {
                precoItemHtml += '<div style="color:#059669;font-size:.72rem;"><strong>Promoção:</strong> ' + ofertaItem.condicaoPromocao + '<br><strong>Desconto:</strong> -' + formatarValorPromocaoLoja(ofertaItem.desconto) + '</div>';
                precoItemHtml += '<strong style="color:#059669;">Total do item: ' + formatarValorPromocaoLoja(ofertaItem.subtotalPromocional) + '</strong>';
            } else {
                precoItemHtml += '<strong>Total do item: ' + formatarValorPromocaoLoja(ofertaItem.subtotalOriginal) + '</strong>';
            }
            return '<div class="item-carrinho">' +
                '<img src="' + (item.imagem || 'https://via.placeholder.com/40') + '" class="item-carrinho-imagem" onerror="this.style.display=\'none\'">' +
                '<div style="flex:1"><strong>' + Core.sanitize(item.nome) + '</strong><br>' + precoItemHtml + '</div>' +
                '<input type="number" min="1" value="' + item.quantidade + '" class="qtd-item" data-id="' + item.id + '" data-variacao="' + (item.variacaoId || '') + '" onchange="alterarQuantidadeLoja(\'' + item.id + '\', this.value, \'' + (item.variacaoId || '') + '\')">' +
                '<button class="btn-pequeno" onclick="removerDoCarrinhoLoja(\'' + item.id + '\', \'' + (item.variacaoId || '') + '\')">✕</button>' +
                '</div>';
        }).join('');
        document.getElementById('carrinhoSubtotal').innerText = subtotal.toFixed(2);
        recalcularTotalLoja();
        atualizarBadgeCarrinhoLoja();
    }

    function recalcularTotalLoja() {
        var resumo = calcularResumoPromocoesLoja();
        var frete = parseFloat(document.getElementById('selectFreteLoja')?.value) || 0;
        cupomDesconto = calcularDescontoCupomLoja(resumo.subtotalPromocional, frete);
        var total = Math.max(0, resumo.subtotalPromocional + frete - cupomDesconto);
        var totalEl = document.getElementById('totalLoja');
        var subtotalEl = document.getElementById('carrinhoSubtotal');
        var promocaoEl = document.getElementById('promocaoLojaResumo');
        if (subtotalEl) subtotalEl.innerText = resumo.subtotalPromocional.toFixed(2);
        if (promocaoEl) promocaoEl.innerHTML = resumo.descontoPromocoes > 0 ? '<span style="color:#059669;">Promoções: - R$ ' + resumo.descontoPromocoes.toFixed(2) + '</span>' : '';
        if (totalEl) totalEl.innerText = total.toFixed(2);
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
        if (!cod) { cupomAtual = null; statusDiv.innerHTML = 'Digite um código.'; recalcularTotalLoja(); return; }
        Core.db.collection('lojistas').where('estabelecimentoId', '==', estId).limit(1).get()
            .then(function(snap) {
                if (snap.empty) throw new Error('lojista_nao_encontrado');
                return Core.db.collection('lojistas').doc(snap.docs[0].id).collection('cupons').where('codigo', '==', cod).where('ativo', '==', 'sim').limit(1).get();
            })
            .then(function(snapCupons) {
                if (snapCupons.empty) throw new Error('cupom_invalido');
                cupomAtual = Object.assign({ id: snapCupons.docs[0].id }, snapCupons.docs[0].data());
                var limiteCupom = obterLimiteUsosCupomLoja(cupomAtual);
                if (limiteCupom !== null && obterUsosCupomLoja(cupomAtual) >= limiteCupom) throw new Error('cupom_limite');
                if (cupomAtual.validade && new Date(cupomAtual.validade + 'T23:59:59') < new Date()) throw new Error('cupom_invalido');
                var resumo = calcularResumoPromocoesLoja();
                var frete = parseFloat(document.getElementById('selectFreteLoja')?.value) || 0;
                var desconto = calcularDescontoCupomLoja(resumo.subtotalPromocional, frete);
                if (cupomAtual.minimoPedido && desconto <= 0) throw new Error('pedido_minimo');
                statusDiv.innerHTML = '<span style="color:#10b981;">✅ Cupom aplicado! Desconto de ' + (cupomAtual.tipo === 'percentual' ? cupomAtual.valor + '%' : 'R$ ' + (parseFloat(cupomAtual.valor) || 0).toFixed(2)) + '</span>';
                recalcularTotalLoja();
            })
            .catch(function(err) {
                var minimoAnterior = cupomAtual && cupomAtual.minimoPedido;
                cupomAtual = null;
                var mensagem = err.message === 'pedido_minimo' ? '❌ Pedido mínimo: R$ ' + (parseFloat(minimoAnterior) || 0).toFixed(2) : (err.message === 'cupom_invalido' ? '❌ Cupom inválido ou expirado' : '❌ Erro ao validar cupom');
                statusDiv.innerHTML = '<span style="color:#dc3545;">' + mensagem + '</span>';
                recalcularTotalLoja();
                console.error(err);
            });
    }

    // ===== TROCO =====
    function toggleTrocoLoja() {
        var val = document.getElementById('formaPagamentoLoja')?.value;
        var wrapper = document.getElementById('trocoParaWrapperLoja');
        var trocoInput = document.getElementById('trocoParaLoja');
        var checkbox = document.getElementById('semTrocoCheckbox');
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

    function salvarPedidoComCupomLoja(pedido) {
        var pedidosRef = Core.db.collection('pedidos');
        if (!cupomAtual || !cupomAtual.id) return pedidosRef.add(pedido);
        var cupomRef = Core.db.collection('lojistas').doc(currentLojistaId).collection('cupons').doc(cupomAtual.id);
        var pedidoRef = pedidosRef.doc();
        return Core.db.runTransaction(function(transaction) {
            return transaction.get(cupomRef).then(function(doc) {
                if (!doc.exists) throw new Error('cupom_invalido');
                var cupom = doc.data() || {};
                var limite = obterLimiteUsosCupomLoja(cupom);
                var usos = obterUsosCupomLoja(cupom);
                if (limite !== null && usos >= limite) throw new Error('cupom_limite');
                transaction.set(pedidoRef, pedido);
                transaction.update(cupomRef, { usosTotal: usos + 1 });
            });
        });
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
        var selectFrete = document.getElementById('selectFreteLoja');
        var freteSelecionado = selectFrete ? String(selectFrete.value || '').trim() : '';
        var freteCarregado = !!selectFrete && selectFrete.dataset.freteCarregado === 'true';
        if (selectFrete && !freteCarregado) {
            UI.mostrarToast('Aguarde o carregamento das opções de frete.', 'erro');
            selectFrete.focus();
            return;
        }
        var freteObrigatorio = !!selectFrete && fretesCache.length > 0;
        if (freteObrigatorio && !freteSelecionado) {
            UI.mostrarToast('Selecione o frete antes de confirmar o pedido.', 'erro');
            selectFrete.focus();
            selectFrete.setAttribute('aria-invalid', 'true');
            return;
        }
        if (selectFrete) selectFrete.removeAttribute('aria-invalid');
        var formaPagamento = document.getElementById('formaPagamentoLoja').value;
        var semTrocoCheckbox = document.getElementById('semTrocoCheckbox');
        var trocoInput = document.getElementById('trocoParaLoja');
        var semTroco = !!(semTrocoCheckbox && semTrocoCheckbox.checked);
        var trocoValor = trocoInput ? trocoInput.value.trim() : '';
        if (formaPagamento === 'Dinheiro' && !semTroco && !trocoValor) {
            UI.mostrarToast('Informe o valor para troco, ou marque "Não preciso de troco".', 'erro');
            return;
        }
        salvarDadosClienteLocal(nome, telNumerico, end);

        var resumoPedido = calcularResumoPromocoesLoja();
        var subtotalOriginal = resumoPedido.subtotalOriginal;
        var subtotal = resumoPedido.subtotalPromocional;
        var frete = freteSelecionado !== '' ? (parseFloat(freteSelecionado) || 0) : 0;
        cupomDesconto = calcularDescontoCupomLoja(subtotal, frete);
        var total = Math.max(0, subtotal + frete - cupomDesconto);
        var pedidoItens = carrinho.map(function(i) {
            var oferta = calcularOfertaItemLoja(i);
            return {
                nome: i.nome,
                quantidade: i.quantidade,
                precoUnitario: oferta.precoUnitarioPromocional,
                precoUnitarioOriginal: i.preco,
                variacaoId: i.variacaoId || null,
                atributos: i.atributos || null,
                promocao: oferta.promocao ? oferta.promocao.nome : null
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
            subtotalOriginal: subtotalOriginal,
            descontoPromocoes: resumoPedido.descontoPromocoes,
            promocoesAplicadas: resumoPedido.promocoesAplicadas,
            cupomCodigo: cupomAtual ? cupomAtual.codigo : null,
            descontoAplicado: cupomDesconto,
            taxaEntrega: frete,
            total: total,
            formaPagamento: formaPagamento,
            trocoPara: formaPagamento === 'Dinheiro' && !semTroco ? trocoValor : '',
            semTroco: formaPagamento === 'Dinheiro' ? semTroco : false,
            observacao: document.getElementById('obsLoja').value,
            status: 'pendente',
            codigoCurto: codigoCurto,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (!currentLojistaId) {
            UI.mostrarToast('Erro: lojista não identificado.', 'erro');
            return;
        }
        salvarPedidoComCupomLoja(pedido)
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
                cupomAtual = null;
                cupomDesconto = 0;
                atualizarCarrinhoLoja();
            })
            .catch(function(err) {
                if (err.message === 'cupom_limite') {
                    cupomAtual = null;
                    cupomDesconto = 0;
                    recalcularTotalLoja();
                    UI.mostrarToast('O limite de usos deste cupom já foi atingido.', 'erro');
                    return;
                }
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

    // ===== ATUALIZAR IDENTIDADE VISUAL DA LOJA =====
    function atualizarLogoLojaUI(data) {
        var logoBox = document.querySelector('#modalLoja .modal-estabelecimento-logo');
        if (!logoBox) return;
        var logoUrl = obterLogoDoCadastroLoja(data) || logoEstab;
        if (!logoUrl) {
            logoBox.textContent = gerarIniciaisLoja(nomeEstab);
            return;
        }
        if (logoBox.getAttribute('data-logo-url') === logoUrl) return;
        logoBox.setAttribute('data-logo-url', logoUrl);
        logoBox.innerHTML = '';
        var img = document.createElement('img');
        img.src = logoUrl;
        img.alt = 'Logo de ' + nomeEstab;
        img.loading = 'eager';
        img.referrerPolicy = 'no-referrer';
        img.onerror = function() {
            logoBox.removeAttribute('data-logo-url');
            logoBox.textContent = gerarIniciaisLoja(nomeEstab);
        };
        logoBox.appendChild(img);
    }

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
            msgDiv.style.display = deveExibirMensagem ? 'flex' : 'none';
            msgDiv.innerHTML = '<span class="modal-status-label">Aviso da loja:</span><span class="modal-status-text">' + Core.sanitize(mensagem || (statusLoja === 'fechada' ? 'A loja está fechada no momento.' : 'Os pedidos estão pausados no momento.')) + '</span>';
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
            logoEstab = obterLogoDoCadastroLoja(lojistaData) || logoEstab;
            atualizarStatusLojaUI(lojistaData.statusLoja || 'aberta', lojistaData.statusMessage || '');

            // Listeners em tempo real
            unsubscribeStatusLoja = Core.db.collection('lojistas').doc(currentLojistaId).onSnapshot(function(doc) {
                if (doc.exists) {
                    var data = doc.data();
                    logoEstab = obterLogoDoCadastroLoja(data) || logoEstab;
                    atualizarLogoLojaUI(data);
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
                            var imagemPrincipalBase = data.imagem || imagens[0] || null;
                            var imagemPrincipal = imagemPrincipalBase;
                            var imagemFallbackVariacao = false;
                            if (!imagemPrincipal) {
                                for (var indiceImagem = 0; indiceImagem < variacoesNormalizadas.length; indiceImagem++) {
                                    var imagensDaVariacao = obterImagensVariacao(variacoesNormalizadas[indiceImagem]);
                                    if (imagensDaVariacao.length > 0) {
                                        imagemPrincipal = imagensDaVariacao[0];
                                        imagemFallbackVariacao = true;
                                        break;
                                    }
                                }
                            }

                            var prod = {
                                id: doc.id,
                                nome: data.nome,
                                preco: parseFloat(data.preco) || 0,
                                imagem: imagemPrincipal,
                                __imagemFallbackVariacao: imagemFallbackVariacao,
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

            carregarPromocoesLoja();

            unsubscribeFretes = Core.db.collection('lojistas').doc(currentLojistaId).collection('fretes')
                .onSnapshot(function(snapFretes) {
                    var fretes = [];
                    snapFretes.forEach(function(doc) {
                        var dadosFrete = doc.data();
                        if (dadosFrete.ativo === 'nao') return;
                        fretes.push({
                            localidade: dadosFrete.localidade,
                            taxa: parseFloat(dadosFrete.taxa) || 0
                        });
                    });
                    fretesCache = fretes;
                    var select = document.getElementById('selectFreteLoja');
                    if (select) {
                        select.innerHTML = '<option value="">' + (fretes.length ? 'Selecione o frete' : 'Nenhuma opção de frete cadastrada') + '</option>' +
                            fretes.map(function(f) {
                                return '<option value="' + f.taxa + '">' + f.localidade + ' - R$ ' + f.taxa.toFixed(2) + '</option>';
                            }).join('');
                        select.options[0].disabled = fretes.length > 0;
                        select.dataset.freteCarregado = 'true';
                    }
                });

            // Construir HTML do modal
            var logoHtml = logoEstab ? '<img src="' + Core.sanitize(logoEstab) + '" alt="Logo de ' + Core.sanitize(nomeEstab) + '" loading="eager" referrerpolicy="no-referrer">' : '<span aria-hidden="true">🛍️</span>';
            var modalHtml = '<div class="modal-overlay loja-padronizada" id="modalLoja" style="display:flex;" role="dialog" aria-modal="true" aria-labelledby="modalLojaTitulo">' +
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
                '<div id="promocaoLojaResumo" style="font-size:.78rem;margin:.2rem 0 .45rem;"></div>' +
                '<select id="selectFreteLoja" class="input-pedido" data-frete-carregado="false" onchange="this.removeAttribute(\'aria-invalid\'); recalcularTotalLoja()" aria-label="Selecione o frete" required><option value="">Carregando opções de frete...</option></select>' +
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
                '<div id="trocoParaWrapperLoja" style="display:block;"><input type="number" id="trocoParaLoja" class="input-pedido" placeholder="Troco para quanto?" aria-label="Troco para quanto"><label style="display:flex; align-items:center; gap:0.4rem; font-size:0.75rem; color:var(--gray-700); margin:-0.3rem 0 0.5rem 0.2rem;"><input type="checkbox" id="semTrocoCheckbox" style="width:auto;"> Não preciso de troco</label></div>' +
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
            atualizarLogoLojaUI(lojistaData);
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
