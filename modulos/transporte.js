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

  /* Rio Claro — RJ */
  var RC_CENTER = [-44.135, -22.723];
  var RC_BBOX   = [-44.30, -22.90, -43.95, -22.55];

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

    /* ===== Estado da rota ===== */
    var rotaState = {
      origem: null,   // { lat, lng, address }
      destino: null,
      fase: 'origem', // 'origem' | 'destino' | 'completo'
      manualMode: false
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

                  /* Bloco Rota — fluxo sequencial */
                  '<div class="tp-bloco">' +
                    '<div class="tp-bloco-titulo"><i class="fa-solid fa-route"></i> Rota</div>' +

                    '<div id="rotaEscolha">' +
                      '<div class="search-field-group" id="rotaGeocoderWrap">' +
                        '<div class="search-field-container" id="rotaIconeContainer">' +
                          '<div id="rotaGeocoder" style="flex:1;"></div>' +
                        '</div>' +
                        '<button class="btn-location-modern" id="btnLocalizacaoRota" type="button" title="Usar minha localização" aria-label="Usar minha localização">📍</button>' +
                      '</div>' +
                      '<div class="search-field-group" id="rotaManualWrap" style="display:none;">' +
                        '<div class="search-field-container" id="rotaManualIconeContainer">' +
                          '<input type="text" id="inputManualRota" class="input-endereco-manual" placeholder="De onde você vai sair?" aria-label="Endereço">' +
                        '</div>' +
                        '<button class="btn-location-modern" id="btnLocalizacaoManual" type="button" title="Usar minha localização" aria-label="Usar minha localização">📍</button>' +
                      '</div>' +
                      '<button type="button" id="btnEnderecoManual">Não encontrei meu endereço</button>' +
                    '</div>' +

                    '<div id="rotaResumo" class="rota-resumo" style="display:none;">' +
                      '<div class="rota-chip rota-chip-origem">' +
                        '<span class="rota-chip-icone" aria-hidden="true"></span>' +
                        '<span class="rota-chip-texto" id="rotaChipOrigemTexto"></span>' +
                        '<button type="button" class="rota-chip-remover" id="btnRemoverOrigem" aria-label="Remover origem">×</button>' +
                      '</div>' +
                      '<div class="rota-chip rota-chip-destino">' +
                        '<span class="rota-chip-icone" aria-hidden="true"></span>' +
                        '<span class="rota-chip-texto" id="rotaChipDestinoTexto"></span>' +
                        '<button type="button" class="rota-chip-remover" id="btnRemoverDestino" aria-label="Remover destino">×</button>' +
                      '</div>' +
                    '</div>' +

                  '</div>' +

                  /* Bloco Mapa */
                  '<div class="tp-bloco tp-bloco-mapa">' +
                    '<div id="mapboxMap"></div>' +
                    '<div id="infoRotaContainer" class="info-viagem" style="display:none;"></div>' +
                  '</div>' +

                  /* Bloco Tarifa */
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

                  /* Bloco Seus dados */
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
              if (st === 'fechada') {
                msgStatus.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> ' + Core.sanitize(statusMessage || 'Serviço indisponível no momento.');
              } else if (st === 'pausada') {
                msgStatus.innerHTML = '<i class="fa-solid fa-circle-pause"></i> ' + Core.sanitize(statusMessage || 'Serviço pausado no momento.');
              } else {
                msgStatus.innerHTML = '<i class="fa-solid fa-circle-info"></i> ' + Core.sanitize(statusMessage);
              }
            } else {
              msgStatus.style.display = 'none';
              msgStatus.innerHTML = '';
            }
          }
        }
        aplicarBloqueioStatus(statusLoja, statusMessage);

        /* ===== Inicializar mapa (se token disponível) ===== */
        if (!MAPBOX_TOKEN || !window.mapboxgl || !window.MapboxGeocoder) {
          rotaState.manualMode = true;
          var geocoderWrap = document.getElementById('rotaGeocoderWrap');
          var manualWrap = document.getElementById('rotaManualWrap');
          var mapaFallback = document.getElementById('mapboxMap');
          var botaoManualFallback = document.getElementById('btnEnderecoManual');
          if (geocoderWrap) geocoderWrap.style.display = 'none';
          if (manualWrap) manualWrap.style.display = 'flex';
          if (botaoManualFallback) botaoManualFallback.style.display = 'none';
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

          var geocoderOpts = {
            accessToken: MAPBOX_TOKEN,
            language: 'pt-BR',
            country: 'br',
            bbox: RC_BBOX,
            proximity: RC_CENTER,
            marker: false,
            fuzzyMatch: true,
            limit: 6,
            placeholder: 'De onde você vai sair?'
          };

          var geocoderRota = new MapboxGeocoder(geocoderOpts);
          geocoderRota.addTo(document.getElementById('rotaGeocoder'));
          geocoderRota.on('result', function (e) {
            if (!e.result || !e.result.center) return;
            processarSelecaoRota({
              lat: e.result.center[1],
              lng: e.result.center[0],
              address: e.result.place_name
            });
          });
        }

        /* ===== Estado da UI da rota ===== */
        function atualizarRotaUI() {
          var elEscolha = document.getElementById('rotaEscolha');
          var elResumo = document.getElementById('rotaResumo');
          var elIcone = document.getElementById('rotaIconeContainer');
          var elIconeManual = document.getElementById('rotaManualIconeContainer');
          var btnLoc = document.getElementById('btnLocalizacaoRota');
          var inpManual = document.getElementById('inputManualRota');

          if (rotaState.fase === 'completo') {
            if (elEscolha) elEscolha.style.display = 'none';
            if (elResumo) elResumo.style.display = 'flex';
            document.getElementById('rotaChipOrigemTexto').textContent = rotaState.origem.address;
            document.getElementById('rotaChipDestinoTexto').textContent = rotaState.destino.address;
          } else {
            if (elEscolha) elEscolha.style.display = 'block';
            if (elResumo) elResumo.style.display = 'none';

            /* Bolinha/quadrado da origem/destino */
            var faseClass = rotaState.fase === 'destino' ? 'rota-fase-destino' : '';
            if (elIcone) elIcone.className = 'search-field-container ' + faseClass;
            if (elIconeManual) elIconeManual.className = 'search-field-container ' + faseClass;

            /* Placeholder do geocoder */
            var inpGeo = document.querySelector('#rotaGeocoder input');
            if (inpGeo) {
              inpGeo.value = '';
              inpGeo.placeholder = rotaState.fase === 'origem' ? 'De onde você vai sair?' : 'Para onde você vai?';
            }
            /* Placeholder do manual */
            if (inpManual) {
              inpManual.value = '';
              inpManual.placeholder = rotaState.fase === 'origem' ? 'Descreva a origem' : 'Descreva o destino';
            }

            /* Botão de localização só na fase origem */
            if (btnLoc) btnLoc.style.display = rotaState.fase === 'origem' ? 'flex' : 'none';
            var btnLocManual = document.getElementById('btnLocalizacaoManual');
            if (btnLocManual) btnLocManual.style.display = rotaState.fase === 'origem' ? 'flex' : 'none';
          }
        }

        function processarSelecaoRota(local) {
          if (rotaState.fase === 'origem') {
            rotaState.origem = local;
            rotaState.fase = rotaState.destino ? 'completo' : 'destino';
          } else if (rotaState.fase === 'destino') {
            rotaState.destino = local;
            rotaState.fase = 'completo';
          }
          atualizarRotaUI();
          if (rotaState.fase === 'completo') {
            if (mapboxMap) calcularRotaTransporte();
          }
        }

        /* ===== Chip remover ===== */
        document.getElementById('btnRemoverOrigem').addEventListener('click', function () {
          rotaState.origem = null;
          rotaState.fase = 'origem';
          atualizarRotaUI();
          limparRotaDoMapa();
        });
        document.getElementById('btnRemoverDestino').addEventListener('click', function () {
          rotaState.destino = null;
          rotaState.fase = 'destino';
          atualizarRotaUI();
          limparRotaDoMapa();
        });

        /* ===== Toggle manual ===== */
        var btnManualToggle = document.getElementById('btnEnderecoManual');
        if (btnManualToggle) {
          btnManualToggle.addEventListener('click', function () {
            var geoWrap = document.getElementById('rotaGeocoderWrap');
            var manWrap = document.getElementById('rotaManualWrap');
            var estaManual = manWrap.style.display === 'flex';
            if (estaManual) {
              manWrap.style.display = 'none';
              geoWrap.style.display = 'flex';
              btnManualToggle.textContent = 'Não encontrei meu endereço';
            } else {
              manWrap.style.display = 'flex';
              geoWrap.style.display = 'none';
              btnManualToggle.textContent = '← Voltar para busca no mapa';
              var inp = document.getElementById('inputManualRota');
              if (inp) setTimeout(function () { inp.focus(); }, 100);
            }
          });
        }

        /* ===== Manual: Enter processa ===== */
        var inputManualRota = document.getElementById('inputManualRota');
        if (inputManualRota) {
          inputManualRota.addEventListener('keydown', function (e) {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            var txt = inputManualRota.value.trim();
            if (!txt || txt.length < 3) return;
            if (MAPBOX_TOKEN) {
              fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/' + encodeURIComponent(txt) + '.json?access_token=' + MAPBOX_TOKEN + '&language=pt&country=br&limit=1&proximity=' + RC_CENTER.join(',') + '&bbox=' + RC_BBOX.join(','))
                .then(function (r) { return r.json(); })
                .then(function (data) {
                  if (data.features && data.features.length > 0) {
                    var f = data.features[0];
                    processarSelecaoRota({ lat: f.center[1], lng: f.center[0], address: f.place_name });
                  } else {
                    processarSelecaoRota({ lat: 0, lng: 0, address: txt });
                  }
                })
                .catch(function () {
                  processarSelecaoRota({ lat: 0, lng: 0, address: txt });
                });
            } else {
              processarSelecaoRota({ lat: 0, lng: 0, address: txt });
            }
          });
        }

        /* ===== Localização atual ===== */
        function usarLocalizacaoAtual() {
          if (!MAPBOX_TOKEN) { UI.mostrarToast('A localização automática está indisponível. Informe a origem manualmente.', 'erro'); return; }
          if (!navigator.geolocation) { UI.mostrarToast('Geolocalização não suportada.', 'erro'); return; }
          navigator.geolocation.getCurrentPosition(function (pos) {
            var lat = pos.coords.latitude, lng = pos.coords.longitude;
            fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/' + lng + ',' + lat + '.json?access_token=' + MAPBOX_TOKEN + '&language=pt&country=br')
              .then(function (res) { return res.json(); })
              .then(function (data) {
                var endereco = (data.features && data.features.length) ? data.features[0].place_name : (lat.toFixed(5) + ', ' + lng.toFixed(5));
                processarSelecaoRota({ lat: lat, lng: lng, address: endereco });
                UI.mostrarToast('Localização inserida!');
              });
          }, function (err) { UI.mostrarToast('Erro ao obter localização: ' + err.message, 'erro'); }, { enableHighAccuracy: true, timeout: 10000 });
        }
        var b1 = document.getElementById('btnLocalizacaoRota');
        if (b1) b1.addEventListener('click', usarLocalizacaoAtual);
        var b2 = document.getElementById('btnLocalizacaoManual');
        if (b2) b2.addEventListener('click', usarLocalizacaoAtual);

        /* ===== Calcular rota ===== */
        var rotaCamadaId = 'rota-direcao-' + Date.now();

        function limparRotaDoMapa() {
          var info = document.getElementById('infoRotaContainer');
          if (info) info.style.display = 'none';
          if (mapboxMap && mapboxMap.getLayer(rotaCamadaId)) {
            mapboxMap.removeLayer(rotaCamadaId);
            mapboxMap.removeSource(rotaCamadaId);
          }
        }

        function calcularRotaTransporte() {
          if (!rotaState.origem || !rotaState.destino) return;
          if (!rotaState.origem.lat || !rotaState.destino.lat) {
            var info = document.getElementById('infoRotaContainer');
            info.style.display = 'flex';
            info.innerHTML = 'Endereços informados manualmente — rota não calculada.';
            return;
          }
          var info = document.getElementById('infoRotaContainer');
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

        /* ===== Consultar corrida ===== */
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

        /* ===== Histórico ===== */
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

        /* ===== Abas ===== */
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

        /* ===== Solicitar corrida ===== */
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

        /* Estado inicial da UI da rota */
        atualizarRotaUI();
      })
      .catch(function (err) {
        UI.mostrarToast('Erro ao carregar dados: ' + err.message, 'erro');
      });
  };

  window.Economizei.Transporte = { abrirModal: window.abrirModalTransporte };

})();
