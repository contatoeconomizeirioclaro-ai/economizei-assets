/* ==============================================================
   ECONOMIZEI! RIO CLARO — PAINEL SHELL
   Monta o cabeçalho comum dos painéis (logo, nome, status,
   mensagem ao cliente, config, sair) e os modais compartilhados
   (cropper de logo, modal de configurações, popup de novo item).

   Usado por:
     - painel-do-empreendedor.html               (hub)
     - painel-do-empreendedor-modulo-pedidos.html
     - painel-do-empreendedor-modulo-loja.html
     - painel-do-empreendedor-modulo-transporte.html
     - admin.html                                (painel master)

   Depende de:
     - comum/utils.js           (EconomizeiUtils)
     - comum/firebase.js        (EconomizeiFirebase — opcional)
     - Cropper.js               (carregado sob demanda)
     - tokens.css + painel.css

   Expõe:
     window.Economizei.Painel.Shell
   ============================================================== */
(function (global) {
  'use strict';

  var EU = global.EconomizeiUtils;
  if (!EU) {
    console.error('[Painel.Shell] EconomizeiUtils não carregado. Inclua comum/utils.js antes.');
    return;
  }

  // ------------------------------------------------------------------
  // Configuração padrão
  // ------------------------------------------------------------------
  var CLOUDINARY_DEFAULT = { cloud: 'dq7fz5whe', preset: 'economizei_preset' };

  var ROTULOS_PADRAO = {
    loja: {
      aberta:  '🟢 Aberta',
      pausada: '🟡 Pausada',
      fechada: '🔴 Fechada',
      labelMensagem: 'Mensagem exibida aos clientes (opcional)',
      ajudaMensagem: 'Esta mensagem continuará disponível mesmo quando a loja estiver aberta, pausada ou fechada.'
    },
    servico: {
      aberta:  '🟢 Serviço Ativo',
      pausada: '🟡 Serviço Pausado',
      fechada: '🔴 Serviço Indisponível',
      labelMensagem: 'Mensagem exibida aos clientes (opcional)',
      ajudaMensagem: 'Esta mensagem continuará disponível mesmo quando o serviço estiver ativo, pausado ou indisponível.'
    }
  };

  // ------------------------------------------------------------------
  // Estado
  // ------------------------------------------------------------------
  var estado = {
    dados: null,
    email: null,
    contexto: 'loja',
    mostrarMensagem: true,
    chaveConfig: 'painel_config',
    cloudinary: CLOUDINARY_DEFAULT,
    rotulos: ROTULOS_PADRAO.loja,
    aoMudarStatus: null,
    aoMudarLogo: null,
    cropper: null,
    popupConfig: { som: true, vibracao: true, toast: true, popupGrande: true }
  };

  // ==================================================================
  // UTILITÁRIOS INTERNOS
  // ==================================================================
  function $(sel) { return document.querySelector(sel); }
  function $id(id) { return document.getElementById(id); }
  function sanitize(s) { return EU.sanitize(s); }

  function carregarConfigLocal() {
    try {
      var raw = localStorage.getItem(estado.chaveConfig);
      if (!raw) return;
      var obj = JSON.parse(raw);
      if (obj && typeof obj === 'object') {
        estado.popupConfig = Object.assign(estado.popupConfig, obj);
      }
    } catch (e) { /* ignora */ }
  }
  function salvarConfigLocal() {
    try {
      localStorage.setItem(estado.chaveConfig, JSON.stringify(estado.popupConfig));
    } catch (e) { /* localStorage cheio */ }
  }

  function garantirCropperCarregado() {
    if (window.Cropper) return Promise.resolve();
    return new Promise(function (resolve, reject) {
      // CSS
      if (!document.getElementById('css-cropper-painel')) {
        var l = document.createElement('link');
        l.id = 'css-cropper-painel';
        l.rel = 'stylesheet';
        l.href = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.css';
        document.head.appendChild(l);
      }
      // JS
      var existing = document.getElementById('js-cropper-painel');
      if (existing) {
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', reject);
        return;
      }
      var s = document.createElement('script');
      s.id = 'js-cropper-painel';
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.1/cropper.min.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function uploadCloudinary(file, opcoes) {
    opcoes = opcoes || {};
    var cloud = opcoes.cloud || estado.cloudinary.cloud;
    var preset = opcoes.preset || estado.cloudinary.preset;
    var fd = new FormData();
    fd.append('file', file);
    fd.append('upload_preset', preset);
    return fetch('https://api.cloudinary.com/v1_1/' + cloud + '/image/upload', {
      method: 'POST', body: fd
    }).then(function (r) {
      if (!r.ok) throw new Error('Falha no upload (HTTP ' + r.status + ')');
      return r.json();
    }).then(function (data) {
      if (!data || !data.secure_url) {
        var msg = data && data.error && data.error.message ? data.error.message : 'Upload sem URL de retorno.';
        throw new Error(msg);
      }
      return data.secure_url;
    });
  }

  // ==================================================================
  // HEADER — wiring dos elementos que já existem no HTML
  // ==================================================================
  function wireHeader() {
    var d = estado.dados || {};

    // Nome
    var nomeEl = $id('estabelecimentoInfo');
    if (nomeEl) {
      nomeEl.textContent = d.estabelecimentoNome || d[' estabelecimentoNome'] || 'Meu negócio';
    }

    // Logo
    var imgEl = $id('imgLogo');
    if (imgEl) {
      imgEl.src = d.logoUrl || EU.LOGO_PLACEHOLDER;
      imgEl.onerror = function () { this.src = EU.LOGO_PLACEHOLDER; };
    }

    // Status
    var selStatus = $id('statusLojaSelect');
    if (selStatus) {
      preencherSelectStatus(selStatus);
      selStatus.value = d.statusLoja || 'aberta';
      selStatus.onchange = function () {
        alterarStatus(this.value);
      };
    }

    // Mensagem
    wireMensagem(d.statusMessage || '', d.statusLoja || 'aberta');

    // Engrenagem
    var btnEng = $id('btnEngrenagem');
    if (btnEng) btnEng.onclick = abrirConfig;

    // Sair
    var btnSair = $id('btnSairPanel') || $id('btnSair');
    if (btnSair) btnSair.onclick = pedirSair;

    // Logo clicável
    var logoContainer = $('.logo-container');
    var inputLogo = $id('inputLogo');
    if (logoContainer && inputLogo) {
      logoContainer.onclick = function () { inputLogo.click(); };
      logoContainer.setAttribute('role', 'button');
      logoContainer.setAttribute('tabindex', '0');
      inputLogo.onchange = function () { prepararRecorteLogo(this); };
    }
  }

  function preencherSelectStatus(sel) {
    var r = estado.rotulos;
    sel.innerHTML =
      '<option value="aberta">'  + sanitize(r.aberta)  + '</option>' +
      '<option value="pausada">' + sanitize(r.pausada) + '</option>' +
      '<option value="fechada">' + sanitize(r.fechada) + '</option>';
  }

  // ==================================================================
  // MENSAGEM AO CLIENTE
  // ==================================================================
  function garantirMensagemBox() {
    if (!estado.mostrarMensagem) return null;
    var topo = $('.topo-painel');
    if (!topo) return null;

    var box = topo.querySelector('.mensagem-cliente-box');
    if (!box) {
      box = document.createElement('div');
      box.className = 'mensagem-cliente-box';
      box.innerHTML =
        '<div class="mensagem-cliente-campo">' +
          '<label for="statusMessageInput">' + sanitize(estado.rotulos.labelMensagem) + '</label>' +
          '<input type="text" id="statusMessageInput" class="status-message-input" ' +
                 'placeholder="Ex.: Pedidos após 21h serão entregues amanhã." ' +
                 'aria-label="Mensagem exibida aos clientes" maxlength="180">' +
          '<small class="mensagem-cliente-ajuda">' + sanitize(estado.rotulos.ajudaMensagem) + '</small>' +
        '</div>' +
        '<button type="button" class="btn-salvar-mensagem" id="btnSalvarMensagemStatus">Salvar mensagem</button>';

      // insere depois do .header-main
      var headerMain = topo.querySelector('.header-main');
      if (headerMain && headerMain.nextSibling) {
        topo.insertBefore(box, headerMain.nextSibling);
      } else {
        topo.appendChild(box);
      }
    }
    return box;
  }

  function wireMensagem(valorInicial, statusInicial) {
    var box = garantirMensagemBox();
    if (!box) return;

    var input = box.querySelector('#statusMessageInput');
    var btn = box.querySelector('#btnSalvarMensagemStatus');

    if (input) {
      input.value = valorInicial || '';
      input.onblur = function () { salvarMensagem(false); };
    }
    if (btn) {
      btn.onclick = function () { salvarMensagem(true); };
    }
    atualizarCorMensagem(statusInicial || 'aberta');
  }

  function atualizarCorMensagem(status) {
    var box = $('.mensagem-cliente-box');
    if (!box) return;
    box.classList.remove('status-aberta', 'status-pausada', 'status-fechada');
    box.classList.add('status-' + (['aberta','pausada','fechada'].indexOf(status) >= 0 ? status : 'aberta'));
  }

  function salvarMensagem(mostrarConfirmacao) {
    var input = $id('statusMessageInput');
    if (!input) return;
    var msg = input.value.trim();

    if (!global.EconomizeiFirebase || !global.EconomizeiFirebase.db || !estado.email) {
      if (mostrarConfirmacao) EU.mostrarToast('Mensagem salva localmente (sem conexão).', 'sucesso');
      return;
    }
    global.EconomizeiFirebase.db.collection('lojistas').doc(estado.email)
      .update({ statusMessage: msg })
      .then(function () {
        if (mostrarConfirmacao) EU.mostrarToast(msg ? 'Mensagem salva!' : 'Mensagem removida.', 'sucesso');
      })
      .catch(function (e) {
        EU.mostrarToast('Erro ao salvar mensagem: ' + e.message, 'erro');
      });
  }

  // ==================================================================
  // STATUS DA LOJA
  // ==================================================================
  function alterarStatus(novoStatus) {
    atualizarCorMensagem(novoStatus);
    if (!global.EconomizeiFirebase || !global.EconomizeiFirebase.db || !estado.email) {
      if (typeof estado.aoMudarStatus === 'function') estado.aoMudarStatus(novoStatus);
      return;
    }
    global.EconomizeiFirebase.db.collection('lojistas').doc(estado.email)
      .update({ statusLoja: novoStatus })
      .then(function () {
        EU.mostrarToast('Status atualizado!', 'sucesso');
        if (typeof estado.aoMudarStatus === 'function') estado.aoMudarStatus(novoStatus);
      })
      .catch(function (e) {
        EU.mostrarToast('Erro ao atualizar status: ' + e.message, 'erro');
      });
  }

  function atualizarStatusUI(novoStatus, mensagem) {
    var sel = $id('statusLojaSelect');
    if (sel) sel.value = novoStatus;
    atualizarCorMensagem(novoStatus);

    var input = $id('statusMessageInput');
    if (input && typeof mensagem === 'string') input.value = mensagem;
  }

  // ==================================================================
  // CROPPER DE LOGO
  // ==================================================================
  function garantirModalCropper() {
    if ($id('cropperModal')) return;
    var el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'cropperModal';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Ajustar logo');
    el.innerHTML =
      '<div class="modal-conteudo">' +
        '<div class="modal-header">' +
          '<h3>Ajustar logo</h3>' +
          '<button type="button" class="btn-pequeno" data-fechar-cropper aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="cropper-guia">Arraste para posicionar. Use a rodinha do mouse para zoom.</div>' +
        '<div class="cropper-wrapper"><img id="imagemParaRecortar" alt=""></div>' +
        '<div class="cropper-footer">' +
          '<button type="button" class="btn-secundario" data-fechar-cropper>Cancelar</button>' +
          '<button type="button" class="btn-primary" id="btnConfirmarRecorte">Salvar logo</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);

    el.addEventListener('click', function (e) {
      if (e.target === el) fecharCropper();
      if (e.target.closest('[data-fechar-cropper]')) fecharCropper();
    });
    $id('btnConfirmarRecorte').addEventListener('click', confirmarRecorte);
  }

  function prepararRecorteLogo(input) {
    if (!input.files || !input.files[0]) return;
    var file = input.files[0];

    garantirCropperCarregado().then(function () {
      garantirModalCropper();
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = $id('imagemParaRecortar');
        img.src = e.target.result;
        $id('cropperModal').classList.add('active');
        if (estado.cropper) estado.cropper.destroy();
        estado.cropper = new Cropper(img, {
          aspectRatio: 1,
          viewMode: 1,
          autoCropArea: 1,
          responsive: true,
          guides: false,
          center: true,
          highlight: false,
          background: false,
          modal: true
        });
      };
      reader.readAsDataURL(file);
    }).catch(function (e) {
      EU.mostrarToast('Erro ao carregar o editor de imagem: ' + e.message, 'erro');
    });
  }

  function fecharCropper() {
    var modal = $id('cropperModal');
    if (modal) modal.classList.remove('active');
    if (estado.cropper) { estado.cropper.destroy(); estado.cropper = null; }
    var input = $id('inputLogo');
    if (input) input.value = '';
  }

  function confirmarRecorte() {
    if (!estado.cropper) return;
    EU.showLoading('Enviando logo...', { overlayId: 'loadingOverlay', textoId: 'loadingText', modoFlex: false });
    var canvas;
    try {
      canvas = estado.cropper.getCroppedCanvas({ width: 300, height: 300 });
    } catch (e) {
      EU.hideLoading();
      EU.mostrarToast('Erro ao processar imagem.', 'erro');
      return;
    }
    canvas.toBlob(function (blob) {
      if (!blob) {
        EU.hideLoading();
        EU.mostrarToast('Erro ao gerar imagem.', 'erro');
        return;
      }
      uploadCloudinary(blob).then(function (url) {
        if (!global.EconomizeiFirebase || !global.EconomizeiFirebase.db || !estado.email) {
          atualizarLogoLocal(url);
          EU.hideLoading();
          EU.mostrarToast('Logo atualizada (local).', 'sucesso');
          fecharCropper();
          return;
        }
        return global.EconomizeiFirebase.db.collection('lojistas').doc(estado.email)
          .update({ logoUrl: url })
          .then(function () {
            atualizarLogoLocal(url);
            EU.hideLoading();
            EU.mostrarToast('Logo atualizada!', 'sucesso');
            fecharCropper();
          });
      }).catch(function (e) {
        EU.hideLoading();
        EU.mostrarToast('Erro ao enviar logo: ' + e.message, 'erro');
      });
    }, 'image/webp', 0.9);
  }

  function atualizarLogoLocal(url) {
    var img = $id('imgLogo');
    if (img) img.src = url;
    if (typeof estado.aoMudarLogo === 'function') estado.aoMudarLogo(url);
  }

  // ==================================================================
  // MODAL DE CONFIGURAÇÕES
  // ==================================================================
  function garantirModalConfig() {
    if ($id('modalPainelConfig')) return;
    var el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'modalPainelConfig';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', 'Configurações');
    el.innerHTML =
      '<div class="modal-conteudo" style="max-width:400px;">' +
        '<div class="modal-header">' +
          '<h3>Configurações</h3>' +
          '<button type="button" class="btn-pequeno" data-fechar-config aria-label="Fechar">×</button>' +
        '</div>' +
        '<div class="toggle-item">' +
          '<span>Som</span>' +
          '<label class="toggle-switch"><input type="checkbox" id="cfgSom"><span class="slider"></span></label>' +
        '</div>' +
        '<div class="toggle-item">' +
          '<span>Vibração</span>' +
          '<label class="toggle-switch"><input type="checkbox" id="cfgVibracao"><span class="slider"></span></label>' +
        '</div>' +
        '<div class="toggle-item">' +
          '<span>Aviso flutuante</span>' +
          '<label class="toggle-switch"><input type="checkbox" id="cfgToast"><span class="slider"></span></label>' +
        '</div>' +
        '<div class="toggle-item">' +
          '<span>Pop-up de novo item</span>' +
          '<label class="toggle-switch"><input type="checkbox" id="cfgPopup"><span class="slider"></span></label>' +
        '</div>' +
        '<button type="button" class="btn-primary" id="cfgSalvar">Salvar</button>' +
      '</div>';
    document.body.appendChild(el);

    el.addEventListener('click', function (e) {
      if (e.target === el) fecharConfig();
      if (e.target.closest('[data-fechar-config]')) fecharConfig();
    });
    $id('cfgSalvar').addEventListener('click', salvarConfig);
  }

  function abrirConfig() {
    garantirModalConfig();
    $id('cfgSom').checked = !!estado.popupConfig.som;
    $id('cfgVibracao').checked = !!estado.popupConfig.vibracao;
    $id('cfgToast').checked = !!estado.popupConfig.toast;
    $id('cfgPopup').checked = !!estado.popupConfig.popupGrande;
    $id('modalPainelConfig').classList.add('active');
  }

  function fecharConfig() {
    var el = $id('modalPainelConfig');
    if (el) el.classList.remove('active');
  }

  function salvarConfig() {
    estado.popupConfig = {
      som: $id('cfgSom').checked,
      vibracao: $id('cfgVibracao').checked,
      toast: $id('cfgToast').checked,
      popupGrande: $id('cfgPopup').checked
    };
    salvarConfigLocal();
    fecharConfig();
    EU.mostrarToast('Configurações salvas!', 'sucesso');
  }

  // ==================================================================
  // POPUP NOVO ITEM (pedido / corrida / solicitação)
  // ==================================================================
  function garantirPopupNovo() {
    if ($id('popupPainelNovo')) return;
    var el = document.createElement('div');
    el.className = 'popup-novo';
    el.id = 'popupPainelNovo';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.innerHTML =
      '<div class="popup-card">' +
        '<h3 id="popupPainelTitulo">Novo</h3>' +
        '<p class="popup-codigo" id="popupPainelCodigo"></p>' +
        '<p class="popup-valor" id="popupPainelValor"></p>' +
        '<p class="popup-cliente" id="popupPainelCliente"></p>' +
        '<button type="button" class="btn-primary" id="popupPainelFechar">Ver</button>' +
      '</div>';
    document.body.appendChild(el);

    $id('popupPainelFechar').addEventListener('click', fecharPopupNovo);
    el.addEventListener('click', function (e) {
      if (e.target === el) fecharPopupNovo();
    });
  }

  function mostrarPopupNovo(info) {
    info = info || {};
    if (!estado.popupConfig.popupGrande) {
      if (estado.popupConfig.toast) {
        EU.mostrarToast(info.titulo || 'Novo item recebido.', 'sucesso');
      }
      if (estado.popupConfig.som) tocarSom();
      if (estado.popupConfig.vibracao && navigator.vibrate) navigator.vibrate([200, 100, 200]);
      return;
    }
    garantirPopupNovo();
    $id('popupPainelTitulo').textContent  = info.titulo  || '🛎️ NOVO ITEM!';
    $id('popupPainelCodigo').textContent  = info.codigo  || '';
    $id('popupPainelValor').textContent   = info.valor   || '';
    $id('popupPainelCliente').textContent = info.cliente || '';
    $id('popupPainelFechar').textContent  = info.textoBotao || 'Ver';
    $id('popupPainelNovo').classList.add('active');

    if (estado.popupConfig.som) tocarSom();
    if (estado.popupConfig.vibracao && navigator.vibrate) navigator.vibrate([200, 100, 200]);

    // auto-fecha em 8s
    clearTimeout(estado._popupTimer);
    estado._popupTimer = setTimeout(fecharPopupNovo, 8000);
  }

  function fecharPopupNovo() {
    var el = $id('popupPainelNovo');
    if (el) el.classList.remove('active');
    clearTimeout(estado._popupTimer);
  }

  function tocarSom() {
    try {
      new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
        .play().catch(function () {});
    } catch (e) { /* áudio bloqueado */ }
  }

  // ==================================================================
  // SAIR
  // ==================================================================
  function pedirSair() {
    var modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.innerHTML =
      '<div class="modal-conteudo" style="max-width:320px;">' +
        '<div class="modal-header">' +
          '<h3>Confirmar saída</h3>' +
          '<button class="btn-pequeno" data-cancelar-sair aria-label="Fechar">×</button>' +
        '</div>' +
        '<p style="margin-bottom:var(--spacing-lg);">Deseja realmente sair do painel?</p>' +
        '<div style="display:flex; gap:var(--spacing-md);">' +
          '<button class="btn-primary" id="confirmarSairPainel">Sair</button>' +
          '<button class="btn-pequeno" data-cancelar-sair>Cancelar</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.remove();
      if (e.target.closest('[data-cancelar-sair]')) modal.remove();
    });
    $id('confirmarSairPainel').addEventListener('click', function () {
      modal.remove();
      if (global.EconomizeiFirebase && global.EconomizeiFirebase.auth) {
        global.EconomizeiFirebase.auth.signOut();
      } else {
        location.reload();
      }
    });
  }

  // ==================================================================
  // INICIAR
  // ==================================================================
  function iniciar(opcoes) {
    opcoes = opcoes || {};
    if (!opcoes.dados) {
      console.warn('[Painel.Shell] iniciar() chamado sem "dados". O header ficará vazio.');
    }
    estado.dados = opcoes.dados || {};
    estado.email = opcoes.email || (opcoes.dados && opcoes.dados.id) || null;
    estado.contexto = opcoes.contexto || 'loja';
    estado.mostrarMensagem = opcoes.mostrarMensagem !== false; // default true
    estado.chaveConfig = opcoes.chaveConfig || ('painel_config_' + estado.contexto);
    estado.cloudinary = opcoes.cloudinary || CLOUDINARY_DEFAULT;
    estado.rotulos = opcoes.rotulos || ROTULOS_PADRAO[estado.contexto] || ROTULOS_PADRAO.loja;
    estado.aoMudarStatus = opcoes.aoMudarStatus || null;
    estado.aoMudarLogo = opcoes.aoMudarLogo || null;

    carregarConfigLocal();
    wireHeader();
    garantirModalCropper();
  }

  // ==================================================================
  // EXPOSIÇÃO
  // ==================================================================
  global.Economizei = global.Economizei || {};
  global.Economizei.Painel = global.Economizei.Painel || {};
  global.Economizei.Painel.Shell = {
    iniciar: iniciar,
    mostrarPopupNovo: mostrarPopupNovo,
    fecharPopupNovo: fecharPopupNovo,
    atualizarStatusUI: atualizarStatusUI,
    atualizarLogo: atualizarLogoLocal,
    abrirConfig: abrirConfig,
    configAtual: function () { return Object.assign({}, estado.popupConfig); }
  };
})(window);
