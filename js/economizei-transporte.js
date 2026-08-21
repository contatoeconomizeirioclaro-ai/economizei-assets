/*
 * economizei-transporte.js
 * Módulo frontend público de Transporte.
 * Carregar depois de economizei-core.js e antes da interação da página.
 * Não embute core, shell Blogger ou módulo Pedidos.
 */
(function() {
    'use strict';
    if (!window.Economizei) window.Economizei = {};
    if (!document.getElementById('economizei-transporte-config-style')) {
        var transporteConfigStyle = document.createElement('style');
        transporteConfigStyle.id = 'economizei-transporte-config-style';
        transporteConfigStyle.textContent = '.mapa-indisponivel{min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.35rem;padding:1rem;border:1px dashed #cbd5e1;border-radius:1rem;background:#f8fafc;color:#475569;text-align:center;font-size:.8rem}.mapa-indisponivel strong{color:#334155;font-size:.9rem}';
        document.head.appendChild(transporteConfigStyle);
    }
// MÓDULO TRANSPORTE – COMPLETO E FUNCIONAL (integrado ao visual padronizado)
    // ============================================================

    var MAPBOX_TOKEN = (window.ECONOMIZEI_CONFIG && window.ECONOMIZEI_CONFIG.mapboxToken) || window.ECONOMIZEI_MAPBOX_TOKEN || '';

    window.abrirModalTransporte = function(idx) {
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
        var estId = est[COLUNAS.ID_UNICO];
        var fretes = [];
        var currentLojistaId = null;
        var mapboxMap = null;
        var directionsRenderer = null;
        var directionsService = null;
        var currentMapboxOrigin = null;
        var currentMapboxDest = null;
        var currentUser = Core.getCurrentUser();

        // ===== FUNÇÕES AUXILIARES =====
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
            var dados = '<h2>Comprovante de Corrida</h2>' +
                '<p style="text-align:center;"><strong>Corrida #' + codigoCurto + '</strong><br>Data: ' + new Date().toLocaleString() + '</p>' +
                '<div class="info"><p><strong>Estabelecimento:</strong> ' + pedido.estabelecimentoNome + '</p>' +
                '<p><strong>Cliente:</strong> ' + pedido.clienteNome + '</p>' +
                '<p><strong>Telefone:</strong> ' + pedido.clienteTelefone + '</p>' +
                '<p><strong>Origem:</strong> ' + pedido.origem + '</p>' +
                '<p><strong>Destino:</strong> ' + pedido.destino + '</p></div>' +
                '<div class="total">Valor: ' + (pedido.total === 0 ? 'A combinar' : 'R$ ' + pedido.total.toFixed(2)) + '</div>' +
                '<p><strong>Observação:</strong> ' + (pedido.observacao || 'Nenhuma') + '</p>';
            var conteudo = '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Comprovante de Corrida</title><style>' +
                'body{font-family:Arial,sans-serif;margin:0;padding:1rem;background:#f2f4f7;display:flex;justify-content:center;align-items:flex-start;min-height:100vh;box-sizing:border-box;}' +
                '.comprovante{width:100%;max-width:600px;background:white;border-radius:1rem;padding:1.5rem;box-shadow:0 2px 10px rgba(0,0,0,0.1);margin:0 auto;}' +
                'h2{color:#0a66c2;text-align:center;font-size:1.3rem;}.info{background:#f8fafc;padding:1rem;border-radius:0.5rem;margin:1rem 0;font-size:0.9rem;}.info p{margin:0.3rem 0;}' +
                '.total{font-weight:bold;font-size:1.2rem;text-align:right;margin-top:1rem;}.obrigado{text-align:center;margin-top:1.5rem;color:#64748b;font-size:0.85rem;}' +
                '@media (max-width:480px){.comprovante{padding:1rem;}h2{font-size:1.1rem;}.info{font-size:0.8rem;}}</style></head><body><div class="comprovante">' + dados + '<p class="obrigado">Obrigado pela preferência!</p></div></body></html>';
            var win = window.open();
            win.document.write(conteudo);
            win.document.close();
        }

        function mostrarPopupConfirmacaoTransporte(opcoes) {
            var overlay = document.createElement('div');
            overlay.className = 'popup-confirmacao';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', opcoes.titulo);
            overlay.innerHTML = '<div class="popup-confirmacao-card">' +
                '<div class="popup-confirmacao-header"><h3>' + opcoes.titulo + '</h3><button class="btn-favorito" style="color:white;" onclick="this.closest(\'.popup-confirmacao\').remove()" aria-label="Fechar">&times;</button></div>' +
                '<div class="popup-confirmacao-body"><p>Sua corrida foi solicitada com sucesso!</p>' +
                '<div class="popup-confirmacao-codigo"><p class="label">Código</p><p class="valor">#' + opcoes.codigo + '</p>' +
                '<button class="btn-adicionar-filtro" style="background:white;color:var(--primary);border:1px solid var(--primary);padding:0.5rem 1rem;margin-top:0.5rem;" onclick="navigator.clipboard.writeText(\'' + opcoes.codigo + '\').then(()=>alert(\'Código copiado!\'))">📋 Copiar código</button></div>' +
                '<div class="popup-confirmacao-botoes">' + opcoes.botoes + '</div></div>' +
                '<div class="popup-confirmacao-footer"><button class="btn-modal-fechar" onclick="this.closest(\'.popup-confirmacao\').remove(); ' + (opcoes.onClose || '') + '">Fechar</button></div></div>';
            document.body.appendChild(overlay);
            UI.trapFocus(overlay);
        }

        // ===== BUSCAR TARIFAS E DADOS DO LOJISTA =====
        Core.db.collection('lojistas').where('estabelecimentoId', '==', estId).limit(1).get()
            .then(function(snap) {
                if (snap.empty) {
                    UI.mostrarToast('Estabelecimento não configurado para transporte.', 'erro');
                    return;
                }
                var lojistaDoc = snap.docs[0];
                currentLojistaId = lojistaDoc.id;
                var lojistaData = lojistaDoc.data();
                var statusLoja = lojistaData.statusLoja || 'aberta';
                var statusMessage = lojistaData.statusMessage || '';

                return Core.db.collection('lojistas').doc(currentLojistaId).collection('tarifas').get()
                    .then(function(snapTarifas) {
                        var tarifas = [];
                        snapTarifas.forEach(function(doc) {
                            var data = doc.data();
                            tarifas.push({ localidade: data.localidade, taxa: parseFloat(data.valor) || 0 });
                        });
                        return { statusLoja: statusLoja, statusMessage: statusMessage, tarifas: tarifas };
                    });
            })
            .then(function(result) {
                var statusLoja = result.statusLoja;
                var statusMessage = result.statusMessage;
                var tarifas = result.tarifas;

                // ===== CONSTRUIR MODAL HTML (VISUAL PADRONIZADO) =====
                var modalHtml = '<div class="modal-overlay" id="modalTransporte" style="display:flex;">' +
                    '<div class="modal-conteudo fullscreen">' +
                    '<div class="modal-header"><h3>🚕 ' + Core.sanitize(nomeEstab) + '</h3>' +
                    '<button class="btn-modal-fechar" onclick="fecharModalTransporte()" aria-label="Fechar">✕</button></div>' +
                    '<div class="modal-tabs">' +
                    '<button class="modal-tab active" data-tab="solicitar">📍 Solicitar corrida</button>' +
                    '<button class="modal-tab" data-tab="acompanhar">🔍 Acompanhar</button>' +
                    (currentUser ? '<button class="modal-tab" data-tab="historico">📋 Histórico</button>' : '') +
                    '</div>' +
                    '<div class="modal-body">' +
                    // ABA SOLICITAR
                    '<div id="tabSolicitar" class="modal-tab-content active">' +
                    '<div id="statusLojaMsgTransporte" style="display:none; background:#fef3c7; border:1px solid #f59e0b; border-radius:0.75rem; padding:0.75rem; margin-bottom:0.75rem; text-align:center; font-weight:600; color:#92400e;" role="alert"></div>' +
                    '<div class="search-fields-wrapper">' +
                    '<div id="geocoderContainer">' +
                    '<div class="search-field-group">' +
                    '<div class="search-field-container"><div id="origemGeocoder" style="flex:1;"></div>' +
                    '<button class="clear-btn" id="clearOrigemMapa" onclick="limparCampoTransporte(\'origemMapa\')">&times;</button></div>' +
                    '<button class="btn-location-modern" id="btnLocalizacaoMapa" onclick="usarLocalizacaoAtualTransporte()" title="Usar minha localização">📍</button>' +
                    '</div>' +
                    '<div class="search-field-group">' +
                    '<div class="search-field-container"><div id="destinoGeocoder" style="flex:1;"></div>' +
                    '<button class="clear-btn" id="clearDestinoMapa" onclick="limparCampoTransporte(\'destinoMapa\')">&times;</button></div>' +
                    '</div>' +
                    '</div>' +
                    '<div id="camposManuais" style="display:none;">' +
                    '<div class="search-field-group">' +
                    '<div class="search-field-container"><input type="text" id="origemManual" class="input-endereco-manual" placeholder="Descreva a origem" />' +
                    '<button class="clear-btn" id="clearOrigemManual" onclick="limparCampoTransporte(\'origemManual\')">&times;</button></div>' +
                    '<button class="btn-location-modern" id="btnLocalizacaoManual" onclick="usarLocalizacaoAtualTransporte()" title="Usar minha localização">📍</button>' +
                    '</div>' +
                    '<div class="search-field-group">' +
                    '<div class="search-field-container"><input type="text" id="destinoManual" class="input-endereco-manual" placeholder="Descreva o destino" />' +
                    '<button class="clear-btn" id="clearDestinoManual" onclick="limparCampoTransporte(\'destinoManual\')">&times;</button></div>' +
                    '</div>' +
                    '</div>' +
                    '</div>' +
                    '<button class="btn-acao btn-site-pedido" id="btnEnderecoManual" onclick="toggleEnderecoManualTransporte()" style="width:100%; margin-bottom:0.75rem;">Não encontrei meu endereço</button>' +
                    '<div id="mapboxMap" style="height:250px; width:100%; margin-bottom:1rem; border-radius:1rem; position: relative;"></div>' +
                    '<div id="infoRotaContainer" class="info-viagem" style="display:none; margin-bottom:10px;"></div>' +
                    '<select id="selectTarifa" class="input-pedido" aria-label="Selecione a tarifa">' +
                    '<option value="">Selecione a tarifa (fixa)</option>' +
                    tarifas.map(function(f) {
                        return '<option value="' + f.taxa + '">' + f.localidade + ' - R$ ' + f.taxa.toFixed(2) + '</option>';
                    }).join('') +
                    '<option value="combinar">💬 Combinar com motorista</option>' +
                    '</select>' +
                    '<div class="form-row">' +
                    '<div style="position:relative;"><input type="text" id="clienteNomeTransporte" class="input-pedido" placeholder="Nome*" value="' + (Core.getUserDisplayName() || '') + '" required><span class="obrigatorio" style="position:absolute; top:8px; right:12px;">*</span></div>' +
                    '<div style="position:relative;"><input type="tel" id="clienteTelTransporte" class="input-pedido" placeholder="Telefone*" required><span class="obrigatorio" style="position:absolute; top:8px; right:12px;">*</span></div>' +
                    '</div>' +
                    '<textarea id="obsTransporte" class="input-pedido" placeholder="Observações"></textarea>' +
                    '<button class="btn-adicionar-filtro" id="btnSolicitarCorrida" style="width:100%;">Solicitar corrida</button>' +
                    '</div>' +
                    // ABA ACOMPANHAR
                    '<div id="tabAcompanhar" class="modal-tab-content">' +
                    '<input type="text" id="consultaCodigoTransporte" class="input-pedido" placeholder="Código da corrida" aria-label="Código da corrida">' +
                    '<div style="display:flex; gap:0.5rem;">' +
                    '<button class="btn-consultar-pedido" onclick="consultarCorridaTransporte()" style="flex:1;">Consultar</button>' +
                    '<button class="btn-limpar-historico" onclick="document.getElementById(\'consultaCodigoTransporte\').value=\'\'; document.getElementById(\'resultadoAcompanhamentoTransporte\').innerHTML=\'\';">Limpar</button>' +
                    '</div>' +
                    '<div id="resultadoAcompanhamentoTransporte" style="margin-top:1rem;"></div>' +
                    '</div>' +
                    // ABA HISTÓRICO
                    (currentUser ? '<div id="tabHistorico" class="modal-tab-content"><div id="listaHistoricoTransporte"></div></div>' : '') +
                    '</div></div></div>';

                document.body.insertAdjacentHTML('beforeend', modalHtml);

                // ===== VERIFICAR STATUS DA LOJA =====
                var btnSolicitar = document.getElementById('btnSolicitarCorrida');
                var msgStatus = document.getElementById('statusLojaMsgTransporte');
                if (statusLoja === 'fechada' || statusLoja === 'pausada') {
                    btnSolicitar.disabled = true;
                    btnSolicitar.style.opacity = '0.5';
                    btnSolicitar.style.pointerEvents = 'none';
                    msgStatus.style.display = 'block';
                    msgStatus.innerHTML = statusLoja === 'fechada' ? '🔴 Serviço indisponível: ' + (statusMessage || 'Indisponível no momento.') : '🟡 Serviço pausado: ' + (statusMessage || 'Indisponível no momento.');
                } else {
                    btnSolicitar.disabled = false;
                    btnSolicitar.style.opacity = '1';
                    btnSolicitar.style.pointerEvents = 'auto';
                    msgStatus.style.display = 'none';
                }

                // ===== INICIALIZAR MAPA E GEOCODERS =====
                // O token não fica neste arquivo. Se a página não fornecer uma
                // configuração, o usuário continua podendo usar o modo manual.
                if (!MAPBOX_TOKEN || !window.mapboxgl || !window.MapboxGeocoder) {
                    var manualFallback = document.getElementById('camposManuais');
                    var geocoderFallback = document.getElementById('geocoderContainer');
                    var mapaFallback = document.getElementById('mapboxMap');
                    var botaoManualFallback = document.getElementById('btnEnderecoManual');
                    if (manualFallback) manualFallback.style.display = 'block';
                    if (geocoderFallback) geocoderFallback.style.display = 'none';
                    if (botaoManualFallback) {
                        botaoManualFallback.style.display = 'none';
                        botaoManualFallback.setAttribute('aria-hidden', 'true');
                    }
                    if (mapaFallback) {
                        mapaFallback.innerHTML = '<div class="mapa-indisponivel"><strong>Mapa indisponível</strong><span>Informe origem e destino manualmente.</span></div>';
                    }
                } else {
                mapboxgl.accessToken = MAPBOX_TOKEN;
                mapboxMap = new mapboxgl.Map({
                    container: 'mapboxMap',
                    style: 'mapbox://styles/mapbox/streets-v12',
                    center: [-44.133, -22.847],
                    zoom: 12,
                    language: 'pt-BR',
                    cooperativeGestures: true,
                    boxZoom: true
                });
                mapboxMap.addControl(new mapboxgl.NavigationControl());

                var BRASIL_BBOX = [-73.99, -33.75, -34.79, 5.27];
                var RIO_CLARO_PROXIMITY = [-44.135, -22.723];

                var origemContainer = document.getElementById('origemGeocoder');
                var destinoContainer = document.getElementById('destinoGeocoder');

                var geocoderOrigem = new MapboxGeocoder({
                    accessToken: MAPBOX_TOKEN,
                    language: 'pt-BR',
                    country: 'br',
                    bbox: BRASIL_BBOX,
                    proximity: RIO_CLARO_PROXIMITY,
                    marker: false,
                    placeholder: 'Endereço de origem'
                });
                geocoderOrigem.addTo(origemContainer);
                geocoderOrigem.on('result', function(e) {
                    if (e.result && e.result.center) {
                        currentMapboxOrigin = {
                            lat: e.result.center[1],
                            lng: e.result.center[0],
                            address: e.result.place_name
                        };
                        if (currentMapboxOrigin && currentMapboxDest) calcularRotaTransporte();
                    }
                });

                var geocoderDestino = new MapboxGeocoder({
                    accessToken: MAPBOX_TOKEN,
                    language: 'pt-BR',
                    country: 'br',
                    bbox: BRASIL_BBOX,
                    proximity: RIO_CLARO_PROXIMITY,
                    marker: false,
                    placeholder: 'Endereço de destino'
                });
                geocoderDestino.addTo(destinoContainer);
                geocoderDestino.on('result', function(e) {
                    if (e.result && e.result.center) {
                        currentMapboxDest = {
                            lat: e.result.center[1],
                            lng: e.result.center[0],
                            address: e.result.place_name
                        };
                        if (currentMapboxOrigin && currentMapboxDest) calcularRotaTransporte();
                    }
                });
                }

               // ===== VARIÁVEL PARA CAMADA DA ROTA =====
var rotaCamadaId = 'rota-direcao-' + Date.now();

// ===== CALCULAR ROTA (COM MAPBOX DIRECTIONS API) =====
function calcularRotaTransporte() {
    if (!currentMapboxOrigin || !currentMapboxDest) return;
    var info = document.getElementById('infoRotaContainer');
    info.style.display = 'block';
    info.innerHTML = '🔄 Calculando rota...';

    var url = 'https://api.mapbox.com/directions/v5/mapbox/driving/' +
        currentMapboxOrigin.lng + ',' + currentMapboxOrigin.lat + ';' +
        currentMapboxDest.lng + ',' + currentMapboxDest.lat +
        '?access_token=' + MAPBOX_TOKEN + '&geometries=geojson&overview=full&steps=true';

    fetch(url)
        .then(function(response) { return response.json(); })
        .then(function(data) {
            if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
                info.innerHTML = '❌ Não foi possível calcular a rota.';
                return;
            }
            var route = data.routes[0];
            var leg = route.legs[0];
            var distancia = (leg.distance / 1000).toFixed(1) + ' km';
            var duracao = Math.round(leg.duration / 60) + ' min';
            info.innerHTML = '<strong>Distância:</strong> ' + distancia + ' | <strong>Tempo:</strong> ' + duracao;

            // Remover camada anterior se existir
            if (mapboxMap.getLayer(rotaCamadaId)) {
                mapboxMap.removeLayer(rotaCamadaId);
                mapboxMap.removeSource(rotaCamadaId);
            }

            // Adicionar fonte e camada GeoJSON
            var geojson = {
                type: 'Feature',
                geometry: route.geometry,
                properties: {}
            };
            mapboxMap.addSource(rotaCamadaId, {
                type: 'geojson',
                data: geojson
            });
            mapboxMap.addLayer({
                id: rotaCamadaId,
                type: 'line',
                source: rotaCamadaId,
                layout: {
                    'line-join': 'round',
                    'line-cap': 'round'
                },
                paint: {
                    'line-color': '#0a66c2',
                    'line-width': 5
                }
            });

            // Ajustar zoom para a rota
            var bounds = new mapboxgl.LngLatBounds();
            route.geometry.coordinates.forEach(function(coord) {
                bounds.extend(coord);
            });
            mapboxMap.fitBounds(bounds, { padding: 40 });
        })
        .catch(function(err) {
            info.innerHTML = '❌ Erro ao calcular rota: ' + err.message;
            console.error(err);
        });
}

// ===== LIMPAR CAMPOS (ajustado para remover a camada da rota) =====
window.limparCampoTransporte = function(tipo) {
    if (tipo === 'origemMapa') {
        var inp = document.querySelector('#origemGeocoder input');
        if (inp) inp.value = '';
        currentMapboxOrigin = null;
    } else if (tipo === 'destinoMapa') {
        var inp2 = document.querySelector('#destinoGeocoder input');
        if (inp2) inp2.value = '';
        currentMapboxDest = null;
    } else if (tipo === 'origemManual') {
        var inp3 = document.getElementById('origemManual');
        if (inp3) inp3.value = '';
    } else if (tipo === 'destinoManual') {
        var inp4 = document.getElementById('destinoManual');
        if (inp4) inp4.value = '';
    }
    var info = document.getElementById('infoRotaContainer');
    if (info) info.style.display = 'none';
    // Remover camada da rota
    if (mapboxMap && mapboxMap.getLayer(rotaCamadaId)) {
        mapboxMap.removeLayer(rotaCamadaId);
        mapboxMap.removeSource(rotaCamadaId);
    }
};

             
                // ===== USAR LOCALIZAÇÃO ATUAL =====
                window.usarLocalizacaoAtualTransporte = function() {
                    if (!MAPBOX_TOKEN) {
                        UI.mostrarToast('A localização automática está indisponível. Informe a origem manualmente.', 'erro');
                        return;
                    }
                    if (!navigator.geolocation) {
                        UI.mostrarToast('Geolocalização não suportada.', 'erro');
                        return;
                    }
                    navigator.geolocation.getCurrentPosition(function(pos) {
                        var lat = pos.coords.latitude;
                        var lng = pos.coords.longitude;
                        fetch('https://api.mapbox.com/geocoding/v5/mapbox.places/' + lng + ',' + lat + '.json?access_token=' + MAPBOX_TOKEN + '&language=pt&country=br')
                            .then(function(res) { return res.json(); })
                            .then(function(data) {
                                if (data.features && data.features.length > 0) {
                                    var endereco = data.features[0].place_name;
                                    var usandoManual = document.getElementById('camposManuais').style.display === 'flex' || document.getElementById('camposManuais').style.display === 'block';
                                    if (usandoManual) {
                                        document.getElementById('origemManual').value = endereco;
                                    } else {
                                        var inp = document.querySelector('#origemGeocoder input');
                                        if (inp) inp.value = endereco;
                                        currentMapboxOrigin = { lat: lat, lng: lng, address: endereco };
                                    }
                                    if (currentMapboxOrigin && currentMapboxDest) calcularRotaTransporte();
                                    UI.mostrarToast('Localização inserida!', 'sucesso');
                                }
                            });
                    }, function(err) {
                        UI.mostrarToast('Erro ao obter localização: ' + err.message, 'erro');
                    }, { enableHighAccuracy: true, timeout: 10000 });
                };

                // ===== TOGGLE ENDEREÇO MANUAL =====
                window.toggleEnderecoManualTransporte = function() {
                    var manual = document.getElementById('camposManuais');
                    var geocoder = document.getElementById('geocoderContainer');
                    var btn = document.getElementById('btnEnderecoManual');
                    if (manual.style.display === 'none' || manual.style.display === '') {
                        manual.style.display = 'block';
                        geocoder.style.display = 'none';
                        btn.textContent = '← Voltar para busca no mapa';
                    } else {
                        manual.style.display = 'none';
                        geocoder.style.display = 'block';
                        btn.textContent = 'Não encontrei meu endereço';
                    }
                };

                // ===== CONSULTAR CORRIDA =====
                window.consultarCorridaTransporte = function() {
                    var cod = document.getElementById('consultaCodigoTransporte').value.trim().toUpperCase();
                    var resDiv = document.getElementById('resultadoAcompanhamentoTransporte');
                    if (!cod) { resDiv.innerHTML = '<p style="color:#dc3545;">Digite o código da corrida.</p>'; return; }
                    Core.db.collection('pedidos').where('codigoCurto', '==', cod).limit(1).get()
                        .then(function(snap) {
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
                                '<p><strong>Origem:</strong> ' + getEnderecoCurto(p.origem) + '</p>' +
                                '<p><strong>Destino:</strong> ' + getEnderecoCurto(p.destino) + '</p>' +
                                '<p><strong>Valor:</strong> ' + (p.total === 0 ? 'A combinar' : 'R$ ' + p.total.toFixed(2)) + '</p></div>';
                        });
                };

                // ===== CARREGAR HISTÓRICO =====
                function carregarHistoricoTransporte(estIdLocal) {
                    if (!Core.getCurrentUser()) return;
                    var container = document.getElementById('listaHistoricoTransporte');
                    if (!container) return;
                    Core.db.collection('pedidos').where('clienteId', '==', Core.getCurrentUser().uid)
                        .where('estabelecimentoId', '==', estIdLocal)
                        .orderBy('criadoEm', 'desc').limit(20).get()
                        .then(function(snap) {
                            if (snap.empty) { container.innerHTML = '<p>Nenhuma corrida anterior.</p>'; return; }
                            var html = '';
                            snap.forEach(function(doc) {
                                var p = doc.data();
                                var codigo = p.codigoCurto || doc.id.slice(0,6).toUpperCase();
                                html += '<div style="border:1px solid var(--gray-200); border-radius:0.75rem; padding:0.75rem; margin-bottom:0.5rem; background:white;">' +
                                    '<div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">' +
                                    '<div><strong>#' + codigo + '</strong> <span style="background:' + (p.status === 'pendente' ? '#fff7ed' : p.status === 'concluido' ? '#ecfdf5' : '#f1f5f9') + '; padding:0.2rem 0.5rem; border-radius:1rem; font-size:0.7rem;">' + (p.status || 'pendente') + '</span></div>' +
                                    '<div>' + (p.criadoEm ? new Date(p.criadoEm.toDate()).toLocaleString() : '---') + '</div></div>' +
                                    '<div><strong>Origem:</strong> ' + getEnderecoCurto(p.origem) + '</div>' +
                                    '<div><strong>Destino:</strong> ' + getEnderecoCurto(p.destino) + '</div>' +
                                    '<div><strong>Valor:</strong> ' + (p.total === 0 ? 'A combinar' : 'R$ ' + p.total.toFixed(2)) + '</div>' +
                                    '<button class="btn-acao btn-qrcode" style="margin-top:0.5rem;" onclick="gerarComprovanteTransporte(' + JSON.stringify(p).replace(/"/g, '&quot;') + ', \'' + codigo + '\')">🖨️ Ver comprovante</button>' +
                                    '</div>';
                            });
                            container.innerHTML = html;
                        });
                }

                // ===== FECHAR MODAL =====
                window.fecharModalTransporte = function() {
                    var modal = document.getElementById('modalTransporte');
                    if (modal) modal.remove();
                    if (mapboxMap) { mapboxMap.remove(); mapboxMap = null; }
                    if (directionsRenderer) { directionsRenderer.setMap(null); directionsRenderer = null; }
                    directionsService = null;
                    UI.restoreFocus();
                };

                // ===== CONFIGURAR ABAS =====
                document.querySelectorAll('#modalTransporte .modal-tab').forEach(function(tab) {
                    tab.onclick = function() {
                        document.querySelectorAll('#modalTransporte .modal-tab').forEach(function(t) {
                            t.classList.remove('active');
                        });
                        tab.classList.add('active');
                        document.querySelectorAll('#modalTransporte .modal-tab-content').forEach(function(c) {
                            c.classList.remove('active');
                        });
                        var tabId = tab.dataset.tab;
                        var contentId = 'tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1);
                        document.getElementById(contentId).classList.add('active');
                        if (tabId === 'historico' && Core.getCurrentUser()) {
                            carregarHistoricoTransporte(estId);
                        }
                        if (tabId === 'acompanhar') {
                            var resDiv = document.getElementById('resultadoAcompanhamentoTransporte');
                            if (resDiv && resDiv.innerHTML.trim() === '') resDiv.innerHTML = '';
                        }
                    };
                });

                // ===== BOTÃO SOLICITAR CORRIDA =====
                document.getElementById('btnSolicitarCorrida').onclick = function() {
                    if (statusLoja !== 'aberta') {
                        UI.mostrarToast('Serviço indisponível no momento.', 'erro');
                        return;
                    }
                    var nome = document.getElementById('clienteNomeTransporte').value.trim();
                    var tel = document.getElementById('clienteTelTransporte').value.trim();
                    var tarifaSelect = document.getElementById('selectTarifa');
                    var taxaEntrega = 0, total = 0;
                    if (tarifaSelect.value === 'combinar') {
                        taxaEntrega = 0;
                        total = 0;
                    } else if (tarifaSelect.value) {
                        taxaEntrega = parseFloat(tarifaSelect.value);
                        total = taxaEntrega;
                    } else {
                        UI.mostrarToast('Selecione uma tarifa ou "Combinar com motorista".', 'erro');
                        return;
                    }
                    if (!nome || nome.length < 2) {
                        UI.mostrarToast('Informe seu nome completo.', 'erro');
                        return;
                    }
                    var telNumerico = tel.replace(/\D/g, '');
                    if (!telNumerico || telNumerico.length < 10) {
                        UI.mostrarToast('Telefone inválido. Informe DDD + número.', 'erro');
                        return;
                    }
                    var origem, destino, latOrigem, lngOrigem, latDestino, lngDestino;
                    var usandoManual = document.getElementById('camposManuais').style.display === 'flex' || document.getElementById('camposManuais').style.display === 'block';
                    if (usandoManual) {
                        origem = document.getElementById('origemManual').value.trim();
                        destino = document.getElementById('destinoManual').value.trim();
                        if (!origem || !destino) {
                            UI.mostrarToast('Descreva a origem e o destino.', 'erro');
                            return;
                        }
                        latOrigem = lngOrigem = latDestino = lngDestino = 0;
                    } else {
                        if (!currentMapboxOrigin || !currentMapboxDest) {
                            UI.mostrarToast('Selecione os endereços no mapa.', 'erro');
                            return;
                        }
                        origem = currentMapboxOrigin.address;
                        destino = currentMapboxDest.address;
                        latOrigem = currentMapboxOrigin.lat;
                        lngOrigem = currentMapboxOrigin.lng;
                        latDestino = currentMapboxDest.lat;
                        lngDestino = currentMapboxDest.lng;
                    }
                    // Salvar dados do cliente (reutiliza função do localStorage)
                    salvarDadosClienteLocal(nome, telNumerico, origem + ' → ' + destino);

                    var codigoCurto = Math.random().toString(36).substring(2, 8).toUpperCase();
                    var pedido = {
                        estabelecimentoId: estId,
                        estabelecimentoNome: nomeEstab,
                        clienteId: Core.getCurrentUser()?.uid || null,
                        clienteNome: nome,
                        clienteTelefone: telNumerico,
                        origem: origem,
                        destino: destino,
                        origem_lat: latOrigem,
                        origem_lng: lngOrigem,
                        destino_lat: latDestino,
                        destino_lng: lngDestino,
                        taxaEntrega: taxaEntrega,
                        total: total,
                        status: 'pendente',
                        codigoCurto: codigoCurto,
                        observacao: document.getElementById('obsTransporte').value,
                        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
                    };
                    Core.db.collection('pedidos').add(pedido)
                        .then(function() {
                            mostrarPopupConfirmacaoTransporte({
                                titulo: '✅ Corrida solicitada!',
                                codigo: codigoCurto,
                                botoes: '<button class="btn-adicionar-filtro" onclick="fecharModalTransporte(); document.getElementById(\'consultaCodigoTransporte\').value=\'' + codigoCurto + '\'; document.querySelector(\'#modalTransporte .modal-tab[data-tab=\\"acompanhar\\"]\').click(); this.closest(\'.popup-confirmacao\').remove();">🔍 Acompanhar</button>' +
                                    '<button class="btn-adicionar-filtro" style="background:#2c3e50;" onclick="gerarComprovanteTransporte({estabelecimentoNome:\'' + nomeEstab + '\',clienteNome:\'' + nome + '\',clienteTelefone:\'' + telNumerico + '\',origem:\'' + origem + '\',destino:\'' + destino + '\',total:' + total + ',observacao:\'' + document.getElementById('obsTransporte').value + '\'}, \'' + codigoCurto + '\'); this.closest(\'.popup-confirmacao\').remove();">🖨️ Comprovante</button>',
                                onClose: 'fecharModalTransporte()'
                            });
                        })
                        .catch(function(err) {
                            UI.mostrarToast('Erro ao enviar: ' + err.message, 'erro');
                        });
                };

                // ===== PRÉ-PREENCHER DADOS DO CLIENTE (localStorage) =====
                var saved = carregarDadosClienteLocal();
                if (saved) {
                    if (saved.nome && document.getElementById('clienteNomeTransporte')) {
                        document.getElementById('clienteNomeTransporte').value = saved.nome;
                    }
                    if (saved.telefone && document.getElementById('clienteTelTransporte')) {
                        document.getElementById('clienteTelTransporte').value = saved.telefone;
                    }
                }

                // ===== MÁSCARA DE TELEFONE =====
                var telInput = document.getElementById('clienteTelTransporte');
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

                // ===== EXPOR FUNÇÕES GLOBAIS =====
                window.fecharModalTransporte = window.fecharModalTransporte;
                window.gerarComprovanteTransporte = gerarComprovanteTransporte;
                window.limparCampoTransporte = window.limparCampoTransporte;
                window.usarLocalizacaoAtualTransporte = window.usarLocalizacaoAtualTransporte;
                window.toggleEnderecoManualTransporte = window.toggleEnderecoManualTransporte;
                window.consultarCorridaTransporte = window.consultarCorridaTransporte;

                // ===== FOCAR MODAL =====
                UI.trapFocus(document.getElementById('modalTransporte'));

                // ===== FECHAR COM ESC =====
                document.addEventListener('keydown', function escHandler(e) {
                    if (e.key === 'Escape') {
                        var modal = document.getElementById('modalTransporte');
                        if (modal && modal.style.display !== 'none') {
                            fecharModalTransporte();
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
