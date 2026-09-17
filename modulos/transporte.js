(function () {
  'use strict';
  if (!window.Economizei) window.Economizei = {};
  if (!Economizei.Cards) { console.error('[transporte] Core não carregado.'); return; }

  (function () {
    if (document.getElementById('css-transporte')) return;
    var l = document.createElement('link');
    l.id = 'css-transporte';
    l.rel = 'stylesheet';
    l.href = 'https://cdn.jsdelivr.net/gh/contatoeconomizeirioclaro-ai/economizei-assets@main/modulos/transporte.css';
    document.head.appendChild(l);
  })();

  var EU = EconomizeiUtils;
  var Core = Economizei.Core;
  var UI = Economizei.UI;
  var Cards = Economizei.Cards;
  var COLUNAS = Economizei.Horario.COLUNAS;

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

  Cards.registrarModulo('transporte', {
    label: '🚕 Solicitar corrida',
    ariaLabel: 'Solicitar corrida ou frete',
    onClick: function (idx) { return 'window.abrirModalTransporte(' + idx + ')'; }
  });

  var MAPBOX_TOKEN = (window.ECONOMIZEI_CONFIG && window.ECONOMIZEI_CONFIG.mapboxToken) || window.ECONOMIZEI_MAPBOX_TOKEN || '';
  var RC_CENTER = [-44.135, -22.723];

  function statusSeguro(s) { return ['aberta', 'pausada', 'fechada'].indexOf(s) !== -1 ? s : 'aberta'; }
  function gerarIniciais(nome) {
    var p = String(nome || 'Transporte').trim().split(/\s+/).filter(Boolean);
    return (p.slice(0, 2).map(function (x) { return x.charAt(0); }).join('') || 'T').toUpperCase();
  }
  function obterLogoDoCadastro(data) {
    var cands = [data && data.logoUrl, data && data.logo, data && data.imagemLogo, data && data.imagem];
    for (var i = 0; i < cands.length; i++) {
      if (typeof cands[i] === 'string' && /^https?:\/\//i.test(cands[i].trim())) return cands[i].trim();
    }
    return '';
  }

  function atualizarIdentidadeTransporte(data, nomeEstab) {
    var logoBox = document.getElementById('modalTransporteLogo');
    var statusEl = document.getElementById('modalTransporteStatus');
    if (logoBox) {
      var url = obterLogoDoCadastro(data);
      if (url && logoBox.getAttribute('data-logo-url') !== url) {
        logoBox.setAttribute('data-logo-url', url);
        logoBox.innerHTML = '';
        var img = document.createElement('img');
        img.src = url;
        img.alt = 'Logo de ' + nomeEstab;
        img.loading = 'eager';
        img.referrerPolicy = 'no-referrer';
        img.onerror = function () {
          logoBox.removeAttribute('data-logo-url');
          logoBox.innerHTML = '<span aria-hidden="true">' + gerarIniciais(nomeEstab) + '</span>';
        };
        logoBox.appendChild(img);
      } else if (!url && !logoBox.querySelector('img')) {
        logoBox.innerHTML = '<span aria-hidden="true">' + gerarIniciais(nomeEstab) + '</span>';
      }
    }
    if (statusEl) {
      var s = statusSeguro(data && data.statusLoja);
      statusEl.className = 'modal-estabelecimento-status status-' + s;
      statusEl.textContent = s === 'aberta' ? 'Disponível' : s === 'pausada' ? 'Serviço pausado' : 'Indisponível';
    }
  }

  window.abrirModalTransporte = function (idx) {
    var est = Cards.dadosProcessados[idx];
    if (!est) { UI.mostrarToast('Estabelecimento não encontrado.'); return; }

    var nomeEstab = est[COLUNAS.NOME];
    var estId = est[COLUNAS.ID_UNICO];
    var logoEstab = est[COLUNAS.IMAGEM] || '';
    var currentLojistaId = null;
    var unsubscribeStatusLoja = null;
    var mapboxMap = null;
    var currentUser = Core.getCurrentUser();

    var rotaState = {
      origem: null,
      destino: null,
      fase: 'origem',
      temp: null
    };

    function getEnderecoCurto(endereco) {
      if (!endereco) return 'Não informado';
      var partes = endereco.split(',');
      if (partes.length >= 2) {
        var rua = partes[0].trim();
        var bairro = partes[1].trim();
        if (bairro.includes('-')) bairro = bairro.split('-')[0].trim();
        return rua + ', ' + bairro;
      }
      return endereco.substring(0, 60);
    }

    function gerarComprovanteTransporte(pedido, codigoCurto) {
      var dados =
        '<h2>Comprovante de Corrida</h2>' +
        '<p style="text-align:center;"><strong>Corrida #' + Core.sanitize(codigoCurto) + '</strong><br>Data: ' + new Date().toLocaleString() + '</p>' +
        '<div class="info">' +
          '<p><strong>Estabelecimento:</strong> ' + Core.sanitize(pedido.estabelecimentoNome || '') + '</p>' +
          '<p><strong>Cliente:</strong> ' + Core.sanitize(pedido.clienteNome || '') + '</p>' +
          '<p><strong>Telefone:</strong> ' + Core.sanitize(pedido.clienteTelefone || '') + '</p>' +
          '<p><strong>Origem:</strong> ' + Core.sanitize(pedido.origem || '') + '</p>' +
          '<p><strong>Destino:</strong> ' + Core.sanitize(pedido.destino || '') + '</p>' +
        '</div>' +
        '<div class="total">Valor: ' + (pedido.total === 0 ? 'A combinar' : 'R$ ' + Number(pedido.total || 0).toFixed(2)) + '</div>' +
        '<p><strong>Observação:</strong> ' + Core.sanitize(pedido.observacao || 'Nenhuma') + '</p>';
      var conteudo =
        '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Comprovante de Corrida</title><style>' +
        'body{font-family:Arial,sans-serif;margin:0;padding:1rem;background:#f2f4f7;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;box-sizing:border-box;}' +
        '.comprovante{width:100%;max-width:600px;background:white;border-radius:1rem;padding:1.5rem;box-shadow:0 2px 10px rgba(0,0,0,0.1);margin:0 auto;}' +
        'h2{color:#0a66c2;text-align:center;font-size:1.3rem;}.info{background:#f8fafc;padding:1rem;border-radius:0.5rem;margin:1rem 0;font-size:0.9rem;}.info p{margin:0.3rem 0;}' +
        '.total{font-weight:bold;font-size:1.2rem;text-align:right;margin-top:1rem;}.obrigado{text-align:center;margin-top:1.5rem;color:#64748b;font-size:0.85rem;}' +
        '@media (max-width:480px){.comprovante{padding:1rem;}h2{font-size:1.1rem;}.info{font-size:0.8rem;}}</style></head><body><div class="comprovante">' + dados + '<p class="obrigado">Obrigado pela preferência!</p></div></body></html>';
      EU.abrirJanelaHTML(conteudo);
    }

    Core.db.collection('lojistas').where('estabelecimentoId', '==', estId).limit(1).get()
      .then(function (snap) {
        if (snap.empty) { UI.mostrarToast('Estabelecimento não configurado para transporte.', 'erro'); return; }
        var lojistaDoc = snap.docs[0];
        currentLojistaId = lojistaDoc.id;
        var lojistaData = lojistaDoc.data();
        logoEstab = obterLogoDoCadastro(lojistaData) || logoEstab;
        var statusLoja = lojistaData.statusLoja || 'aberta';
        var statusMessage = lojistaData.statusMessage || '';
        return Core.db.collection('lojistas').doc(currentLojistaId).collection('tarifas').get()
          .then(function (snapTarifas) {
            var tarifas = [];
            snapTarifas.forEach(function (doc) {
              var data = doc.data();
              tarifas.push({ localidade: data.localidade, taxa: parseFloat(data.valor) || 0 });
            });
            return { statusLoja: statusLoja, statusMessage: statusMessage, tarifas: tarifas, lojistaData: lojistaData };
          });
      })
      .then(function (result) {
        if (!result) return;
        var statusLoja = result.statusLoja;
        var statusMessage = result.statusMessage;
        var tarifas = result.tarifas;

        var logoHtml = logoEstab
          ? '<img src="' + Core.sanitize(logoEstab) + '" alt="Logo" loading="eager" referrerpolicy="no-referrer">'
          : '<span aria-hidden="true">🚕</span>';

        var modalHtml =
          '<div class="modal-overlay" id="modalTransporte" role="dialog" aria-modal="true" aria-labelledby="modalTransporteTitulo">' +
            '<div class="modal-conteudo fullscreen">' +
              '<div class="modal-header">' +
                '<div class="modal-estabelecimento-brand">' +
                  '<div class="modal-estabelecimento-logo" id="modalTransporteLogo">' + logoHtml + '</div>' +
                  '<div class="modal-estabelecimento-meta">' +
                    '<h3 id="modalTransporteTitulo">' + Core.sanitize(nomeEstab) + '</h3>' +
                    '<span id="modalTransporteStatus" class="modal-estabelecimento-status status-aberta">Disponível</span>' +
                  '</div>' +
                '</div>' +
                '<button class="modal-close-btn" data-fechar-modal aria-label="Fechar">×</button>' +
              '</div>' +
              '<div class="modal-tabs">' +
                '<button class="modal-tab active" data-tab="solicitar">📍 Solicitar corrida</button>' +
                '<button class="modal-tab" data-tab="acompanhar">🔍 Acompanhar</button>' +
                (currentUser ? '<button class="modal-tab" data-tab="historico">📋 Histórico</button>' : '') +
              '</div>' +
              '<div class="modal-body">' +
                '<div id="tabSolicitar" class="modal-tab-content active">' +

                  '<div id="statusLojaMsgTransporte" style="display:none;" role="alert"></div>' +

                  '<div class="tp-bloco">' +
                    '<div class="tp-bloco-titulo"><i class="fa-solid fa-route"></i> Rota</div>' +

                    '<div class="rota-chip" id="chipOrigem" style="display:none;">' +
                      '<span class="rota-chip-icone" aria-hidden="true"></span>' +
                      '<span class="rota-chip-texto" id="chipOrigemTexto"></span>' +
                      '<button type="button" class="rota-chip-remover" data-remover="origem" aria-label="Remover origem">×</button>' +
                    '</div>' +

                    '<div class="rota-chip rota-chip-destino" id="chipDestino" style="display:none;">' +
                      '<span class="rota-chip-icone" aria-hidden="true"></span>' +
                      '<span class="rota-chip-texto" id="chipDestinoTexto"></span>' +
                      '<button type="button" class="rota-chip-remover" data-remover="destino" aria-label="Remover destino">×</button>' +
                    '</div>' +

                    '<div class="rota-input-wrap" id="rotaInputWrap" style="display:none;">' +
                      '<div class="rota-input-container" id="rotaInputContainer">' +
                        '<span class="rota-input-icone" aria-hidden="true"></span>' +
                        '<input type="text" id="rotaInput" autocomplete="off" placeholder="De onde você vai sair?" aria-label="Endereço">' +
                      '</div>' +
                      '<button type="button" class="btn-location-modern" id="btnLocalizacaoAtual" title="Usar minha localização" aria-label="Usar minha localização">📍</button>' +
                      '<button type="button" class="btn-confirmar-rota" id="btnConfirmarRota" title="Confirmar endereço digitado" aria-label="Confirmar endereço" disabled>✓</button>' +
                    '</div>' +

                    '<div class="rota-sugestoes" id="rotaSugestoes"></div>' +

                    '<button type="button" id="btnEnderecoManual">Não encontrei meu endereço</button>' +
                  '</div>' +

                  '<div class="tp-bloco tp-bloco-mapa">' +
                    '<div id="mapboxMap"></div>' +
                    '<div id="infoRotaContainer" class="info-viagem" style="display:none;"></div>' +
                  '</div>' +

                  '<div class="tp-bloco">' +
                    '<div class="tp-bloco-titulo"><i class="fa-solid fa-tag"></i> Tarifa</div>' +
                    '<select id="selectTarifa" aria-label="Selecione a tarifa">' +
                      '<option value="">Selecione a tarifa (fixa)</option>' +
                      tarifas.map(function (f) {
                        return '<option value="' + f.taxa + '">' + Core.sanitize(f.localidade) + ' - R$ ' + f.taxa.toFixed(2) + '</option>';
                      }).join('') +
                      '<option value="combinar">💬 Combinar com motorista</option>' +
                    '</select>' +
                  '</div>' +

                  '<div class="tp-bloco">' +
                    '<div class="tp-bloco-titulo"><i class="fa-solid fa-user"></i> Seus dados</div>' +
                    '<div class="form-row">' +
                      '<input type="text" id="clienteNomeTransporte" class="input-pedido" placeholder="Nome*" value="' + Core.sanitize(Core.getUserDisplayName() || '') + '" required aria-label="Seu nome">' +
                      '<input type="tel" id="clienteTelTransporte" class="input-pedido" placeholder="Telefone*" required aria-label="Telefone">' +
                    '</div>' +
                    '<textarea id="obsTransporte" class="input-pedido" placeholder="Observações (opcional)" aria-label="Observações"></textarea>' +
                  '</div>' +

                  '<button class="btn-pedido-cta" id="btnSolicitarCorrida" style="width:100%;">Solicitar corrida</button>' +

                '</div>' +

                '<div id="tabAcompanhar" class="modal-tab-content">' +
                  '<input type="text" id="consultaCodigoTransporte" class="input-pedido" placeholder="Código da corrida" aria-label="Código da corrida">' +
                  '<div style="display:flex; gap:0.5rem;">' +
                    '<button class="btn-consultar-pedido" onclick="consultarCorridaTransporte()" style="flex:1;">Consultar</button>' +
                    '<button class="btn-limpar-historico" onclick="document.getElementById(\'consultaCodigoTransporte\').value=\'\'; document.getElementById(\'resultadoAcompanhamentoTransporte\').innerHTML=\'\';">Limpar</button>' +
                  '</div>' +
                  '<div id="resultadoAcompanhamentoTransporte" style="margin-top:1rem;"></div>' +
                '</div>' +
                (currentUser ? '<div id="tabHistorico" class="modal-tab-content"><div id="listaHistoricoTransporte"></div></div>' : '') +
              '</div>' +
            '</div>' +
          '</div>';

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        var modalTransporteEl = document.getElementById('modalTransporte');
        _abrirModalLocal(modalTransporteEl);

        atualizarIdentidadeTransporte(result.lojistaData, nomeEstab);

        unsubscribeStatusLoja = Core.db.collection('lojistas').doc(currentLojistaId).onSnapshot(function (d) {
          if (!d.exists) return;
          var dt = d.data();
          atualizarIdentidadeTransporte(dt, nomeEstab);
          aplicarBloqueioStatus(statusSeguro(dt.statusLoja), dt.statusMessage || '');
        }, function (err) { console.warn('[transporte] onSnapshot status:', err); });

        var btnSolicitar = document.getElementById('btnSolicitarCorrida');
        var msgStatus = document.getElementById('statusLojaMsgTransporte');

        function aplicarBloqueioStatus(st, m) {
          statusLoja = st;
          statusMessage = m || '';
          var bloqueado = (st === 'fechada' || st === 'pausada');
          if (btnSolicitar) {
            btnSolicitar.disabled = bloqueado;
            btnSolicitar.style.opacity = bloqueado ? '0.5' : '1';
            btnSolicitar.style.pointerEvents = bloqueado ? 'none' : 'auto';
          }
          if (msgStatus) {
            var mostrar = bloqueado || statusMessage !== '';
            if (mostrar) {
              msgStatus.style.display = 'flex';
              msgStatus.className = 'status-' + st;
              if (st === 'fechada') msgStatus.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + Core.sanitize(statusMessage || 'Serviço indisponível no momento.');
              else if (st === 'pausada') msgStatus.innerHTML = '<i class="fa-solid fa-circle-pause"></i> ' + Core.sanitize(statusMessage || 'Serviço pausado no momento.');
              else msgStatus.innerHTML = '<i class="fa-solid fa-circle-info"></i> ' + Core.sanitize(statusMessage);
            } else {
              msgStatus.style.display = 'none';
              msgStatus.innerHTML = '';
            }
          }
        }
        aplicarBloqueioStatus(statusLoja, statusMessage);

        var hasMap = !!(MAPBOX_TOKEN && window.mapboxgl);
        if (!hasMap) {
          var mapaFallback = document.getElementById('mapboxMap');
          if (mapaFallback) mapaFallback.innerHTML = '<div class="mapa-indisponivel"><strong>Mapa indisponível</strong><span>Informe origem e destino manualmente.</span></div>';
        } else {
          mapboxgl.accessToken = MAPBOX_TOKEN;
          mapboxMap = new mapboxgl.Map({
            container: 'mapboxMap',
            style: 'mapbox://styles/mapbox/streets-v12',
            center: RC_CENTER,
            zoom: 12,
            language: 'pt-BR',
            cooperativeGestures: true,
            boxZoom: true,
            attributionControl: false
          });
          mapboxMap.addControl(new mapboxgl.NavigationControl({ showCompass: false }));
        }

        var cacheEstado = 'carregando';
        if (window.EnderecosCache && typeof window.EnderecosCache.carregar === 'function') {
          window.EnderecosCache.carregar()
            .then(function (lista) {
              cacheEstado = 'pronto';
              console.log('[transporte] Endereços carregados:', lista.length);
              if (elInput && elInput.value.trim().length >= 3) atualizarSugestoes();
            })
            .catch(function (err) {
              cacheEstado = 'falhou';
              console.warn('[transporte] Falha ao carregar endereços:', err);
            });
        } else {
          cacheEstado = 'falhou';
          console.warn('[transporte] EnderecosCache não disponível.');
        }

        var elChipOrigem = document.getElementById('chipOrigem');
        var elChipDestino = document.getElementById('chipDestino');
        var elChipOrigemTxt = document.getElementById('chipOrigemTexto');
        var elChipDestinoTxt = document.getElementById('chipDestinoTexto');
        var elInputWrap = document.getElementById('rotaInputWrap');
        var elInputContainer = document.getElementById('rotaInputContainer');
        var elInput = document.getElementById('rotaInput');
        var elBtnLoc = document.getElementById('btnLocalizacaoAtual');
        var elBtnOk = document.getElementById('btnConfirmarRota');
        var elSugestoes = document.getElementById('rotaSugestoes');
        var elBtnManual = document.getElementById('btnEnderecoManual');

        var buscaTimer = null;

        function esconderSugestoes() { elSugestoes.innerHTML = ''; }

        function mostrarMensagemSugestoes(texto) {
          elSugestoes.innerHTML = '<div class="rota-sugestao-vazio">' + texto + '</div>';
        }

        /* ===== Renderização unificada (sugestão | favorito) ===== */
        function renderizarLinha(endereco, opts) {
          opts = opts || {};
          var linha = document.createElement('div');
          linha.className = 'rota-sugestao-linha';

          var btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'rota-sugestao';

          var titulo = (endereco.logradouro || '') +
            (endereco.numero && endereco.numero !== 'SN' ? ', ' + endereco.numero : '');
          var sub = (endereco.bairro ? endereco.bairro : '') +
            (endereco.cep ? ' · CEP ' + endereco.cep : '');
          var address = titulo + (endereco.bairro ? ' - ' + endereco.bairro : '');

          btn.innerHTML =
            '<span class="rota-sugestao-titulo">' + Core.sanitize(titulo) + '</span>' +
            '<span class="rota-sugestao-endereco">' + Core.sanitize(sub) + '</span>';

          btn.addEventListener('click', function () {
            escolherSugestao({
              address: address,
              lat: endereco.lat,
              lng: endereco.lng,
              id: endereco.id,
              logradouro: endereco.logradouro,
              numero: endereco.numero,
              bairro: endereco.bairro,
              cep: endereco.cep,
              fonte: endereco.fonte
            });
          });
          linha.appendChild(btn);

          /* Estrela */
          if (window.EnderecosFavoritos && !opts.semEstrela) {
            var ativo = EnderecosFavoritos.tem(endereco);
            var star = document.createElement('button');
            star.type = 'button';
            star.className = 'rota-sugestao-star' + (ativo ? ' ativo' : '');
            star.setAttribute('aria-label', ativo ? 'Remover dos favoritos' : 'Salvar nos favoritos');
            star.setAttribute('title', ativo ? 'Remover dos favoritos' : 'Salvar nos favoritos');
            star.innerHTML = '<i class="' + (ativo ? 'fa-solid' : 'fa-regular') + ' fa-star" aria-hidden="true"></i>';
            star.addEventListener('click', function (e) {
              e.stopPropagation();
              var agora = EnderecosFavoritos.toggle(endereco);
              star.className = 'rota-sugestao-star' + (agora ? ' ativo' : '');
              star.innerHTML = '<i class="' + (agora ? 'fa-solid' : 'fa-regular') + ' fa-star" aria-hidden="true"></i>';
              star.setAttribute('aria-label', agora ? 'Remover dos favoritos' : 'Salvar nos favoritos');
              star.setAttribute('title', agora ? 'Remover dos favoritos' : 'Salvar nos favoritos');
              UI.mostrarToast(agora ? 'Salvo nos favoritos' : 'Removido dos favoritos');
            });
            linha.appendChild(star);
          }

          /* Lápis */
          if (!opts.semLapis) {
            var flag = document.createElement('button');
            flag.type = 'button';
            flag.className = 'rota-sugestao-flag';
            flag.setAttribute('aria-label', 'Corrigir este endereço');
            flag.setAttribute('title', 'Endereço errado? Toque para corrigir');
            flag.innerHTML = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i><span class="flag-texto">Corrigir</span>';
            flag.addEventListener('click', function (e) {
              e.stopPropagation();
              if (window.Economizei && Economizei.TransporteEnderecos) {
                Economizei.TransporteEnderecos.abrirSugerir(endereco);
              }
            });
            linha.appendChild(flag);
          }

          return linha;
        }

        function mostrarSugestoes(lista) {
          elSugestoes.innerHTML = '';
          if (!lista.length) return;
          lista.forEach(function (sug) {
            elSugestoes.appendChild(renderizarLinha(sug, { semLapis: false }));
          });
        }

        function mostrarFavoritos() {
          if (!window.EnderecosFavoritos) { elSugestoes.innerHTML = ''; return; }
          var lista = EnderecosFavoritos.listar();
          if (!lista.length) { elSugestoes.innerHTML = ''; return; }

          elSugestoes.innerHTML = '';
          var titulo = document.createElement('div');
          titulo.className = 'rota-favoritos-titulo';
          titulo.innerHTML = '<i class="fa-solid fa-star" aria-hidden="true"></i> Favoritos';
          elSugestoes.appendChild(titulo);

          lista.forEach(function (fav) {
            elSugestoes.appendChild(renderizarLinha(fav, { semLapis: true }));
          });
        }

        function escolherSugestao(local) {
          rotaState.temp = local;
          elInput.value = local.address;
          esconderSugestoes();
          elBtnOk.disabled = false;
        }

        function atualizarUI() {
          var fase = rotaState.fase;
          elChipOrigem.style.display = rotaState.origem ? 'flex' : 'none';
          elChipDestino.style.display = rotaState.destino ? 'flex' : 'none';
          if (rotaState.origem) elChipOrigemTxt.textContent = rotaState.origem.address;
          if (rotaState.destino) elChipDestinoTxt.textContent = rotaState.destino.address;

          if (fase === 'completo') {
            elInputWrap.style.display = 'none';
            esconderSugestoes();
            elBtnManual.hidden = true;
          } else {
            elInputWrap.style.display = 'flex';
            elInputContainer.className = 'rota-input-container ' + (fase === 'destino' ? 'fase-destino' : '');
            elInput.placeholder = fase === 'origem' ? 'De onde você vai sair?' : 'Para onde você vai?';
            elInput.value = '';
            elBtnOk.disabled = true;
            elBtnLoc.style.display = fase === 'origem' ? 'flex' : 'none';
            elBtnManual.hidden = false;
            elBtnManual.textContent = 'Não encontrei meu endereço';
            /* Ao entrar em fase, mostra favoritos se tiver */
            if (window.EnderecosFavoritos && EnderecosFavoritos.listar().length) {
              mostrarFavoritos();
            }
          }
        }

        function setFase(f) {
          rotaState.fase = f;
          rotaState.temp = null;
          atualizarUI();
          if (f !== 'completo') setTimeout(function () { elInput.focus(); }, 100);
        }

        function atualizarSugestoes() {
          var q = elInput.value.trim();

          /* Vazio → favoritos */
          if (q.length === 0) {
            mostrarFavoritos();
            return;
          }

          if (q.length < 3) { esconderSugestoes(); return; }

          if (cacheEstado === 'carregando') {
            mostrarMensagemSugestoes('Carregando base de endereços...');
            return;
          }
          if (cacheEstado === 'falhou') {
            esconderSugestoes();
            return;
          }

          var resultado = window.EnderecosCache.buscar(q, 8);
          if (!resultado.length) {
            mostrarMensagemSugestoes('Nenhum endereço encontrado. Clique em ✓ para usar o texto digitado.');
            return;
          }
          mostrarSugestoes(resultado);
        }

        elInput.addEventListener('input', function () {
          elBtnOk.disabled = elInput.value.trim().length < 3;
          rotaState.temp = null;
          if (buscaTimer) clearTimeout(buscaTimer);
          buscaTimer = setTimeout(atualizarSugestoes, 150);
        });

        elInput.addEventListener('focus', function () {
          if (elInput.value.trim().length === 0) mostrarFavoritos();
        });

        elInput.addEventListener('keydown', function (e) {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          if (elBtnOk.disabled) return;
          confirmar();
        });

        function confirmar() {
          var texto = elInput.value.trim();
          if (texto.length < 3) return;
          if (rotaState.temp) { aplicarEscolha(rotaState.temp); return; }
          aplicarEscolha({ address: texto, lat: 0, lng: 0 });
        }
        elBtnOk.addEventListener('click', confirmar);

        function aplicarEscolha(local) {
          var fase = rotaState.fase;
          if (fase === 'origem') rotaState.origem = local;
          else if (fase === 'destino') rotaState.destino = local;

          rotaState.temp = null;
          esconderSugestoes();

          if (rotaState.origem && rotaState.destino) rotaState.fase = 'completo';
          else if (rotaState.origem) rotaState.fase = 'destino';
          else rotaState.fase = 'origem';

          atualizarUI();

          if (rotaState.fase === 'completo') calcularRota();
          else setTimeout(function () { elInput.focus(); }, 100);
        }

        document.querySelectorAll('[data-remover]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var tipo = btn.dataset.remover;
            if (tipo === 'origem') { rotaState.origem = null; setFase('origem'); }
            else { rotaState.destino = null; setFase('destino'); }
            limparRotaDoMapa();
          });
        });

        elBtnLoc.addEventListener('click', function () {
          if (!hasMap) { UI.mostrarToast('Localização indisponível.', 'erro'); return; }
          if (!navigator.geolocation) { UI.mostrarToast('Geolocalização não suportada.', 'erro'); return; }
          elBtnLoc.disabled = true;
          navigator.geolocation.getCurrentPosition(function (pos) {
            elBtnLoc.disabled = false;
            var lat = pos.coords.latitude, lng = pos.coords.longitude;
            fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/' + lng + ',' + lat + '.json?access_token=' + MAPBOX_TOKEN + '&language=pt&country=br')
              .then(function (r) { return r.json(); })
              .then(function (data) {
                var endereco = (data.features && data.features.length) ? data.features[0].place_name : (lat.toFixed(5) + ', ' + lng.toFixed(5));
                aplicarEscolha({ address: endereco, lat: lat, lng: lng });
                UI.mostrarToast('Localização inserida!');
              })
              .catch(function () {
                aplicarEscolha({ address: lat.toFixed(5) + ', ' + lng.toFixed(5), lat: lat, lng: lng });
              });
          }, function (err) {
            elBtnLoc.disabled = false;
            UI.mostrarToast('Erro ao obter localização: ' + err.message, 'erro');
          }, { enableHighAccuracy: true, timeout: 10000 });
        });

        elBtnManual.addEventListener('click', function () {
          if (!window.Economizei || !Economizei.TransporteEnderecos) {
            UI.mostrarToast('Recurso indisponível no momento.', 'erro');
            return;
          }
          Economizei.TransporteEnderecos.abrirMarcar(function (novoEnd) {
            aplicarEscolha(novoEnd);
          });
        });

        var rotaCamadaId = 'rota-direcao-' + Date.now();

        function limparRotaDoMapa() {
          var info = document.getElementById('infoRotaContainer');
          if (info) info.style.display = 'none';
          if (mapboxMap && mapboxMap.getLayer(rotaCamadaId)) {
            mapboxMap.removeLayer(rotaCamadaId);
            mapboxMap.removeSource(rotaCamadaId);
          }
        }

        function calcularRota() {
          var info = document.getElementById('infoRotaContainer');
          if (!rotaState.origem || !rotaState.destino) return;
          if (!rotaState.origem.lat || !rotaState.destino.lat) {
            info.style.display = 'flex';
            info.innerHTML = 'Endereços informados manualmente — rota não calculada.';
            return;
          }
          if (!hasMap) return;
          info.style.display = 'flex';
          info.innerHTML = '🔄 Calculando rota...';
          var url = 'https://api.mapbox.com/directions/v5/mapbox/driving/' +
            rotaState.origem.lng + ',' + rotaState.origem.lat + ';' +
            rotaState.destino.lng + ',' + rotaState.destino.lat +
            '?access_token=' + MAPBOX_TOKEN + '&geometries=geojson&overview=full';
          fetch(url)
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
                info.innerHTML = '❌ Não foi possível calcular a rota.';
                return;
              }
              var route = data.routes[0];
              var leg = route.legs[0];
              var distancia = (leg.distance / 1000).toFixed(1) + ' km';
              var duracao = Math.round(leg.duration / 60) + ' min';
              info.innerHTML = '<strong>Distância:</strong> ' + distancia + ' &nbsp;·&nbsp; <strong>Tempo:</strong> ' + duracao;
              if (mapboxMap.getLayer(rotaCamadaId)) { mapboxMap.removeLayer(rotaCamadaId); mapboxMap.removeSource(rotaCamadaId); }
              mapboxMap.addSource(rotaCamadaId, { type: 'geojson', data: { type: 'Feature', geometry: route.geometry, properties: {} } });
              mapboxMap.addLayer({
                id: rotaCamadaId, type: 'line', source: rotaCamadaId,
                layout: { 'line-join': 'round', 'line-cap': 'round' },
                paint: { 'line-color': '#0a66c2', 'line-width': 5 }
              });
              var bounds = new mapboxgl.LngLatBounds();
              route.geometry.coordinates.forEach(function (c) { bounds.extend(c); });
              mapboxMap.fitBounds(bounds, { padding: 40 });
            })
            .catch(function (err) { info.innerHTML = '❌ Erro ao calcular rota: ' + err.message; });
        }

        window.consultarCorridaTransporte = function () {
          var cod = document.getElementById('consultaCodigoTransporte').value.trim().toUpperCase();
          var resDiv = document.getElementById('resultadoAcompanhamentoTransporte');
          if (!cod) { resDiv.innerHTML = '<p style="color:#dc3545;">Digite o código da corrida.</p>'; return; }
          Core.db.collection('pedidos').where('codigoCurto', '==', cod).limit(1).get()
            .then(function (snap) {
              if (snap.empty) { resDiv.innerHTML = '<p style="color:#dc3545;">🔍 Corrida não encontrada.</p>'; return; }
              var p = snap.docs[0].data();
              var statusMap = {
                'pendente': { label: 'Aguardando motorista', icon: '⏳', color: '#f59e0b' },
                'confirmado': { label: 'Motorista aceitou', icon: '✅', color: '#10b981' },
                'a_caminho': { label: 'Motorista a caminho', icon: '🚗', color: '#6366f1' },
                'em_curso': { label: 'Corrida em andamento', icon: '🛣️', color: '#3b82f6' },
                'concluido': { label: 'Concluída', icon: '🏁', color: '#10b981' },
                'cancelado': { label: 'Cancelado', icon: '❌', color: '#ef4444' }
              };
              var s = statusMap[p.status] || statusMap.pendente;
              resDiv.innerHTML = '<div style="background:' + s.color + '10; border:2px solid ' + s.color + '; border-radius:1rem; padding:1rem;">' +
                '<div style="text-align:center;"><span style="font-size:2rem;">' + s.icon + '</span><h3 style="color:' + s.color + ';">' + s.label + '</h3></div>' +
                '<p><strong>Data:</strong> ' + (p.criadoEm ? new Date(p.criadoEm.toDate()).toLocaleString() : '---') + '</p>' +
                '<p><strong>Origem:</strong> ' + Core.sanitize(getEnderecoCurto(p.origem)) + '</p>' +
                '<p><strong>Destino:</strong> ' + Core.sanitize(getEnderecoCurto(p.destino)) + '</p>' +
                '<p><strong>Valor:</strong> ' + (p.total === 0 ? 'A combinar' : 'R$ ' + Number(p.total).toFixed(2)) + '</p></div>';
            });
        };

        function carregarHistoricoTransporte(estIdLocal) {
          if (!Core.getCurrentUser()) return;
          var container = document.getElementById('listaHistoricoTransporte');
          if (!container) return;
          Core.db.collection('pedidos')
            .where('clienteId', '==', Core.getCurrentUser().uid)
            .where('estabelecimentoId', '==', estIdLocal)
            .orderBy('criadoEm', 'desc').limit(20).get()
            .then(function (snap) {
              if (snap.empty) { container.innerHTML = '<p>Nenhuma corrida anterior.</p>'; return; }
              var html = '';
              snap.forEach(function (doc) {
                var p = doc.data();
                var codigo = p.codigoCurto || doc.id.slice(0, 6).toUpperCase();
                html += '<div style="border:1px solid var(--gray-200); border-radius:0.75rem; padding:0.75rem; margin-bottom:0.5rem; background:white;">' +
                  '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">' +
                    '<div><strong>#' + Core.sanitize(codigo) + '</strong> <span style="background:' + (p.status === 'pendente' ? '#fff7ed' : p.status === 'concluido' ? '#ecfdf5' : '#f1f5f9') + '; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.7rem;">' + Core.sanitize(p.status || 'pendente') + '</span></div>' +
                    '<div>' + (p.criadoEm ? new Date(p.criadoEm.toDate()).toLocaleString() : '---') + '</div>' +
                  '</div>' +
                  '<div><strong>Origem:</strong> ' + Core.sanitize(getEnderecoCurto(p.origem)) + '</div>' +
                  '<div><strong>Destino:</strong> ' + Core.sanitize(getEnderecoCurto(p.destino)) + '</div>' +
                  '<div><strong>Valor:</strong> ' + (p.total === 0 ? 'A combinar' : 'R$ ' + Number(p.total).toFixed(2)) + '</div>' +
                  '<button class="btn-acao btn-qrcode" style="margin-top:0.5rem;" data-transporte-id="' + doc.id + '">🖨️ Ver comprovante</button>' +
                '</div>';
              });
              container.innerHTML = html;
              container.querySelectorAll('[data-transporte-id]').forEach(function (btn) {
                btn.addEventListener('click', function () {
                  var id = btn.dataset.transporteId;
                  Core.db.collection('pedidos').doc(id).get().then(function (d) {
                    if (d.exists) {
                      var p = d.data();
                      gerarComprovanteTransporte(p, p.codigoCurto || id.slice(0, 6).toUpperCase());
                    }
                  });
                });
              });
            });
        }

        window.fecharModalTransporte = function () {
          if (unsubscribeStatusLoja) { unsubscribeStatusLoja(); unsubscribeStatusLoja = null; }
          var modal = document.getElementById('modalTransporte');
          if (mapboxMap) { mapboxMap.remove(); mapboxMap = null; }
          _fecharModalLocal(modal);
        };

        document.querySelectorAll('#modalTransporte .modal-tab').forEach(function (tab) {
          tab.onclick = function () {
            document.querySelectorAll('#modalTransporte .modal-tab').forEach(function (t) { t.classList.remove('active'); });
            tab.classList.add('active');
            document.querySelectorAll('#modalTransporte .modal-tab-content').forEach(function (c) { c.classList.remove('active'); });
            var contentId = 'tab' + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
            var el = document.getElementById(contentId);
            if (el) el.classList.add('active');
            if (tab.dataset.tab === 'historico' && Core.getCurrentUser()) carregarHistoricoTransporte(estId);
          };
        });

        document.getElementById('btnSolicitarCorrida').onclick = function () {
          if (statusLoja !== 'aberta') { UI.mostrarToast('Serviço indisponível no momento.', 'erro'); return; }
          if (!rotaState.origem || !rotaState.destino) {
            UI.mostrarToast('Escolha origem e destino.', 'erro');
            return;
          }
          var nome = document.getElementById('clienteNomeTransporte').value.trim();
          var tel = document.getElementById('clienteTelTransporte').value.trim();
          var tarifaSelect = document.getElementById('selectTarifa');
          var taxaEntrega = 0, total = 0;
          if (tarifaSelect.value === 'combinar') { taxaEntrega = 0; total = 0; }
          else if (tarifaSelect.value) { taxaEntrega = parseFloat(tarifaSelect.value); total = taxaEntrega; }
          else { UI.mostrarToast('Selecione uma tarifa ou "Combinar com motorista".', 'erro'); return; }
          if (!nome || nome.length < 2) { UI.mostrarToast('Informe seu nome completo.', 'erro'); return; }
          var telNumerico = tel.replace(/\D/g, '');
          if (!telNumerico || telNumerico.length < 10) { UI.mostrarToast('Telefone inválido. Informe DDD + número.', 'erro'); return; }

          var origem = rotaState.origem.address;
          var destino = rotaState.destino.address;
          var latOrigem = rotaState.origem.lat || 0;
          var lngOrigem = rotaState.origem.lng || 0;
          var latDestino = rotaState.destino.lat || 0;
          var lngDestino = rotaState.destino.lng || 0;

          EU.salvarDadosClienteLocal(nome, telNumerico, origem + ' → ' + destino);

          var codigoCurto = Math.random().toString(36).substring(2, 8).toUpperCase();
          var pedido = {
            estabelecimentoId: estId, estabelecimentoNome: nomeEstab,
            clienteId: Core.getCurrentUser() ? Core.getCurrentUser().uid : null,
            clienteNome: nome, clienteTelefone: telNumerico,
            origem: origem, destino: destino,
            origem_lat: latOrigem, origem_lng: lngOrigem,
            destino_lat: latDestino, destino_lng: lngDestino,
            taxaEntrega: taxaEntrega, total: total,
            status: 'pendente', codigoCurto: codigoCurto,
            observacao: document.getElementById('obsTransporte').value,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
          };
          Core.db.collection('pedidos').add(pedido)
            .then(function () {
              EU.mostrarPopupConfirmacao({
                titulo: '✅ Corrida solicitada!',
                mensagem: 'Sua corrida foi solicitada com sucesso!',
                codigo: codigoCurto,
                botoes:
                  '<button class="btn-adicionar-filtro" onclick="fecharModalTransporte();">🔍 Acompanhar</button>' +
                  '<button class="btn-adicionar-filtro" style="background:#2c3e50;" data-transporte-comprovante="1">🖨️ Comprovante</button>',
                onClose: 'fecharModalTransporte()'
              });
              setTimeout(function () {
                var botoesPop = document.querySelectorAll('.popup-confirmacao-botoes button');
                if (botoesPop.length >= 2) {
                  botoesPop[1].onclick = function () {
                    gerarComprovanteTransporte(pedido, codigoCurto);
                    var pop = document.querySelector('.popup-confirmacao');
                    if (pop) pop.remove();
                  };
                }
              }, 0);
            })
            .catch(function (err) { UI.mostrarToast('Erro ao enviar: ' + err.message, 'erro'); });
        };

        var saved = EU.carregarDadosClienteLocal();
        if (saved) {
          if (saved.nome && document.getElementById('clienteNomeTransporte')) document.getElementById('clienteNomeTransporte').value = saved.nome;
          if (saved.telefone && document.getElementById('clienteTelTransporte')) document.getElementById('clienteTelTransporte').value = saved.telefone;
        }
        EU.aplicarMascaraTelefone(document.getElementById('clienteTelTransporte'));

        /* Favoritos mudam em outra aba / outro modal → re-renderiza */
        if (window.EnderecosFavoritos) {
          EnderecosFavoritos.onChange(function () {
            if (!elInput) return;
            if (elInput.value.trim().length === 0) mostrarFavoritos();
          });
        }

        atualizarUI();
      })
      .catch(function (err) {
        UI.mostrarToast('Erro ao carregar dados: ' + err.message, 'erro');
      });
  };

  window.Economizei.Transporte = { abrirModal: window.abrirModalTransporte };

})();
