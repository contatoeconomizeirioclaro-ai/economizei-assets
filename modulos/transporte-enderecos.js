/* ============================================================
   TRANSPORTE — MODAIS DE ENDEREÇO
   Marcar no mapa + sugerir correção.
   v2 — usa adicionarLocal() pra refletir na hora
   ============================================================ */
(function () {
  'use strict';
  if (!window.Economizei) window.Economizei = {};
  if (!Economizei.Core) { console.error('[transporte-enderecos] Core não carregado.'); return; }

  var EU = EconomizeiUtils;
  var Core = Economizei.Core;
  var UI = Economizei.UI;

  var MAPBOX_TOKEN = (window.ECONOMIZEI_CONFIG && window.ECONOMIZEI_CONFIG.mapboxToken) || window.ECONOMIZEI_MAPBOX_TOKEN || '';
  var RC_CENTER = [-44.135, -22.723];
  var RC_BBOX   = [-44.30, -22.90, -43.95, -22.55];

  var PALAVRAS_BLOQUEADAS = [
    'caralho', 'porra', 'merda', 'foder', 'fuder',
    'buceta', 'punheta', 'putaria', 'cuzao', 'cuzão',
    'viadinho', 'traveco',
    'asdf', 'qwer', 'lorem ipsum',
    'teste teste', 'nao sei', 'não sei'
  ];

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function temPalavraBloqueada(texto) {
    var n = norm(texto);
    for (var i = 0; i < PALAVRAS_BLOQUEADAS.length; i++) {
      var p = PALAVRAS_BLOQUEADAS[i];
      var re = new RegExp('\\b' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
      if (re.test(n)) return p;
    }
    return null;
  }

  function calcularScoreInicial(user) {
    if (!user || !user.displayName) return 0.3;
    var partes = user.displayName.trim().split(/\s+/).filter(Boolean);
    if (partes.length >= 2 && partes[1].length >= 2) return 0.6;
    if (partes[0] && partes[0].length >= 2) return 0.4;
    return 0.3;
  }

  function dentroBbox(lat, lng) {
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    return lat >= RC_BBOX[1] && lat <= RC_BBOX[3] && lng >= RC_BBOX[0] && lng <= RC_BBOX[2];
  }

  function fazerLogin(callback) {
    var overlay = document.getElementById('loginOverlay');
    if (overlay) overlay.style.display = 'flex';

    var timeoutId = setTimeout(function () {
      if (overlay) overlay.style.display = 'none';
      UI.mostrarToast('Login demorou demais. Tente novamente.', 'erro');
      callback(null);
    }, 30000);

    Core.auth.signInWithPopup(Core.provider)
      .then(function (result) {
        clearTimeout(timeoutId);
        if (overlay) overlay.style.display = 'none';
        callback(result.user);
      })
      .catch(function (err) {
        clearTimeout(timeoutId);
        if (overlay) overlay.style.display = 'none';
        if (err && (err.code === 'auth/popup-closed-by-user' ||
                    err.code === 'auth/cancelled-popup-request' ||
                    err.code === 'auth/user-cancelled')) {
          callback(null);
          return;
        }
        UI.mostrarToast('Erro no login: ' + (err.message || err), 'erro');
        callback(null);
      });
  }

  /* ===== MODAL — MARCAR NO MAPA ===== */
  var mapaMarcar = null;
  var marcadorMarcar = null;
  var latSel = null;
  var lngSel = null;
  var cbSucesso = null;

  function abrirMarcar(callback) {
    var user = Core.getCurrentUser();
    if (!user) {
      fazerLogin(function (u) {
        if (u) abrirMarcar(callback);
      });
      return;
    }
    cbSucesso = callback || null;

    var antigo = document.getElementById('modalMarcarEndereco');
    if (antigo) { if (antigo.__ctrl) antigo.__ctrl.fechar(); else antigo.remove(); }
    latSel = null; lngSel = null;

    var html =
      '<div class="modal-overlay" id="modalMarcarEndereco" role="dialog" aria-modal="true" aria-labelledby="modalMarcarTitulo">' +
        '<div class="modal-conteudo modal-lg">' +
          '<div class="modal-header">' +
            '<h3 id="modalMarcarTitulo">' +
              '<i class="fa-solid fa-map-pin" aria-hidden="true"></i>' +
              'Marcar endereço no mapa' +
            '</h3>' +
            '<button class="modal-close-btn" data-fechar aria-label="Fechar">×</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<p class="marcar-instrucao">Toque no mapa para marcar o local exato. Depois, informe o nome do lugar.</p>' +
            '<div id="mapaMarcar" class="mapa-marcar"></div>' +
            '<div class="marcar-form">' +
              '<label class="marcar-label" for="marcarLogradouro">Nome do lugar / rua *</label>' +
              '<input type="text" id="marcarLogradouro" class="input-pedido" placeholder="Ex: Rua das Flores" maxlength="80" autocomplete="off">' +
              '<div class="form-row">' +
                '<input type="text" id="marcarNumero" class="input-pedido" placeholder="Número" maxlength="10" inputmode="numeric" autocomplete="off">' +
                '<input type="text" id="marcarBairro" class="input-pedido" placeholder="Bairro" maxlength="60" autocomplete="off">' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="modal-footer">' +
            '<button class="btn-modal-fechar" data-fechar>Cancelar</button>' +
            '<button class="btn-modal-primario" id="marcarSalvar" disabled>' +
              '<i class="fa-solid fa-check" aria-hidden="true"></i> Salvar endereço' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var modal = document.getElementById('modalMarcarEndereco');
    var ctrl = EU.criarModalAcessivel();
    ctrl.abrir(modal, function () {
      if (mapaMarcar) { mapaMarcar.remove(); mapaMarcar = null; }
      marcadorMarcar = null;
      if (modal.parentNode) modal.remove();
    });
    modal.__ctrl = ctrl;

    modal.addEventListener('click', function (e) {
      if (e.target === modal) { ctrl.fechar(); return; }
      var btn = e.target.closest('[data-fechar], .modal-close-btn');
      if (btn) { e.preventDefault(); ctrl.fechar(); }
    });

    var btnSalvar = document.getElementById('marcarSalvar');
    var inputLog = document.getElementById('marcarLogradouro');

    function validar() {
      var log = inputLog.value.trim();
      btnSalvar.disabled = !(latSel !== null && lngSel !== null && log.length >= 3);
    }
    inputLog.addEventListener('input', validar);

    btnSalvar.addEventListener('click', salvarMarcacao);

    if (!MAPBOX_TOKEN || !window.mapboxgl) {
      var mapEl = document.getElementById('mapaMarcar');
      if (mapEl) mapEl.innerHTML = '<div class="mapa-indisponivel"><strong>Mapa indisponível</strong><span>Não é possível marcar no momento.</span></div>';
      return;
    }

    mapboxgl.accessToken = MAPBOX_TOKEN;
    mapaMarcar = new mapboxgl.Map({
      container: 'mapaMarcar',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: RC_CENTER,
      zoom: 13,
      language: 'pt-BR',
      cooperativeGestures: true,
      boxZoom: true,
      attributionControl: false
    });
    mapaMarcar.addControl(new mapboxgl.NavigationControl({ showCompass: false }));

    mapaMarcar.on('click', function (e) {
      latSel = e.lngLat.lat;
      lngSel = e.lngLat.lng;
      if (marcadorMarcar) marcadorMarcar.remove();
      marcadorMarcar = new mapboxgl.Marker({ color: '#0a66c2' })
        .setLngLat([lngSel, latSel])
        .addTo(mapaMarcar);
      validar();
    });
  }

  function salvarMarcacao() {
    var user = Core.getCurrentUser();
    if (!user) { UI.mostrarToast('Você precisa estar logado.', 'erro'); return; }

    var logradouro = document.getElementById('marcarLogradouro').value.trim();
    var numero = document.getElementById('marcarNumero').value.trim() || 'SN';
    var bairro = document.getElementById('marcarBairro').value.trim() || '';

    if (logradouro.length < 3) {
      UI.mostrarToast('Informe o nome do lugar (mínimo 3 letras).', 'erro');
      return;
    }
    if (temPalavraBloqueada(logradouro)) { UI.mostrarToast('Esse nome não pode ser usado.', 'erro'); return; }
    if (bairro && temPalavraBloqueada(bairro)) { UI.mostrarToast('Esse bairro não pode ser usado.', 'erro'); return; }

    if (!dentroBbox(latSel, lngSel)) {
      UI.mostrarToast('A marcação precisa estar dentro de Rio Claro.', 'erro');
      return;
    }

    var btn = document.getElementById('marcarSalvar');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Salvando...';

    var score = calcularScoreInicial(user);
    var busca = norm([logradouro, numero !== 'SN' ? numero : '', bairro].filter(Boolean).join(' '));

    var dados = {
      logradouro: logradouro,
      numero: numero,
      bairro: bairro,
      cep: '',
      lat: latSel,
      lng: lngSel,
      busca: busca,
      uid: user.uid,
      nome_usuario: user.displayName || '',
      criado_em: firebase.firestore.FieldValue.serverTimestamp(),
      score: score,
      status: 'ativo'
    };

    Core.db.collection('enderecos_usuario').add(dados)
      .then(function (ref) {
        UI.mostrarToast('Endereço marcado! Obrigado.');

        /* Injeta no cache em memória E no localStorage — aparece imediatamente */
        if (window.EnderecosCache && typeof window.EnderecosCache.adicionarLocal === 'function') {
          window.EnderecosCache.adicionarLocal({
            id: 'usr_' + ref.id,
            logradouro: logradouro,
            numero: numero,
            bairro: bairro,
            cep: '',
            lat: latSel,
            lng: lngSel,
            busca: busca,
            uid: user.uid,
            nome_usuario: user.displayName || '',
            score: score
          });
        }

        var completo = logradouro + (numero !== 'SN' ? ', ' + numero : '') + (bairro ? ' - ' + bairro : '');
        if (typeof cbSucesso === 'function') {
          cbSucesso({
            address: completo,
            lat: latSel,
            lng: lngSel,
            id: 'usr_' + ref.id,
            fonte: 'usuario'
          });
        }
        var modal = document.getElementById('modalMarcarEndereco');
        if (modal && modal.__ctrl) modal.__ctrl.fechar();
      })
      .catch(function (err) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check" aria-hidden="true"></i> Salvar endereço';
        UI.mostrarToast('Erro ao salvar: ' + err.message, 'erro');
      });
  }

  /* ===== MODAL — SUGERIR CORREÇÃO ===== */
  function abrirSugerir(enderecoSugerido) {
    var user = Core.getCurrentUser();
    if (!user) {
      fazerLogin(function (u) {
        if (u) abrirSugerir(enderecoSugerido);
      });
      return;
    }

    var antigo = document.getElementById('modalSugerirCorrecao');
    if (antigo) { if (antigo.__ctrl) antigo.__ctrl.fechar(); else antigo.remove(); }

    var html =
      '<div class="modal-overlay" id="modalSugerirCorrecao" role="dialog" aria-modal="true" aria-labelledby="modalSugerirTitulo">' +
        '<div class="modal-conteudo modal-lista">' +
          '<div class="modal-header">' +
            '<h3 id="modalSugerirTitulo">' +
              '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i>' +
              'O que está errado?' +
            '</h3>' +
            '<button class="modal-close-btn" data-fechar aria-label="Fechar">×</button>' +
          '</div>' +
          '<div class="modal-body">' +
            '<button type="button" class="item-opcao" data-tipo="nome_errado">O nome está errado</button>' +
            '<button type="button" class="item-opcao" data-tipo="nome_antigo">O nome mudou</button>' +
            '<button type="button" class="item-opcao" data-tipo="nao_existe">Esse endereço não existe</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var modal = document.getElementById('modalSugerirCorrecao');
    var ctrl = EU.criarModalAcessivel();
    ctrl.abrir(modal, function () { if (modal.parentNode) modal.remove(); });
    modal.__ctrl = ctrl;

    modal.addEventListener('click', function (e) {
      if (e.target === modal) { ctrl.fechar(); return; }
      var btn = e.target.closest('[data-fechar], .modal-close-btn');
      if (btn) { e.preventDefault(); ctrl.fechar(); return; }
      var opc = e.target.closest('.item-opcao');
      if (opc) {
        var tipo = opc.dataset.tipo;
        ctrl.fechar();
        setTimeout(function () { abrirDetalheSugestao(tipo, enderecoSugerido); }, 200);
      }
    });
  }

  function abrirDetalheSugestao(tipo, enderecoSugerido) {
    var user = Core.getCurrentUser();
    if (!user) { UI.mostrarToast('Faça login primeiro.', 'erro'); return; }

    var titulo = tipo === 'nome_errado' ? 'Qual é o nome correto?' :
                 tipo === 'nome_antigo' ? 'Qual é o nome atual?' :
                 'Confirma que esse endereço não existe?';
    var mostraTexto = tipo !== 'nao_existe';

    var ref = (enderecoSugerido.logradouro || '') +
              (enderecoSugerido.numero && enderecoSugerido.numero !== 'SN' ? ', ' + enderecoSugerido.numero : '');

    var html =
      '<div class="modal-overlay" id="modalDetalheSugestao" role="dialog" aria-modal="true">' +
        '<div class="modal-conteudo modal-sm modal-confirmar">' +
          '<div class="modal-header">' +
            '<h3><i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> ' + titulo + '</h3>' +
          '</div>' +
          '<div class="modal-body">' +
            '<p style="font-size:.85rem;color:#64748b;margin-bottom:.65rem;">' + Core.sanitize(ref) + '</p>' +
            (mostraTexto
              ? '<input type="text" id="sugestaoTexto" class="input-pedido" placeholder="Digite o nome" maxlength="80" style="text-align:left;" autocomplete="off">'
              : '') +
          '</div>' +
          '<div class="modal-footer">' +
            '<button class="btn-modal-fechar" data-fechar>Cancelar</button>' +
            '<button class="btn-modal-primario" id="sugestaoEnviar">Enviar</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.body.insertAdjacentHTML('beforeend', html);
    var modal = document.getElementById('modalDetalheSugestao');
    var ctrl = EU.criarModalAcessivel();
    ctrl.abrir(modal, function () { if (modal.parentNode) modal.remove(); });
    modal.__ctrl = ctrl;

    modal.addEventListener('click', function (e) {
      if (e.target === modal) { ctrl.fechar(); return; }
      var btn = e.target.closest('[data-fechar], .modal-close-btn');
      if (btn) { e.preventDefault(); ctrl.fechar(); }
    });

    var inp = document.getElementById('sugestaoTexto');
    if (inp) setTimeout(function () { inp.focus(); }, 150);

    document.getElementById('sugestaoEnviar').addEventListener('click', function () {
      var sugestao = inp ? inp.value.trim() : '';
      if (mostraTexto && sugestao.length < 2) {
        UI.mostrarToast('Digite o nome.', 'erro'); return;
      }
      if (sugestao && temPalavraBloqueada(sugestao)) {
        UI.mostrarToast('Esse texto não pode ser usado.', 'erro'); return;
      }

      var btn = this;
      btn.disabled = true;
      btn.textContent = 'Enviando...';

      Core.db.collection('enderecos_sugestoes').add({
        tipo: tipo,
        referencia: {
          logradouro: enderecoSugerido.logradouro || '',
          numero: enderecoSugerido.numero || 'SN',
          bairro: enderecoSugerido.bairro || ''
        },
        sugestao: sugestao,
        uid: user.uid,
        nome_usuario: user.displayName || '',
        criado_em: firebase.firestore.FieldValue.serverTimestamp(),
        score: 0.3
      }).then(function () {
        UI.mostrarToast('Obrigado! Sua sugestão foi enviada para análise.');
        ctrl.fechar();
      }).catch(function (err) {
        btn.disabled = false;
        btn.textContent = 'Enviar';
        UI.mostrarToast('Erro ao enviar: ' + err.message, 'erro');
      });
    });
  }

  window.Economizei.TransporteEnderecos = {
    abrirMarcar: abrirMarcar,
    abrirSugerir: abrirSugerir
  };

})();
