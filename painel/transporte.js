(function () {
  'use strict';

  var EU = window.EconomizeiUtils;
  var FB = window.EconomizeiFirebase;
  var Loj = window.Economizei.Lojista;
  var Shell = window.Economizei.Painel.Shell;
  var Auth = window.Economizei.Painel.Auth;
  var db = FB.db;

  var PREFIXOS_TRANSPORTE = Loj.PREFIXOS.transporte;

  var emailAtual = '';
  var estId = '';
  var unsubscribePedidos = null;
  var unsubscribeTarifas = null;
  var unsubscribeCupons = null;
  var pedidosAtuais = [];
  var rankingVendas = [];
  var mapInstance = null;
  var heatmapLayer = null;
  var currentRotaMap = null;
  var currentRotaDirections = null;
  var currentPedidoId = null;
  var geocoderInstancia = null;
  var geocodeCacheMemoria = {};
  var heatmapRaio = 30;
  var heatmapOpacidade = 0.7;
  var heatmapGradiente = 'default';
  var heatmapCarregando = false;

  var gradientes = {
    'default': ['rgba(0, 255, 255, 0)', '#00f', '#0ff', '#0f0', '#ff0', '#f00'],
    'blue': ['rgba(0,0,255,0)', '#0000ff', '#4444ff', '#8888ff', '#bbbbff', '#ffffff'],
    'red': ['rgba(255,0,0,0)', '#ff0000', '#ff4444', '#ff8888', '#ffbbbb', '#ffffff'],
    'green': ['rgba(0,255,0,0)', '#00ff00', '#44ff44', '#88ff88', '#bbffbb', '#ffffff'],
    'yellow': ['rgba(255,255,0,0)', '#ffff00', '#ffdd44', '#ffbb88', '#ff99bb', '#ffffff']
  };

  // ===== GOOGLE MAPS LOADER =====
  function carregarGoogleMaps() {
    return new Promise(function (resolve) {
      if (window.google && window.google.maps && window.google.maps.visualization) { resolve(); return; }
      if (window.google && window.google.maps && !window.google.maps.visualization) {
        console.warn('Google Maps já estava carregado sem "visualization". O mapa de calor pode não funcionar.');
        resolve();
        return;
      }
      window.__economizeiInitMap = function () { resolve(); };
      var s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js?key=AIzaSyDv9ROezfvApxxSk6NrHxvpVZRuTnsl8hg&libraries=places,geometry,visualization&callback=__economizeiInitMap&loading=async';
      s.defer = true;
      document.head.appendChild(s);
    });
  }

  // ===== CORRIDAS =====
  function atualizarBadgePendentes() {
    var pendentes = pedidosAtuais.filter(function (p) { return p.status === 'pendente'; }).length;
    var badge = document.getElementById('badgePendentes');
    badge.textContent = pendentes;
    badge.style.display = pendentes > 0 ? 'inline-block' : 'none';
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
      var pedidosArray = [];
      var faturamento = 0;
      var contagem = {};
      snap.forEach(function (doc) {
        var p = doc.data();
        pedidosArray.push(Object.assign({ id: doc.id }, p));
        if (p.status !== 'cancelado') faturamento += p.total || 0;
        if (p.destino) contagem[p.destino] = (contagem[p.destino] || 0) + 1;
      });
      pedidosArray.sort(function (a, b) {
        return (b.criadoEm && b.criadoEm.toDate ? b.criadoEm.toDate().getTime() : 0) - (a.criadoEm && a.criadoEm.toDate ? a.criadoEm.toDate().getTime() : 0);
      });
      pedidosAtuais = pedidosArray;
      rankingVendas = Object.keys(contagem).map(function (k) { return [k, contagem[k]]; }).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
      document.getElementById('totalPedidos').textContent = pedidosArray.length;
      document.getElementById('faturamentoTotal').textContent = 'R$ ' + faturamento.toFixed(2);
      document.getElementById('ticketMedio').textContent = 'R$ ' + (pedidosArray.length ? (faturamento / pedidosArray.length).toFixed(2) : '0.00');
      renderizarPedidos(pedidosArray);
      atualizarBadgePendentes();
    });
  }

  function isValorCombinado(p) {
    if (typeof p.valorCombinado === 'boolean') return p.valorCombinado;
    return (p.total || 0) === 0;
  }

  function renderizarPedidos(pedidos) {
    var container = document.getElementById('listaPedidos');
    var statusFiltro = document.getElementById('statusFiltroSelect').value;
    var tipoFiltro = document.getElementById('tipoPedidoFiltro').value;
    var filtered = pedidos;
    if (statusFiltro) filtered = filtered.filter(function (p) { return p.status === statusFiltro; });
    if (tipoFiltro === 'presencial') filtered = filtered.filter(function (p) { return p.numeroMesa; });
    else if (tipoFiltro === 'delivery') filtered = filtered.filter(function (p) { return !p.numeroMesa; });

    if (filtered.length === 0) {
      container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:60px;">Nenhuma corrida encontrada.</div>';
      return;
    }

    container.innerHTML = filtered.map(function (p) {
      var dataHora = p.criadoEm ? p.criadoEm.toDate().toLocaleString('pt-BR') : '--';
      var statusClass = p.status || 'pendente';
      var temRota = p.origem && p.destino;
      var combinar = isValorCombinado(p);
      var valorExibido = combinar ? '<i class="fas fa-comment-dots" aria-hidden="true"></i> A combinar' : 'R$ ' + (p.total || 0).toFixed(2);
      var badgeCombinar = combinar ? '<span class="badge-combinar">Combinar c/ motorista</span>' : '';

      return '<div class="pedido-card status-' + statusClass + '" data-id="' + p.id + '">' +
        '<div class="pedido-header">' +
          '<div class="pedido-id">Corrida #' + EU.sanitize(p.codigoCurto || p.id.slice(0,6).toUpperCase()) + badgeCombinar + '</div>' +
          '<div class="pedido-data">' + dataHora + '</div>' +
        '</div>' +
        '<select class="status-select status-' + statusClass + '" onchange="atualizarStatus(\'' + p.id + '\', this.value)">' +
          '<option value="pendente"' + (p.status==='pendente'?' selected':'') + '>Pendente</option>' +
          '<option value="confirmado"' + (p.status==='confirmado'?' selected':'') + '>Confirmado</option>' +
          '<option value="a_caminho"' + (p.status==='a_caminho'?' selected':'') + '>A caminho</option>' +
          '<option value="em_curso"' + (p.status==='em_curso'?' selected':'') + '>Em curso</option>' +
          '<option value="concluido"' + (p.status==='concluido'?' selected':'') + '>Concluído</option>' +
          '<option value="cancelado"' + (p.status==='cancelado'?' selected':'') + '>Cancelado</option>' +
        '</select>' +
        '<div class="pedido-corpo">' +
          '<div class="cliente-info">' +
            '<div class="cliente-nome">' + EU.sanitize(p.clienteNome || 'Cliente') + '</div>' +
            '<div class="cliente-contato">Telefone: ' + EU.sanitize(p.clienteTelefone || 'Não informado') + '</div>' +
            '<div class="cliente-contato"><strong>Origem:</strong> ' + EU.sanitize(p.origem || '-') + '</div>' +
            '<div class="cliente-contato"><strong>Destino:</strong> ' + EU.sanitize(p.destino || '-') + '</div>' +
          '</div>' +
          '<div class="info-pagamento">' +
            '<div class="linha"><span>Valor</span><span>' + valorExibido + '</span></div>' +
            (p.cupomCodigo ? '<div class="linha"><span>Cupom (' + EU.sanitize(p.cupomCodigo) + ')</span><span>- R$ ' + (p.descontoAplicado || 0).toFixed(2) + '</span></div>' : '') +
            (p.observacao ? '<div style="font-size:11px; color:var(--text-muted); margin-top:4px;"><strong>Obs:</strong> ' + EU.sanitize(p.observacao) + '</div>' : '') +
          '</div>' +
        '</div>' +
        '<div class="pedido-acoes">' +
          (temRota
            ? '<button class="btn-acao-pedido" onclick="abrirModalRota(\'' + p.id + '\', \'' + (p.origem||'').replace(/'/g,"\\'") + '\', \'' + (p.destino||'').replace(/'/g,"\\'") + '\')"><i class="fas fa-route" aria-hidden="true"></i> Rota</button>'
            : '<button class="btn-acao-pedido" style="opacity:0.5;cursor:default;" disabled><i class="fas fa-route" aria-hidden="true"></i> Rota</button>') +
          '<button class="btn-acao-pedido" onclick="imprimirTicket(\'' + p.id + '\')"><i class="fas fa-receipt" aria-hidden="true"></i> Comprovante</button>' +
          '<button class="btn-acao-pedido" onclick="compartilharLink(\'' + p.id + '\')" title="Enviar link da corrida para o passageiro"><i class="fas fa-share-nodes" aria-hidden="true"></i> Compartilhar</button>' +
          (combinar
            ? '<button class="btn-acao-pedido" style="background:#f59e0b; color:white;" onclick="abrirModalDefinirValor(\'' + p.id + '\')"><i class="fas fa-sack-dollar" aria-hidden="true"></i> Definir valor</button>'
            : '<button class="btn-acao-pedido" onclick="abrirModalDefinirValor(\'' + p.id + '\')" style="background:#e2e8f0;"><i class="fas fa-sack-dollar" aria-hidden="true"></i> Alterar valor</button>') +
          '<button class="btn-acao-pedido" style="color:#dc2626;" onclick="excluirPedido(\'' + p.id + '\')"><i class="fas fa-trash" aria-hidden="true"></i> Excluir</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  async function atualizarStatus(id, novoStatus) {
    EU.showLoading('Atualizando...');
    try {
      await db.collection('pedidos').doc(id).update({ status: novoStatus });
      EU.mostrarToast('Corrida #' + id.slice(0, 6).toUpperCase() + ' agora está ' + novoStatus + '.', 'sucesso');
    } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
    finally { EU.hideLoading(); }
  }

  async function excluirPedido(id) {
    var cod = '#' + id.slice(0, 6).toUpperCase();
    if (!confirm('Excluir a corrida ' + cod + '? Essa ação não pode ser desfeita.')) return;
    EU.showLoading('Excluindo...');
    try {
      await db.collection('pedidos').doc(id).delete();
      EU.mostrarToast('Corrida ' + cod + ' excluída.', 'sucesso');
    } catch (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); }
    finally { EU.hideLoading(); }
  }

  function imprimirTicket(id) {
    db.collection('pedidos').doc(id).get().then(function (doc) {
      if (!doc.exists) return;
      var p = doc.data();
      var codigo = p.codigoCurto || id.slice(0, 6).toUpperCase();
      var ok = EU.gerarComprovanteHTML(p, codigo, {
        titulo: 'Comprovante de corrida',
        rotuloCodigo: 'Corrida',
        omitirItens: true,
        resumoSimples: true,
        ocultarEndereco: true,
        ocultarPagamento: true,
        totalTexto: isValorCombinado(p) ? 'A combinar' : null,
        camposExtras: [
          { label: 'Origem', valor: p.origem || '-' },
          { label: 'Destino', valor: p.destino || '-' },
          { label: 'Status', valor: p.status || 'pendente' }
        ]
      });
      if (!ok) EU.mostrarToast('Permita a abertura do comprovante no navegador.', 'erro');
    });
  }

  function compartilharLink(id) {
    db.collection('pedidos').doc(id).get().then(function (doc) {
      if (!doc.exists) return;
      var p = doc.data();
      var token = btoa(id + '|' + Date.now());
      db.collection('tokensMotoboy').doc(token).set({
        pedidoId: id,
        expiraEm: Date.now() + 24 * 60 * 60 * 1000,
        dadosEntrega: {
          clienteNome: p.clienteNome,
          clienteTelefone: p.clienteTelefone,
          origem: p.origem,
          destino: p.destino,
          observacao: p.observacao,
          estabelecimentoNome: p.estabelecimentoNome
        }
      }).then(function () {
        var link = window.location.origin + '/p/entregador.html?token=' + encodeURIComponent(token);
        navigator.clipboard.writeText(link).then(function () {
          if (p.clienteTelefone && confirm('Link copiado! Abrir WhatsApp do passageiro para enviar?')) {
            window.open('https://wa.me/' + EU.formatarWhatsapp(p.clienteTelefone) + '?text=' + encodeURIComponent('Olá! Aqui está o link para acompanhar sua corrida: ' + link), '_blank');
          } else {
            EU.mostrarToast('Link copiado!', 'sucesso');
          }
        });
      });
    });
  }

  // ===== MODAL ROTA =====
  function abrirModalRota(id, origem, destino) {
    currentPedidoId = id;
    document.getElementById('rotaOrigem').textContent = origem;
    document.getElementById('rotaDestino').textContent = destino;
    document.getElementById('rotaDistancia').textContent = 'Calculando...';
    document.getElementById('rotaTempo').textContent = 'Calculando...';
    document.getElementById('modalRota').classList.add('active');

    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
      EU.mostrarToast('Google Maps ainda não carregou. Tente novamente em instantes.', 'erro');
      return;
    }

    if (currentRotaMap) { currentRotaMap = null; currentRotaDirections = null; }
    var mapContainer = document.getElementById('mapaRota');
    currentRotaMap = new google.maps.Map(mapContainer, {
      center: { lat: -22.847, lng: -44.133 },
      zoom: 13,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }, { featureType: 'transit', stylers: [{ visibility: 'off' }] }]
    });

    var directionsService = new google.maps.DirectionsService();
    var directionsRenderer = new google.maps.DirectionsRenderer({
      map: currentRotaMap,
      suppressMarkers: false,
      polylineOptions: { strokeColor: '#0a66c2', strokeWeight: 5 }
    });
    currentRotaDirections = directionsRenderer;

    directionsService.route({
      origin: origem,
      destination: destino,
      travelMode: 'DRIVING',
      unitSystem: google.maps.UnitSystem.METRIC
    }, function (result, status) {
      if (status === 'OK') {
        directionsRenderer.setDirections(result);
        var route = result.routes[0];
        var leg = route.legs[0];
        document.getElementById('rotaDistancia').textContent = leg.distance.text;
        document.getElementById('rotaTempo').textContent = leg.duration.text;
        var bounds = new google.maps.LatLngBounds();
        leg.steps.forEach(function (step) {
          bounds.extend(step.start_location);
          bounds.extend(step.end_location);
        });
        currentRotaMap.fitBounds(bounds);
      } else {
        document.getElementById('rotaDistancia').textContent = 'Erro ao calcular';
        document.getElementById('rotaTempo').textContent = 'Erro ao calcular';
        EU.mostrarToast('Não foi possível traçar a rota (' + status + ').', 'erro');
      }
    });

    document.getElementById('btnAbrirGoogleMaps').onclick = function () {
      window.open('https://www.google.com/maps/dir/?api=1&origin=' + encodeURIComponent(origem) + '&destination=' + encodeURIComponent(destino), '_blank');
    };
    document.getElementById('btnAbrirWaze').onclick = function () {
      window.open('https://www.waze.com/ul?q=' + encodeURIComponent(destino) + '&navigate=yes', '_blank');
    };
  }

  function fecharModalRota() {
    document.getElementById('modalRota').classList.remove('active');
    currentRotaMap = null;
    currentRotaDirections = null;
  }

  // ===== MODAL DEFINIR VALOR =====
  function abrirModalDefinirValor(id) {
    currentPedidoId = id;
    document.getElementById('inputValorCorrida').value = '';
    document.getElementById('modalDefinirValor').classList.add('active');
    document.getElementById('btnSalvarValor').onclick = function () {
      var valor = parseFloat(document.getElementById('inputValorCorrida').value);
      if (isNaN(valor) || valor < 0) { EU.mostrarToast('Digite um valor válido.', 'erro'); return; }
      db.collection('pedidos').doc(id).update({ total: valor, valorCombinado: false })
        .then(function () {
          EU.mostrarToast('Valor atualizado!', 'sucesso');
          fecharModalDefinirValor();
        })
        .catch(function (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); });
    };
  }

  function fecharModalDefinirValor() {
    document.getElementById('modalDefinirValor').classList.remove('active');
    currentPedidoId = null;
  }

  // ===== TARIFAS =====
  function carregarTarifas() {
    if (!emailAtual) return;
    if (unsubscribeTarifas) unsubscribeTarifas();
    unsubscribeTarifas = db.collection('lojistas').doc(emailAtual).collection('tarifas').onSnapshot(function (snap) {
      var container = document.getElementById('listaTarifas');
      if (snap.empty) { container.innerHTML = '<p style="text-align:center;padding:30px;">Nenhuma tarifa cadastrada.</p>'; return; }
      container.innerHTML = snap.docs.map(function (doc) {
        var data = doc.data();
        return '<div class="item-lista" data-id="' + doc.id + '"><div><strong>' + EU.sanitize(data.localidade || 'Sem localidade') + '</strong><br><small>R$ ' + parseFloat(data.valor || 0).toFixed(2) + '</small></div><div class="acoes"><button class="btn-pequeno" onclick="editarTarifa(\'' + doc.id + '\')">Editar</button><button class="btn-pequeno" onclick="duplicarTarifa(\'' + doc.id + '\')">Duplicar</button><button class="btn-pequeno" style="color:#dc2626;" onclick="excluirTarifa(\'' + doc.id + '\')">Excluir</button></div></div>';
      }).join('');
    });
  }

  document.getElementById('btnAdicionarTarifa').onclick = function () {
    var localidade = document.getElementById('novaLocalidade').value.trim();
    var valor = parseFloat(document.getElementById('novaTarifa').value);
    if (!localidade || isNaN(valor) || valor < 0) { EU.mostrarToast('Preencha localidade e valor.', 'erro'); return; }
    var btn = this;
    btn.classList.add('loading'); btn.disabled = true;
    db.collection('lojistas').doc(emailAtual).collection('tarifas').add({
      localidade: localidade,
      valor: valor,
      descricao: document.getElementById('novaTarifaDescricao').value.trim()
    }).then(function () {
      EU.mostrarToast('Tarifa "' + localidade + '" salva!', 'sucesso');
      document.getElementById('novaLocalidade').value = '';
      document.getElementById('novaTarifa').value = '';
      document.getElementById('novaTarifaDescricao').value = '';
    }).catch(function (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); })
    .finally(function () { btn.classList.remove('loading'); btn.disabled = false; });
  };

  function editarTarifa(id) {
    db.collection('lojistas').doc(emailAtual).collection('tarifas').doc(id).get().then(function (doc) {
      if (!doc.exists) return;
      var data = doc.data();
      var modal = document.createElement('div');
      modal.className = 'modal-overlay active';
      modal.innerHTML = '<div class="modal-conteudo" style="max-width:400px;"><div class="modal-header"><h3>Editar Tarifa</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div><div class="campo"><label>Localidade</label><input type="text" id="editLoc" value="' + EU.sanitize(data.localidade) + '"></div><div class="campo"><label>Valor (R$)</label><input type="number" step="0.01" id="editVal" value="' + data.valor + '"></div><div class="campo"><label>Descrição</label><textarea id="editDesc">' + EU.sanitize(data.descricao || '') + '</textarea></div><button class="btn-primary" id="saveEditTarifa"><span class="spinner-btn"></span><span class="btn-text">Salvar</span></button></div>';
      document.body.appendChild(modal);
      document.getElementById('saveEditTarifa').onclick = function () {
        var btn = this;
        var loc = document.getElementById('editLoc').value.trim();
        var val = parseFloat(document.getElementById('editVal').value);
        if (!loc || isNaN(val) || val < 0) { EU.mostrarToast('Preencha corretamente.', 'erro'); return; }
        btn.classList.add('loading'); btn.disabled = true;
        db.collection('lojistas').doc(emailAtual).collection('tarifas').doc(id).update({
          localidade: loc, valor: val, descricao: document.getElementById('editDesc').value.trim()
        }).then(function () { EU.mostrarToast('Tarifa atualizada!', 'sucesso'); modal.remove(); })
        .catch(function (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); btn.classList.remove('loading'); btn.disabled = false; });
      };
    });
  }

  function duplicarTarifa(id) {
    db.collection('lojistas').doc(emailAtual).collection('tarifas').doc(id).get().then(function (doc) {
      if (!doc.exists) return;
      var data = doc.data();
      db.collection('lojistas').doc(emailAtual).collection('tarifas').add({
        localidade: data.localidade + ' (cópia)', valor: data.valor, descricao: data.descricao || ''
      }).then(function () { EU.mostrarToast('Tarifa duplicada!', 'sucesso'); })
      .catch(function (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); });
    });
  }

  function excluirTarifa(id) {
    if (!confirm('Excluir esta tarifa? Essa ação não pode ser desfeita.')) return;
    db.collection('lojistas').doc(emailAtual).collection('tarifas').doc(id).delete()
      .then(function () { EU.mostrarToast('Tarifa removida.', 'sucesso'); })
      .catch(function (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); });
  }

  // ===== CUPONS =====
  function carregarCupons() {
    if (!emailAtual) return;
    if (unsubscribeCupons) unsubscribeCupons();
    unsubscribeCupons = db.collection('lojistas').doc(emailAtual).collection('cupons').onSnapshot(function (snap) {
      var container = document.getElementById('listaCupons');
      if (snap.empty) { container.innerHTML = '<p style="text-align:center;padding:30px;">Nenhum cupom criado.</p>'; return; }
      container.innerHTML = snap.docs.map(function (doc) {
        var data = doc.data();
        return '<div class="item-lista" data-id="' + doc.id + '"><div><strong>' + EU.sanitize(data.codigo) + '</strong><br><small>' + (data.tipo === 'percentual' ? data.valor + '%' : 'R$ ' + parseFloat(data.valor).toFixed(2)) + ' | ' + (data.ativo === 'sim' ? 'Ativo' : 'Inativo') + '</small></div><div class="acoes"><button class="btn-pequeno" onclick="editarCupom(\'' + doc.id + '\')">Editar</button><button class="btn-pequeno" onclick="duplicarCupom(\'' + doc.id + '\')">Duplicar</button><button class="btn-pequeno" style="color:#dc2626;" onclick="excluirCupom(\'' + doc.id + '\')">Excluir</button></div></div>';
      }).join('');
    });
  }

  document.getElementById('btnAdicionarCupom').onclick = function () {
    var codigo = document.getElementById('novoCodigo').value.trim().toUpperCase();
    var tipo = document.getElementById('novoTipo').value;
    var valor = parseFloat(document.getElementById('novoValor').value);
    if (!codigo || isNaN(valor) || valor <= 0) { EU.mostrarToast('Preencha código e valor.', 'erro'); return; }
    var btn = this;
    btn.classList.add('loading'); btn.disabled = true;
    db.collection('lojistas').doc(emailAtual).collection('cupons').add({
      codigo: codigo, tipo: tipo, valor: valor, ativo: 'sim', usosTotal: 0, usosPorCliente: {}
    }).then(function () {
      EU.mostrarToast('Cupom "' + codigo + '" criado!', 'sucesso');
      document.getElementById('novoCodigo').value = '';
      document.getElementById('novoValor').value = '';
    }).catch(function (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); })
    .finally(function () { btn.classList.remove('loading'); btn.disabled = false; });
  };

  function editarCupom(id) {
    db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).get().then(function (doc) {
      if (!doc.exists) return;
      var data = doc.data();
      var modal = document.createElement('div');
      modal.className = 'modal-overlay active';
      modal.innerHTML = '<div class="modal-conteudo" style="max-width:400px;"><div class="modal-header"><h3>Editar Cupom</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div><div class="campo"><label>Código</label><input type="text" id="editCod" value="' + EU.sanitize(data.codigo) + '"></div><div class="campo"><label>Valor</label><input type="number" step="0.01" id="editVal" value="' + data.valor + '"></div><div class="campo"><label>Ativo</label><select id="editAt"><option value="sim"' + (data.ativo==='sim'?' selected':'') + '>Sim</option><option value="nao"' + (data.ativo==='nao'?' selected':'') + '>Não</option></select></div><button class="btn-primary" id="saveEditCupom"><span class="spinner-btn"></span><span class="btn-text">Salvar</span></button></div>';
      document.body.appendChild(modal);
      document.getElementById('saveEditCupom').onclick = function () {
        var btn = this;
        var cod = document.getElementById('editCod').value.trim().toUpperCase();
        var val = parseFloat(document.getElementById('editVal').value);
        if (!cod || isNaN(val) || val <= 0) { EU.mostrarToast('Dados inválidos.', 'erro'); return; }
        btn.classList.add('loading'); btn.disabled = true;
        db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).update({
          codigo: cod, valor: val, ativo: document.getElementById('editAt').value
        }).then(function () { EU.mostrarToast('Cupom atualizado!', 'sucesso'); modal.remove(); })
        .catch(function (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); btn.classList.remove('loading'); btn.disabled = false; });
      };
    });
  }

  function duplicarCupom(id) {
    db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).get().then(function (doc) {
      if (!doc.exists) return;
      var data = doc.data();
      db.collection('lojistas').doc(emailAtual).collection('cupons').add({
        codigo: data.codigo + ' (cópia)', tipo: data.tipo, valor: data.valor,
        ativo: 'sim', usosTotal: 0, usosPorCliente: {}
      }).then(function () { EU.mostrarToast('Cupom duplicado!', 'sucesso'); })
      .catch(function (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); });
    });
  }

  function excluirCupom(id) {
    if (!confirm('Excluir este cupom? Essa ação não pode ser desfeita.')) return;
    db.collection('lojistas').doc(emailAtual).collection('cupons').doc(id).delete()
      .then(function () { EU.mostrarToast('Cupom removido.', 'sucesso'); })
      .catch(function (e) { EU.mostrarToast('Erro: ' + e.message, 'erro'); });
  }

  // ===== MAPA DE CALOR =====
  function inicializarMapa() {
    var container = document.getElementById('mapaContainer');
    if (!container) return;
    if (mapInstance) { carregarHeatmap(); return; }
    if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
      container.innerHTML = '<p style="text-align:center;padding:2rem;color:var(--text-muted);"><i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Carregando Google Maps...</p>';
      return;
    }
    if (typeof google.maps.visualization === 'undefined' || typeof google.maps.visualization.HeatmapLayer === 'undefined') {
      container.innerHTML = '<p style="text-align:center;padding:2rem;color:#991b1b;"><i class="fas fa-triangle-exclamation" aria-hidden="true"></i> A biblioteca "visualization" do Google Maps não carregou.</p>';
      return;
    }
    mapInstance = new google.maps.Map(container, {
      center: { lat: -22.847, lng: -44.133 },
      zoom: 13,
      styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] }, { featureType: 'transit', stylers: [{ visibility: 'off' }] }]
    });
    geocoderInstancia = new google.maps.Geocoder();
    carregarHeatmap();
    document.getElementById('btnAtualizarMapa').onclick = carregarHeatmap;
  }

  function geocodificarEndereco(endereco) {
    return new Promise(function (resolve) {
      if (!endereco) { resolve({ ponto: null, status: 'SEM_ENDERECO' }); return; }
      if (geocodeCacheMemoria[endereco] !== undefined) { resolve(geocodeCacheMemoria[endereco]); return; }
      if (!geocoderInstancia) { resolve({ ponto: null, status: 'GEOCODER_INDISPONIVEL' }); return; }
      geocoderInstancia.geocode({ address: endereco, region: 'BR' }, function (results, status) {
        var resultado;
        if (status === 'OK' && results && results[0]) {
          var loc = results[0].geometry.location;
          resultado = { ponto: { lat: loc.lat(), lng: loc.lng() }, status: 'OK' };
        } else {
          resultado = { ponto: null, status: status };
        }
        geocodeCacheMemoria[endereco] = resultado;
        resolve(resultado);
      });
    });
  }

  async function geocodificarFila(enderecos) {
    var resultados = {};
    for (var i = 0; i < enderecos.length; i++) {
      var endereco = enderecos[i];
      if (resultados[endereco] !== undefined) continue;
      resultados[endereco] = await geocodificarEndereco(endereco);
      if (i < enderecos.length - 1) await new Promise(function (r) { setTimeout(r, 180); });
    }
    return resultados;
  }

  async function carregarHeatmap() {
    if (heatmapCarregando) return;
    if (!mapInstance) { inicializarMapa(); return; }
    heatmapCarregando = true;
    EU.showLoading('Carregando mapa de calor...');
    var statusEl = document.getElementById('heatmapStatus');
    if (statusEl) statusEl.textContent = '';
    try {
      var periodo = document.getElementById('heatmapPeriodo') ? document.getElementById('heatmapPeriodo').value : 'hoje';
      var inicio = new Date(); inicio.setHours(0,0,0,0);
      if (periodo === '7dias') inicio.setDate(inicio.getDate() - 7);
      else if (periodo === 'mes') inicio.setDate(1);

      var snap = await db.collection('pedidos')
        .where('estabelecimentoId', '==', estId)
        .where('criadoEm', '>=', firebase.firestore.Timestamp.fromDate(inicio))
        .get();

      if (snap.empty) {
        if (heatmapLayer) heatmapLayer.setMap(null);
        EU.mostrarToast('Nenhuma corrida no período selecionado.', 'erro');
        if (statusEl) statusEl.textContent = '0 pontos';
        return;
      }

      var pontos = [];
      var enderecosParaGeocodificar = [];
      var pedidosDocs = [];

      snap.forEach(function (doc) {
        var p = doc.data();
        pedidosDocs.push(Object.assign({ id: doc.id }, p));
        if (typeof p.origem_lat === 'number' && typeof p.origem_lng === 'number') {
          pontos.push({ lat: p.origem_lat, lng: p.origem_lng });
        } else if (p.origem) {
          enderecosParaGeocodificar.push(p.origem);
        }
        if (typeof p.destino_lat === 'number' && typeof p.destino_lng === 'number') {
          pontos.push({ lat: p.destino_lat, lng: p.destino_lng });
        } else if (p.destino) {
          enderecosParaGeocodificar.push(p.destino);
        }
      });

      var falhas = 0;
      var statusFalhas = new Set();
      if (enderecosParaGeocodificar.length > 0) {
        if (statusEl) statusEl.textContent = 'Localizando ' + enderecosParaGeocodificar.length + ' endereço(s)...';
        var enderecosUnicos = Array.from(new Set(enderecosParaGeocodificar));
        var geocodificados = await geocodificarFila(enderecosUnicos);

        pedidosDocs.forEach(function (p) {
          var updates = {};
          if (!(typeof p.origem_lat === 'number' && typeof p.origem_lng === 'number') && p.origem) {
            var r = geocodificados[p.origem];
            if (r && r.ponto) { pontos.push(r.ponto); updates.origem_lat = r.ponto.lat; updates.origem_lng = r.ponto.lng; }
            else if (r) { falhas++; statusFalhas.add(r.status); }
          }
          if (!(typeof p.destino_lat === 'number' && typeof p.destino_lng === 'number') && p.destino) {
            var r2 = geocodificados[p.destino];
            if (r2 && r2.ponto) { pontos.push(r2.ponto); updates.destino_lat = r2.ponto.lat; updates.destino_lng = r2.ponto.lng; }
            else if (r2) { falhas++; statusFalhas.add(r2.status); }
          }
          if (Object.keys(updates).length > 0) {
            db.collection('pedidos').doc(p.id).update(updates).catch(function (err) {
              console.warn('Não foi possível salvar lat/lng no pedido ' + p.id + ': ' + err.message);
            });
          }
        });
      }

      if (heatmapLayer) heatmapLayer.setMap(null);

      if (pontos.length === 0) {
        var motivo = statusFalhas.size ? ' Motivo: ' + Array.from(statusFalhas).join(', ') + '.' : '';
        EU.mostrarToast('Não foi possível localizar endereços das corridas.' + motivo, 'erro');
        if (statusEl) { statusEl.textContent = '0 pontos' + motivo; statusEl.classList.add('erro'); }
        return;
      }

      var pontosGoogle = pontos.map(function (p) { return new google.maps.LatLng(p.lat, p.lng); });
      heatmapLayer = new google.maps.visualization.HeatmapLayer({
        data: pontosGoogle,
        radius: heatmapRaio,
        opacity: heatmapOpacidade,
        gradient: gradientes[heatmapGradiente] || gradientes['default']
      });
      heatmapLayer.setMap(mapInstance);

      var bounds = new google.maps.LatLngBounds();
      pontosGoogle.forEach(function (p) { bounds.extend(p); });
      mapInstance.fitBounds(bounds);

      if (statusEl) {
        statusEl.classList.remove('erro');
        statusEl.textContent = falhas > 0 ? pontos.length + ' pontos (' + falhas + ' não localizados)' : pontos.length + ' pontos';
      }
      EU.mostrarToast(pontos.length + ' pontos carregados no mapa.' + (falhas > 0 ? ' ' + falhas + ' endereço(s) não puderam ser localizados.' : ''), 'sucesso');
    } catch (e) {
      EU.mostrarToast('Erro ao carregar mapa: ' + e.message, 'erro');
      console.error('Erro ao carregar heatmap:', e);
    } finally {
      heatmapCarregando = false;
      EU.hideLoading();
    }
  }

  function atualizarHeatmap() {
    heatmapRaio = parseInt(document.getElementById('heatmapRaio').value);
    heatmapOpacidade = parseFloat(document.getElementById('heatmapOpacidade').value);
    heatmapGradiente = document.getElementById('heatmapGradiente').value;
    document.getElementById('heatmapRaioValor').textContent = heatmapRaio;
    document.getElementById('heatmapOpacidadeValor').textContent = heatmapOpacidade.toFixed(2);
    if (heatmapLayer) {
      heatmapLayer.setOptions({
        radius: heatmapRaio,
        opacity: heatmapOpacidade,
        gradient: gradientes[heatmapGradiente] || gradientes['default']
      });
    }
  }

  // ===== RESUMO CLICKS =====
  function mostrarPedidosPeriodo() {
    if (!pedidosAtuais.length) { EU.mostrarToast('Nenhuma corrida.', 'erro'); return; }
    var lista = pedidosAtuais.map(function (p) {
      return '<div onclick="verDetalhesPedido(\'' + p.id + '\')" style="padding:6px;border-bottom:1px solid #eee;cursor:pointer;">#' + EU.sanitize(p.codigoCurto || p.id.slice(0,6)) + ' - ' + (isValorCombinado(p) ? '<i class="fas fa-comment-dots" aria-hidden="true"></i> A combinar' : 'R$ ' + (p.total||0).toFixed(2)) + ' - ' + EU.sanitize(p.clienteNome) + '</div>';
    }).join('');
    abrirModal('Lista de Corridas', lista);
  }

  function mostrarRankingVendas() {
    if (!rankingVendas.length) { EU.mostrarToast('Nenhum destino frequente.', 'erro'); return; }
    var lista = rankingVendas.map(function (r, i) { return '<div>' + (i+1) + 'º ' + EU.sanitize(r[0]) + ' - ' + r[1] + ' solicitações</div>'; }).join('');
    abrirModal('Destinos Mais Frequentes', lista);
  }

  function mostrarPedidoMaisCaro() {
    if (!pedidosAtuais.length) return;
    var maisCaro = pedidosAtuais.slice().sort(function (a, b) { return (b.total || 0) - (a.total || 0); })[0];
    abrirModal('Corrida Mais Cara',
      '<div><h3>#' + EU.sanitize(maisCaro.codigoCurto || maisCaro.id.slice(0,6)) + '</h3>' +
      '<p><strong>Valor:</strong> ' + (isValorCombinado(maisCaro) ? '<i class="fas fa-comment-dots" aria-hidden="true"></i> A combinar' : 'R$ ' + (maisCaro.total||0).toFixed(2)) + '</p>' +
      '<p><strong>Cliente:</strong> ' + EU.sanitize(maisCaro.clienteNome) + '</p>' +
      '<p><strong>Origem:</strong> ' + EU.sanitize(maisCaro.origem) + '</p>' +
      '<p><strong>Destino:</strong> ' + EU.sanitize(maisCaro.destino) + '</p>' +
      '<button class="btn-primary" onclick="verDetalhesPedido(\'' + maisCaro.id + '\')">Ver Corrida</button></div>');
  }

  function verDetalhesPedido(id) {
    var el = document.querySelector('.pedido-card[data-id="' + id + '"]');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.querySelectorAll('.modal-overlay').forEach(function (m) { if (!m.id) m.remove(); else m.classList.remove('active'); });
  }

  function abrirModal(titulo, conteudo) {
    var modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML = '<div class="modal-conteudo"><div class="modal-header"><h3>' + titulo + '</h3><button class="btn-pequeno" onclick="this.closest(\'.modal-overlay\').remove()">&times;</button></div><div class="modal-body">' + conteudo + '</div></div>';
    document.body.appendChild(modal);
  }

  function toggleCollapse(header, contentId) {
    var content = document.getElementById(contentId);
    content.classList.toggle('open');
    header.querySelector('button').textContent = content.classList.contains('open') ? '−' : '+';
  }

  // ===== TABS =====
  document.querySelectorAll('.tab-principal').forEach(function (btn) {
    btn.onclick = function () {
      document.querySelectorAll('.tab-principal').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.tab-painel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      var tabId = 'tab' + btn.dataset.tab.charAt(0).toUpperCase() + btn.dataset.tab.slice(1);
      document.getElementById(tabId).classList.add('active');
      if (btn.dataset.tab === 'mapa') inicializarMapa();
      if (btn.dataset.tab === 'tarifas') carregarTarifas();
      if (btn.dataset.tab === 'cupons') carregarCupons();
    };
  });

  // ===== FECHAR MODAIS PELO FUNDO / ESC (mesmo padrão de Loja e Pedidos) =====
  ['modalRota', 'modalDefinirValor'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function (e) { if (e.target === el) el.classList.remove('active'); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var rota = document.getElementById('modalRota');
    var valor = document.getElementById('modalDefinirValor');
    if (valor && valor.classList.contains('active')) fecharModalDefinirValor();
    else if (rota && rota.classList.contains('active')) fecharModalRota();
  });

  // ===== EXPOSIÇÃO GLOBAL =====
  window.abrirModalRota = abrirModalRota;
  window.fecharModalRota = fecharModalRota;
  window.abrirModalDefinirValor = abrirModalDefinirValor;
  window.fecharModalDefinirValor = fecharModalDefinirValor;
  window.atualizarStatus = atualizarStatus;
  window.excluirPedido = excluirPedido;
  window.imprimirTicket = imprimirTicket;
  window.compartilharLink = compartilharLink;
  window.editarTarifa = editarTarifa;
  window.duplicarTarifa = duplicarTarifa;
  window.excluirTarifa = excluirTarifa;
  window.editarCupom = editarCupom;
  window.duplicarCupom = duplicarCupom;
  window.excluirCupom = excluirCupom;
  window.toggleCollapse = toggleCollapse;
  window.verDetalhesPedido = verDetalhesPedido;
  window.mostrarPedidosPeriodo = mostrarPedidosPeriodo;
  window.mostrarRankingVendas = mostrarRankingVendas;
  window.mostrarPedidoMaisCaro = mostrarPedidoMaisCaro;
  window.inicializarMapa = inicializarMapa;
  window.carregarHeatmap = carregarHeatmap;
  window.atualizarHeatmap = atualizarHeatmap;

  // ===== BOOTSTRAP =====
  carregarGoogleMaps().then(function () {
    console.log('Google Maps disponível para o módulo Transporte.');
    if (document.getElementById('tabMapa') && document.getElementById('tabMapa').classList.contains('active')) {
      inicializarMapa();
    }
  }).catch(function (e) {
    console.error('Erro ao carregar Google Maps:', e);
  });

  Auth.iniciar({
    tipo: 'lojista',
    contexto: 'transporte',
    prefixosEsperados: PREFIXOS_TRANSPORTE,
    aoEntrar: function (user, dados) {
      emailAtual = user.email;
      estId = dados.estabelecimentoId;

      // Transição: restaura scroll se veio de navegação
      if (window.EconomizeiPainel && EconomizeiPainel.Transicao) {
        var estadoTransicao = EconomizeiPainel.Transicao.iniciar({
          nomePagina: 'Abrindo Transporte...',
          logo: (document.getElementById('imgLogo') || {}).src || ''
        });
        if (estadoTransicao) EconomizeiPainel.Transicao.restaurarScroll(estadoTransicao);
      }

      document.getElementById('periodoSelect').onchange = carregarPedidos;
      document.getElementById('statusFiltroSelect').onchange = carregarPedidos;
      document.getElementById('ordemSelect').onchange = carregarPedidos;
      document.getElementById('tipoPedidoFiltro').onchange = carregarPedidos;

      carregarPedidos();
      carregarTarifas();
      carregarCupons();

      if (window.EconomizeiPainel && EconomizeiPainel.Transicao) {
        setTimeout(function () { EconomizeiPainel.Transicao.esconderOverlay(); }, 400);
      }
    }
  });

})();
