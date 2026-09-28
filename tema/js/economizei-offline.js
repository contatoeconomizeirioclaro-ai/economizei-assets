/*!
 * Economizei! Rio Claro — tela offline com mini-jogo, como parte do SITE.
 *
 * Script único e autônomo (sem dependências, sem Service Worker): quando a conexão cai
 * com a página aberta, mostra uma tela por cima do site com o joguinho; quando volta,
 * recarrega sozinho. O CSS fica em Shadow DOM, então o tema do site não interfere.
 *
 * Configuração opcional (defina ANTES de carregar o script):
 *   window.EconomizeiOffline = {
 *     ping: '/robots.txt',   // recurso do próprio site usado para testar a conexão de verdade
 *     recarregar: true,      // recarrega a página quando a conexão volta (false = só fecha a tela)
 *     noApp: false           // true = também roda dentro do app nativo (por padrão o app cuida disso)
 *   };
 */
(function () {
  'use strict';

  if (window.__economizeiOffline) return;
  window.__economizeiOffline = true;

  var cfg = window.EconomizeiOffline || {};
  var PING = cfg.ping || '/robots.txt';
  var RECARREGAR = cfg.recarregar !== false;

  // Dentro do app (iframe do shell / WebView nativo) o offline já é tratado pelo próprio app.
  try { if (window.top !== window.self) return; } catch (e) { return; }
  if (!cfg.noApp && /; wv\)/.test(navigator.userAgent)) return;

  var host = null, root = null, els = null;
  var visivel = false;      // tela offline aberta
  var fechada = false;      // usuário fechou; só reabre depois que a conexão voltar e cair de novo
  var timerChecagem = null;
  var timerRecarregar = null;
  var focoAnterior = null;
  var verificando = false;

  /* ====================== Conexão ====================== */

  // navigator.onLine engana (Wi-Fi sem internet aparece como "online"), então testa de verdade:
  // qualquer resposta HTTP do próprio site prova que há rede; só falha de rede conta como offline.
  function temConexao() {
    if (!navigator.onLine) return Promise.resolve(false);
    return new Promise(function (resolve) {
      var ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      var t = setTimeout(function () { if (ctrl) ctrl.abort(); resolve(false); }, 6000);
      var url = PING + (PING.indexOf('?') < 0 ? '?' : '&') + '_=' + Date.now();
      fetch(url, { cache: 'no-store', signal: ctrl ? ctrl.signal : undefined })
        .then(function () { clearTimeout(t); resolve(true); })
        .catch(function () { clearTimeout(t); resolve(false); });
    });
  }

  function verificar() {
    if (verificando) return Promise.resolve();
    verificando = true;
    return temConexao().then(function (ok) {
      verificando = false;
      if (ok) voltou(); else caiu();
    });
  }

  function caiu() {
    clearTimeout(timerRecarregar);
    timerRecarregar = null;
    if (visivel) { setStatus(false); return; }
    if (fechada) return;
    abrir();
  }

  function voltou() {
    fechada = false;
    if (!visivel) return;
    setStatus(true);
    clearTimeout(timerRecarregar);
    timerRecarregar = setTimeout(function () {
      if (RECARREGAR) { location.reload(); } else { fecharTela(); }
    }, 700);
  }

  /* ====================== Tela (Shadow DOM) ====================== */

  var CSS =
    ':host{all:initial}*{box-sizing:border-box}' +
    '.ov{position:fixed;inset:0;z-index:2147483647;display:none;overflow:auto;overscroll-behavior:contain;' +
    'align-items:center;justify-content:center;padding:18px;background:rgba(9,26,49,.76);' +
    'backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);' +
    'font-family:"Open Sans",-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;color:#1a3463}' +
    '.ov.on{display:flex}' +
    '.card{position:relative;width:100%;max-width:500px;background:#fffdf8;border-radius:22px;overflow:hidden;' +
    'border:1px solid rgba(255,255,255,.65);box-shadow:0 28px 90px rgba(2,17,37,.42)}' +
    '.cover{position:relative;isolation:isolate;min-height:228px;padding:21px 25px 22px;color:#fff;' +
    'background:linear-gradient(145deg,#102e53 0%,#1d5279 68%,#28647c 100%);overflow:hidden}' +
    '.cover:after{content:"";position:absolute;inset:0;z-index:-1;' +
    'background:linear-gradient(90deg,rgba(14,42,73,.08) 0%,rgba(14,42,73,.12) 58%,rgba(14,42,73,0) 100%)}' +
    '.route-art{position:absolute;z-index:-2;right:-3%;bottom:-1px;width:86%;height:100%;opacity:.48;pointer-events:none}' +
    '.brand-row{display:flex;align-items:center;justify-content:space-between;gap:12px;position:relative;z-index:1}' +
    '.brand{display:flex;align-items:center;gap:8px;color:#fff}' +
    '.brand svg{flex:0 0 auto;filter:drop-shadow(0 2px 4px rgba(0,0,0,.18))}' +
    '.brand-name{font-family:Poppins,"Open Sans",sans-serif;font-size:16px;font-weight:700;line-height:1}' +
    '.brand-name span{display:block;color:#f3d987;font-family:"Open Sans",sans-serif;font-size:8px;' +
    'font-weight:700;letter-spacing:.13em;text-transform:uppercase;margin-top:5px}' +
    '.brand-stamp{padding:6px 9px;border:1px solid rgba(255,255,255,.32);border-radius:999px;' +
    'font-size:8px;font-weight:700;letter-spacing:.12em;color:#fff;white-space:nowrap}' +
    '.cover-copy{position:relative;z-index:1;max-width:310px;margin-top:24px}' +
    '.status{display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(255,255,255,.3);' +
    'background:rgba(8,25,47,.28);border-radius:999px;padding:6px 10px;font-size:9px;' +
    'font-weight:700;letter-spacing:.09em;color:#fff;margin:0 0 10px}' +
    '.status.on{background:rgba(235,255,242,.16);border-color:rgba(202,245,218,.48);color:#e8ffef}' +
    '.status-dot{width:7px;height:7px;border-radius:50%;background:#f2c542;box-shadow:0 0 0 3px rgba(242,197,66,.17)}' +
    'h1{font-family:Poppins,"Open Sans",sans-serif;font-size:24px;line-height:1.12;letter-spacing:-.025em;' +
    'margin:0 0 8px;color:#fff;max-width:290px}' +
    '.cover-copy p{font-size:12px;line-height:1.55;color:rgba(255,255,255,.83);margin:0;max-width:285px}' +
    '.game-body{padding:18px 23px 19px;background:#fffdf8}' +
    '.game-heading{display:flex;align-items:flex-start;gap:10px;margin:0 0 11px}' +
    '.game-mark{width:31px;height:36px;flex:0 0 auto;display:grid;place-items:center;background:#f7eed7;' +
    'border:1px solid #efe0b8;border-radius:11px}' +
    '.game-mark svg{width:18px;height:22px}' +
    '.game-title{font-family:Poppins,"Open Sans",sans-serif;font-size:14px;line-height:1.2;font-weight:700;color:#1a3463;margin:0}' +
    '.game-kicker{font-size:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#b88914;margin:0 0 4px}' +
    '.game-sub{font-size:10px;line-height:1.45;color:#747b85;margin:3px 0 0}' +
    '.canvas-frame{position:relative;padding:5px;background:#f0f3ee;border:1px solid #dbe4de;border-radius:15px;' +
    'box-shadow:inset 0 1px 0 #fff}' +
    'canvas{display:block;width:100%;height:auto;background:#e7f3f4;border:1px solid rgba(26,52,99,.08);' +
    'border-radius:10px;touch-action:none}' +
    '.score{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;margin-top:10px}' +
    '.score-item{display:flex;align-items:center;gap:5px;min-width:0;padding:7px 7px;' +
    'background:#f4f6f8;border:1px solid #e6eaf0;border-radius:10px}' +
    '.score-icon{width:19px;height:19px;display:grid;place-items:center;border-radius:50%;' +
    'background:#fff1c6;color:#a87806;font-size:11px;font-weight:800}' +
    '.score-label{font-size:8px;font-weight:700;letter-spacing:.08em;color:#78808d}' +
    '.score-value{font-size:12px;font-weight:800;color:#1a3463;margin-left:auto;white-space:nowrap}' +
    '.dica{text-align:center;font-size:9px;color:#858a96;margin:8px 0 0;min-height:14px}' +
    'button{font:inherit;cursor:pointer}' +
    '.actions{display:flex;justify-content:center;gap:9px;margin-top:13px;flex-wrap:wrap}' +
    '.retry,.fechar{min-height:38px;padding:9px 16px;border-radius:999px;font-size:11px;font-weight:700;' +
    'transition:transform .15s ease,background .15s ease}' +
    '.retry{background:#f2c542;color:#18345c;border:1px solid #e7b936;box-shadow:0 4px 12px rgba(199,151,26,.17)}' +
    '.retry:hover{background:#f7d66e}.retry:active,.fechar:active{transform:scale(.98)}' +
    '.fechar{background:#fff;color:#1a3463;border:1px solid #d9dfe7}' +
    '.fechar:hover{background:#f5f7fa}' +
    '.footer{display:flex;align-items:center;justify-content:center;gap:5px;margin-top:13px;' +
    'font-size:9px;color:#969ba6;text-align:center}' +
    'button:focus-visible{outline:3px solid #e2aa22;outline-offset:3px}' +
    '@media(max-width:420px){.ov{padding:10px}.cover{min-height:212px;padding:18px 18px 19px}' +
    '.route-art{width:96%;opacity:.37}.cover-copy{margin-top:21px}.brand-stamp{font-size:7px;padding:5px 7px}' +
    'h1{font-size:22px}.game-body{padding:15px 15px 16px}.game-sub{font-size:9px}}' +
    '@media(max-height:720px){.ov{align-items:flex-start}.cover{min-height:190px;padding-top:16px;padding-bottom:17px}' +
    '.cover-copy{margin-top:16px}.game-body{padding-top:13px;padding-bottom:13px}.game-heading{margin-bottom:8px}' +
    '.score{margin-top:7px}.actions{margin-top:9px}.footer{margin-top:8px}}' +
    '@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;' +
    'animation-duration:.01ms!important;transition-duration:.01ms!important}}';

  var HTML =
    '<div class="ov" role="dialog" aria-modal="true" aria-labelledby="eco-offline-title" aria-describedby="eco-offline-description">' +
    '<section class="card">' +
    '<header class="cover">' +
    '<svg class="route-art" viewBox="0 0 520 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">' +
    '<path fill="#83b3a2" d="M0 183 58 135l34 29 70-89 58 68 57-49 51 56 56-85 58 69 43-37 35 36v107H0z"/>' +
    '<path fill="#284d67" d="M0 202 79 157l43 31 67-51 54 39 61-67 58 62 53-44 62 45 43-31v99H0z"/>' +
    '<path d="M20 170c74 26 114-8 160 7 54 18 64 40 118 25 52-15 65-56 114-46 33 7 54 21 91 9" fill="none" stroke="#f3d987" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 9"/>' +
    '<g fill="#f3d987"><path d="M101 157c-6 0-10 4-10 10 0 7 10 18 10 18s10-11 10-18c0-6-4-10-10-10zm0 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/><path d="M330 129c-6 0-10 4-10 10 0 7 10 18 10 18s10-11 10-18c0-6-4-10-10-10zm0 13a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/></g>' +
    '</svg>' +
    '<div class="brand-row"><div class="brand" aria-label="Economizei! Rio Claro, guia local">' +
    '<svg width="27" height="31" viewBox="0 0 24 28" aria-hidden="true" focusable="false">' +
    '<path fill="#f2c542" d="M12 1C6.8 1 2.6 5.1 2.6 10.2c0 6.3 9.4 16.8 9.4 16.8s9.4-10.5 9.4-16.8C21.4 5.1 17.2 1 12 1z"/>' +
    '<circle cx="12" cy="10" r="5.5" fill="#1a3463"/><circle cx="12" cy="10" r="2" fill="#fff"/></svg>' +
    '<div class="brand-name">Economizei!<span>Guia local · Rio Claro/RJ</span></div></div>' +
    '<span class="brand-stamp">MENOS BUSCA, MAIS ACHADO</span></div>' +
    '<div class="cover-copy"><div class="status" role="status" aria-live="polite" aria-atomic="true"><span class="status-dot"></span> SEM CONEXÃO</div>' +
    '<h1 id="eco-offline-title">Sem sinal, ainda no caminho.</h1>' +
    '<p id="eco-offline-description">A internet deu uma pausa. Assim que voltar, o guia abre de novo por aqui.</p></div>' +
    '</header>' +
    '<div class="game-body">' +
    '<div class="game-heading"><div class="game-mark" aria-hidden="true"><svg viewBox="0 0 24 28"><path fill="#e2aa22" d="M12 1C6.8 1 2.6 5.1 2.6 10.2c0 6.3 9.4 16.8 9.4 16.8s9.4-10.5 9.4-16.8C21.4 5.1 17.2 1 12 1z"/><circle cx="12" cy="10" r="5.5" fill="#1a3463"/><circle cx="12" cy="10" r="2" fill="#fff"/></svg></div>' +
    '<div><p class="game-kicker">DESAFIO DO GUIA</p><h2 class="game-title">Uma volta por Rio Claro</h2>' +
    '<p class="game-sub">Pule as barreiras e siga os pins por lugares de verdade.</p></div></div>' +
    '<div class="canvas-frame"><canvas width="360" height="194" aria-label="Minijogo do guia local: pule barreiras, colete pins e veja a Pedra do Bispo, a Igreja São Joaquim da Grama e o Monumento à Fênix em Lídice"></canvas></div>' +
    '<div class="score"><div class="score-item"><span class="score-icon" aria-hidden="true">●</span><span class="score-label">PINS</span><span class="score-value pins-count">0</span></div>' +
    '<div class="score-item"><span class="score-icon" aria-hidden="true">+</span><span class="score-label">PONTOS</span><span class="score-value pontos">0</span></div>' +
    '<div class="score-item"><span class="score-icon" aria-hidden="true">★</span><span class="score-label">RECORDE</span><span class="score-value recorde">0</span></div></div>' +
    '<div class="dica">Toque ou aperte Espaço/↑ para pular</div>' +
    '<div class="actions"><button class="retry" type="button">Testar conexão</button><button class="fechar" type="button">Fechar aviso</button></div>' +
    '<div class="footer">Economizei! Rio Claro <span aria-hidden="true">·</span> Menos busca, mais achado.</div>' +
    '</div></section></div>';

  function construir() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'economizei-offline';
    root = host.attachShadow ? host.attachShadow({ mode: 'open' }) : host;
    root.innerHTML = '<style>' + CSS + '</style>' + HTML;
    document.body.appendChild(host);

    els = {
      ov: root.querySelector('.ov'),
      status: root.querySelector('.status'),
      canvas: root.querySelector('canvas'),
      pontos: root.querySelector('.pontos'),
      pins: root.querySelector('.pins-count'),
      recorde: root.querySelector('.recorde'),
      dica: root.querySelector('.dica'),
      retry: root.querySelector('.retry'),
      fechar: root.querySelector('.fechar')
    };

    els.retry.addEventListener('click', function () {
      els.status.innerHTML = '<span class="status-dot" aria-hidden="true"></span> VERIFICANDO…';
      els.status.className = 'status';
      setTimeout(verificar, 300);
    });
    els.fechar.addEventListener('click', function () { fechada = true; fecharTela(); });
    els.canvas.addEventListener('pointerdown', function (e) { e.preventDefault(); pular(); });
    els.ov.addEventListener('pointerdown', function (e) {
      if (e.target === els.canvas || e.target === els.retry || e.target === els.fechar) return;
      if (!vivo) pular();
    });
    iniciarJogo();
  }

  function setStatus(online) {
    if (!els) return;
    els.status.innerHTML = '<span class="status-dot" aria-hidden="true"></span> ' + (online ? 'CONEXÃO RESTABELECIDA — ATUALIZANDO…' : 'SEM CONEXÃO');
    els.status.className = online ? 'status on' : 'status';
  }

  function abrir() {
    construir();
    focoAnterior = document.activeElement;
    visivel = true;
    els.ov.className = 'ov on';
    setTimeout(function () { if (visivel && els) els.retry.focus(); }, 0);
    setStatus(false);
    desenharTudo();
    clearInterval(timerChecagem);
    timerChecagem = setInterval(verificar, 5000);
  }

  function fecharTela() {
    visivel = false;
    clearInterval(timerChecagem);
    clearTimeout(timerRecarregar);
    timerRecarregar = null;
    pararJogo();
    if (els) els.ov.className = 'ov';
    if (focoAnterior && typeof focoAnterior.focus === 'function' && document.contains(focoAnterior)) focoAnterior.focus();
    focoAnterior = null;
  }

  /* ====================== Mini-jogo ====================== */
  /* Corredor pela cidade: personagem correndo com o celular na mao, marcadores de lugares,
     obstaculos da cidade e um horizonte que cicla por
     tres pontos turisticos de Rio Claro/RJ (Pedra do Bispo, ruinas da Igreja da
     Fazenda da Grama e a Estatua da Fenix), tudo desenhado em canvas -- sem imagens
     externas, entao continua funcionando 100% offline. */

  var ctx, W = 360, H = 194, CHAO = H - 40, HORIZON = CHAO;
  var CHAVE = 'economizei-offline-recorde';

  var NAVY = '#1a3463', NAVY_SOFT = 'rgba(26,52,99,0.78)', NAVY_HAZE = 'rgba(26,52,99,0.16)';
  var GOLD = '#e2aa22', GOLD_SOFT = 'rgba(226,170,34,0.8)', CREME = '#fff8e9';
  var PEDRA = '#7f8986', PEDRA_LUZ = '#b7b7a8', PEDRA_SOMBRA = '#52636a';

  var player = { x: 22, y: 0, w: 26, h: 34, vy: 0, pulando: false };
  var GRAVIDADE = 0.9, FORCA_PULO = -12;

  var OBST_W = 24, OBST_H = 30;
  var obstaculos = [], pins = [];
  var velocidade = 4.2, pontos = 0, pinsColetados = 0, vivo = false;
  var tempo = 0, ultimoObstaculo = 0, ultimoPin = 0, raf = null, ultimoTs = 0, recorde = 0;
  var bgScroll = 0, ceuGrad = null;

  // Rota ilustrada por três marcos reais de Rio Claro e do distrito de Lídice.
  var LOOP = 900;
  var PONTOS_TURISTICOS = [
    { pos: 150, nome: 'PEDRA DO BISPO', desenha: desenharPedraDoBispo },
    { pos: 450, nome: 'SÃO JOAQUIM DA GRAMA', desenha: desenharIgrejaDaGrama },
    { pos: 750, nome: 'FÊNIX · LÍDICE', desenha: desenharEstatuaDaFenix }
  ];

  function iniciarJogo() {
    ctx = els.canvas.getContext('2d');
    var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    els.canvas.width = W * dpr;
    els.canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ceuGrad = ctx.createLinearGradient(0, 0, 0, CHAO);
    ceuGrad.addColorStop(0, '#bfe4f0');
    ceuGrad.addColorStop(0.62, '#e7f3ee');
    ceuGrad.addColorStop(0.9, '#f3d18a');
    ceuGrad.addColorStop(1, CREME);
    try { recorde = parseInt(localStorage.getItem(CHAVE) || '0', 10) || 0; } catch (e) {}
    els.recorde.textContent = Math.floor(recorde / 5);
    player.y = CHAO - player.h;
  }

  function resetar() {
    player.y = CHAO - player.h; player.vy = 0; player.pulando = false;
    obstaculos = []; pins = []; velocidade = 4.2; pontos = 0; pinsColetados = 0; bgScroll = 0;
    ultimoObstaculo = tempo; ultimoPin = tempo; vivo = true;
    els.pins.textContent = '0';
    els.pontos.textContent = '0';
    els.dica.style.visibility = 'hidden';
  }

  function pular() {
    if (!ctx) return;
    if (!vivo) { resetar(); ultimoTs = 0; raf = requestAnimationFrame(loop); return; }
    if (!player.pulando) { player.vy = FORCA_PULO; player.pulando = true; }
  }

  function pararJogo() {
    if (raf) cancelAnimationFrame(raf);
    raf = null; vivo = false;
    if (els) els.dica.style.visibility = 'visible';
  }

  document.addEventListener('keydown', function (e) {
    if (!visivel) return;
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); pular(); }
    else if (e.code === 'Escape') { fechada = true; fecharTela(); }
  });

  /* ---------- Cenário ilustrado: serra, patrimônio e pontos da rota ---------- */

  function desenharCeu() {
    ctx.fillStyle = ceuGrad;
    ctx.fillRect(0, 0, W, CHAO);
    ctx.fillStyle = 'rgba(244,196,48,0.75)';
    ctx.beginPath(); ctx.arc(W - 42, 30, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.54)';
    desenharNuvem(54, 34, 0.8);
    desenharNuvem(220, 23, 0.58);
  }

  function desenharNuvem(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath(); ctx.arc(-9, 1, 5, 0, Math.PI * 2);
    ctx.arc(-2, -2, 7, 0, Math.PI * 2); ctx.arc(6, 1, 5, 0, Math.PI * 2);
    ctx.fill(); ctx.restore();
  }

  function desenharColinas() {
    ctx.fillStyle = '#9bc2ad';
    ctx.beginPath(); ctx.moveTo(-20, HORIZON);
    for (var x = -20; x <= W + 20; x += 16) {
      ctx.lineTo(x, HORIZON - 17 - 11 * Math.sin((x + bgScroll * 0.16) / 57) - 5 * Math.sin(x / 29));
    }
    ctx.lineTo(W + 20, CHAO); ctx.lineTo(-20, CHAO); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#648f78';
    ctx.beginPath(); ctx.moveTo(-20, HORIZON);
    for (var x2 = -20; x2 <= W + 20; x2 += 18) {
      ctx.lineTo(x2, HORIZON - 7 - 8 * Math.sin((x2 + bgScroll * 0.28) / 48));
    }
    ctx.lineTo(W + 20, CHAO); ctx.lineTo(-20, CHAO); ctx.closePath(); ctx.fill();
  }

  function desenharEtiquetaLocal(texto, x, y) {
    ctx.save();
    ctx.font = '700 5.5px "Open Sans",Arial,sans-serif';
    var largura = Math.min(108, ctx.measureText(texto).width + 15);
    var altura = 13, left = x - largura / 2, top = y - altura;
    ctx.beginPath();
    ctx.moveTo(left + 4, top); ctx.lineTo(left + largura - 4, top);
    ctx.quadraticCurveTo(left + largura, top, left + largura, top + 4);
    ctx.lineTo(left + largura, top + altura - 4); ctx.quadraticCurveTo(left + largura, top + altura, left + largura - 4, top + altura);
    ctx.lineTo(left + 4, top + altura); ctx.quadraticCurveTo(left, top + altura, left, top + altura - 4);
    ctx.lineTo(left, top + 4); ctx.quadraticCurveTo(left, top, left + 4, top); ctx.closePath();
    ctx.fillStyle = 'rgba(20,49,82,0.94)'; ctx.fill();
    ctx.strokeStyle = '#e2aa22'; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = '#f2c542'; ctx.beginPath(); ctx.arc(left + 5, top + 6.5, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(texto, left + largura / 2 + 2, top + 6.7, largura - 11);
    ctx.restore();
  }

  function desenharPedraDoBispo(x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    // Encosta verde e o bloco rochoso largo, alto e assimétrico da Pedra do Bispo.
    ctx.fillStyle = '#4e8469';
    ctx.beginPath(); ctx.moveTo(-60, 0); ctx.lineTo(-48, -18); ctx.lineTo(-27, -29);
    ctx.lineTo(-8, -25); ctx.lineTo(14, -35); ctx.lineTo(36, -24); ctx.lineTo(58, 0); ctx.closePath(); ctx.fill();
    var rocha = ctx.createLinearGradient(-35, -68, 32, -5);
    rocha.addColorStop(0, '#b8b8a8'); rocha.addColorStop(0.42, '#858f8b'); rocha.addColorStop(1, '#52636a');
    ctx.fillStyle = rocha; ctx.strokeStyle = '#42565d'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-45, 0); ctx.lineTo(-39, -27);
    ctx.quadraticCurveTo(-35, -52, -18, -66); ctx.quadraticCurveTo(-10, -74, 2, -68);
    ctx.lineTo(17, -58); ctx.quadraticCurveTo(29, -48, 36, -39);
    ctx.lineTo(51, -31); ctx.lineTo(59, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Plano superior claro, face abrupta e veios de granito.
    ctx.strokeStyle = 'rgba(255,248,220,0.68)'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-39, -28); ctx.quadraticCurveTo(-34, -54, -18, -66); ctx.quadraticCurveTo(-8, -72, 2, -68); ctx.stroke();
    ctx.strokeStyle = 'rgba(37,57,65,0.42)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-25, -44); ctx.lineTo(-15, -25); ctx.moveTo(4, -56); ctx.lineTo(13, -34);
    ctx.moveTo(25, -45); ctx.lineTo(31, -26); ctx.stroke();
    ctx.fillStyle = '#315e4b';
    for (var i = 0; i < 7; i++) {
      var tx = -43 + i * 14;
      ctx.beginPath(); ctx.moveTo(tx, -3); ctx.lineTo(tx + 3, -11 - (i % 3) * 2); ctx.lineTo(tx + 7, -3); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    desenharEtiquetaLocal('PEDRA DO BISPO', x, baseY - 77);
  }

  function desenharIgrejaDaGrama(x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    var pedraClara = '#d3c2a0', contorno = '#806f59', sombra = '#9e8a6c';
    // Ruína da nave: telhado interrompido, paredes de alvenaria e vãos escuros.
    ctx.fillStyle = pedraClara; ctx.strokeStyle = contorno; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(-48, 0); ctx.lineTo(-48, -29); ctx.lineTo(-37, -35);
    ctx.lineTo(-28, -30); ctx.lineTo(-17, -39); ctx.lineTo(-8, -33); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Fachada principal e frontão triangular da capela.
    ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(-11, -42); ctx.lineTo(8, -55);
    ctx.lineTo(31, -42); ctx.lineTo(31, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8a765d'; ctx.beginPath(); ctx.arc(8, -43, 3.2, 0, Math.PI * 2); ctx.fill();
    // Dois campanários altos com cúpulas, cornijas e vãos em arco — a silhueta marcante da igreja.
    function torre(tx, largura, altura) {
      var topo = -altura, base = -42, corpoTopo = topo + 13;
      ctx.fillStyle = '#c9b691'; ctx.strokeStyle = contorno; ctx.lineWidth = 1;
      ctx.fillRect(tx, corpoTopo, largura, base - corpoTopo);
      ctx.strokeRect(tx, corpoTopo, largura, base - corpoTopo);
      ctx.fillStyle = sombra; ctx.fillRect(tx - 2, topo + 12, largura + 4, 3);
      ctx.fillStyle = '#b49d78';
      ctx.beginPath(); ctx.moveTo(tx - 1, topo + 12); ctx.lineTo(tx + 1, topo + 5);
      ctx.quadraticCurveTo(tx + largura / 2, topo - 1, tx + largura - 1, topo + 5);
      ctx.lineTo(tx + largura + 1, topo + 12); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#4e4a43';
      ctx.beginPath(); ctx.moveTo(tx + largura * .28, base); ctx.lineTo(tx + largura * .28, topo + 22);
      ctx.quadraticCurveTo(tx + largura / 2, topo + 16, tx + largura * .72, topo + 22);
      ctx.lineTo(tx + largura * .72, base); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e9dcc0'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(tx + largura / 2, topo + 19); ctx.lineTo(tx + largura / 2, topo + 31); ctx.stroke();
    }
    torre(-7, 15, 73); torre(11, 15, 68);
    // Porta em arco, óculos laterais, rachaduras e tijolos aparentes.
    ctx.fillStyle = '#514b43';
    ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(2, -17); ctx.quadraticCurveTo(8, -26, 14, -17); ctx.lineTo(14, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#796d58';
    ctx.beginPath(); ctx.arc(-31, -18, 3.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(-20, -20, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(93,75,55,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-44, -4); ctx.lineTo(-39, -12); ctx.lineTo(-42, -20);
    ctx.moveTo(23, -4); ctx.lineTo(19, -12); ctx.lineTo(22, -20); ctx.stroke();
    ctx.fillStyle = '#577b59';
    ctx.beginPath(); ctx.moveTo(-54, 0); ctx.lineTo(-48, -5); ctx.lineTo(-41, 0); ctx.moveTo(33, 0); ctx.lineTo(40, -7); ctx.lineTo(47, 0); ctx.fill();
    ctx.restore();
    desenharEtiquetaLocal('SÃO JOAQUIM DA GRAMA', x, baseY - 84);
  }

  function desenharEstatuaDaFenix(x, baseY) {
    ctx.save(); ctx.translate(x, baseY);
    // Pequenos volumes da praça de Lídice ao fundo, sem tirar o foco do monumento.
    ctx.fillStyle = '#8fb39b'; ctx.fillRect(-56, -18, 15, 18); ctx.fillRect(41, -22, 18, 22);
    ctx.fillStyle = '#d5c5a7'; ctx.fillRect(-53, -15, 10, 15); ctx.fillRect(45, -19, 10, 19);
    ctx.fillStyle = '#b88762'; ctx.beginPath(); ctx.moveTo(-56, -18); ctx.lineTo(-48, -25); ctx.lineTo(-40, -18); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(39, -22); ctx.lineTo(50, -29); ctx.lineTo(61, -22); ctx.closePath(); ctx.fill();
    // Pedestal alto de pedra com juntas e placa memorial.
    ctx.fillStyle = '#7e8583'; ctx.strokeStyle = '#53636a'; ctx.lineWidth = 1;
    ctx.fillRect(-12, -54, 24, 45); ctx.strokeRect(-12, -54, 24, 45);
    ctx.fillStyle = '#a9aaa1'; ctx.fillRect(-15, -57, 30, 4); ctx.fillRect(-18, -9, 36, 6);
    ctx.strokeStyle = 'rgba(52,67,70,0.42)'; ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-11, -42); ctx.lineTo(11, -42); ctx.moveTo(-11, -28); ctx.lineTo(11, -28); ctx.moveTo(-11, -15); ctx.lineTo(11, -15); ctx.stroke();
    ctx.fillStyle = '#decf9a'; ctx.fillRect(-6, -23, 12, 6);
    ctx.fillStyle = '#8b7250'; ctx.fillRect(-4, -21, 8, 1);
    // Escultura em bronze: corpo e asas abertas, uma delas erguida, como na Fênix de Lídice.
    ctx.fillStyle = '#35434a'; ctx.strokeStyle = '#25363e'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, -54); ctx.lineTo(-13, -59);
    ctx.quadraticCurveTo(-22, -67, -34, -66); ctx.quadraticCurveTo(-31, -58, -22, -54);
    ctx.lineTo(-13, -52); ctx.lineTo(-22, -50); ctx.quadraticCurveTo(-29, -47, -32, -43);
    ctx.quadraticCurveTo(-19, -43, -8, -48); ctx.lineTo(-3, -47);
    ctx.lineTo(1, -50); ctx.lineTo(8, -46); ctx.quadraticCurveTo(21, -42, 32, -47);
    ctx.quadraticCurveTo(26, -54, 16, -56); ctx.lineTo(10, -57);
    ctx.quadraticCurveTo(18, -66, 19, -78); ctx.quadraticCurveTo(10, -72, 4, -63);
    ctx.lineTo(1, -58); ctx.lineTo(-1, -65); ctx.lineTo(-5, -69); ctx.lineTo(-6, -59);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // Pescoço, cabeça e bico da ave; sulcos dourados dão leitura de plumagem cartunesca.
    ctx.beginPath(); ctx.ellipse(1, -58, 4.5, 8, -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5, -67, 3.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e2aa22'; ctx.beginPath(); ctx.moveTo(7, -67); ctx.lineTo(12, -65); ctx.lineTo(7, -64); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(242,197,66,0.72)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-8, -56); ctx.lineTo(-26, -62); ctx.moveTo(-10, -52); ctx.lineTo(-25, -49);
    ctx.moveTo(7, -56); ctx.lineTo(16, -69); ctx.moveTo(9, -52); ctx.lineTo(25, -48); ctx.stroke();
    // Canteiro discreto na base do monumento, como a homenagem floral da praça.
    for (var f = 0; f < 5; f++) {
      ctx.fillStyle = f % 2 ? '#d99a4b' : '#f2c542';
      ctx.beginPath(); ctx.arc(-10 + f * 5, -8 - (f % 2) * 2, 1.7, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    desenharEtiquetaLocal('FÊNIX · LÍDICE', x, baseY - 88);
  }

  function desenharPontosTuristicos() {
    for (var i = 0; i < PONTOS_TURISTICOS.length; i++) {
      var lm = PONTOS_TURISTICOS[i];
      var wx = lm.pos - (bgScroll % LOOP);
      while (wx < -85) wx += LOOP;
      while (wx > W + 85) wx -= LOOP;
      lm.desenha(wx, HORIZON);
      if (wx - LOOP > -85) lm.desenha(wx - LOOP, HORIZON);
      if (wx + LOOP < W + 85) lm.desenha(wx + LOOP, HORIZON);
    }
  }

  function desenharChao() {
    ctx.fillStyle = '#f1e6d0'; ctx.fillRect(0, CHAO, W, H - CHAO);
    ctx.fillStyle = '#dfd1b5'; ctx.fillRect(0, CHAO, W, 3);
    ctx.strokeStyle = '#1a3463'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, CHAO + 0.5); ctx.lineTo(W, CHAO + 0.5); ctx.stroke();
    // Marcas de rota pontilhadas, em vez de um chão neutro de arcade.
    ctx.fillStyle = 'rgba(26,52,99,0.28)';
    var dash = 18, gap = 16, total = dash + gap, off = bgScroll % total;
    for (var gx = -off; gx < W; gx += total) ctx.fillRect(gx, CHAO + 22, dash, 2);
  }

  /* ---------- Personagem: pessoa correndo com o celular na mao ---------- */

  function desenharJogador() {
    var w = player.w, h = player.h, correndo = Math.floor(tempo / 6) % 2;
    ctx.save(); ctx.translate(player.x, player.y);
    // mochila
    ctx.fillStyle = '#e2aa22'; ctx.fillRect(w * 0.17, h * 0.28, w * 0.28, h * 0.34);
    // cabeça e cabelo
    ctx.fillStyle = '#edc49d'; ctx.beginPath(); ctx.arc(w * 0.56, h * 0.14, h * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#493d35'; ctx.beginPath(); ctx.arc(w * 0.56, h * 0.11, h * 0.14, Math.PI, Math.PI * 2); ctx.fill();
    // camiseta azul e alça dourada da mochila
    ctx.fillStyle = NAVY; ctx.beginPath(); ctx.moveTo(w * .38, h * .25); ctx.lineTo(w * .68, h * .27);
    ctx.lineTo(w * .76, h * .59); ctx.lineTo(w * .35, h * .59); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.7; ctx.beginPath(); ctx.moveTo(w * .42, h * .29); ctx.lineTo(w * .36, h * .52); ctx.stroke();
    // pernas em passada alternada
    ctx.strokeStyle = '#223247'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath();
    if (!player.pulando && correndo === 0) {
      ctx.moveTo(w * .48, h * .57); ctx.lineTo(w * .77, h * .86); ctx.lineTo(w * .89, h * .96);
      ctx.moveTo(w * .52, h * .57); ctx.lineTo(w * .28, h * .83); ctx.lineTo(w * .13, h * .97);
    } else if (!player.pulando) {
      ctx.moveTo(w * .48, h * .57); ctx.lineTo(w * .27, h * .82); ctx.lineTo(w * .15, h * .96);
      ctx.moveTo(w * .52, h * .57); ctx.lineTo(w * .75, h * .84); ctx.lineTo(w * .9, h * .96);
    } else {
      ctx.moveTo(w * .48, h * .57); ctx.lineTo(w * .28, h * .77); ctx.lineTo(w * .44, h * .88);
      ctx.moveTo(w * .52, h * .57); ctx.lineTo(w * .73, h * .75); ctx.lineTo(w * .61, h * .88);
    }
    ctx.stroke();
    // braço de balanço e braço com o celular
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w * .4, h * .34); ctx.lineTo(w * .18, h * (correndo ? .44 : .53)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(w * .68, h * .34); ctx.lineTo(w * .86, h * .28); ctx.stroke();
    ctx.save(); ctx.translate(w * .9, h * .27); ctx.rotate(.24);
    ctx.fillStyle = '#f4c542'; ctx.fillRect(-3.4, -7, 6.8, 12);
    ctx.fillStyle = '#fff'; ctx.fillRect(-2.2, -5.5, 4.4, 7); ctx.restore();
    ctx.restore();
  }

  /* ---------- Barreiras de rota e pins coletáveis ---------- */

  function desenharObstaculo(o) {
    var ox = o.x, oy = CHAO - OBST_H;
    ctx.fillStyle = 'rgba(26,52,99,0.15)'; ctx.beginPath(); ctx.ellipse(ox + OBST_W / 2, CHAO - 1, 17, 3, 0, 0, Math.PI * 2); ctx.fill();
    // cavaletes baixos com listras de sinalização, reconhecíveis mesmo em tamanho reduzido
    ctx.fillStyle = '#1a3463'; ctx.fillRect(ox + 3, oy + 8, 3, OBST_H - 7); ctx.fillRect(ox + OBST_W - 6, oy + 8, 3, OBST_H - 7);
    ctx.fillRect(ox, oy + 6, OBST_W, 5);
    ctx.fillStyle = '#f2c542'; ctx.fillRect(ox - 1, oy + 1, OBST_W + 2, 10);
    ctx.strokeStyle = '#1a3463'; ctx.lineWidth = 2;
    for (var sx = -4; sx < OBST_W; sx += 10) {
      ctx.beginPath(); ctx.moveTo(ox + sx, oy + 10); ctx.lineTo(ox + sx + 8, oy + 2); ctx.stroke();
    }
    ctx.fillStyle = '#1a3463'; ctx.fillRect(ox - 3, oy + OBST_H - 3, 10, 3); ctx.fillRect(ox + OBST_W - 7, oy + OBST_H - 3, 10, 3);
  }

  function desenharPin(m) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(-2, 6, -8, 0, -8, -4);
    ctx.arc(0, -4, 8, Math.PI, 0, false);
    ctx.bezierCurveTo(8, 0, 2, 6, 0, 9);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.beginPath(); ctx.arc(0, -4, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(0, -4, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function desenharTudo() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    desenharCeu();
    desenharColinas();
    desenharPontosTuristicos();
    desenharChao();
    for (var i = 0; i < obstaculos.length; i++) desenharObstaculo(obstaculos[i]);
    for (var j = 0; j < pins.length; j++) desenharPin(pins[j]);
    desenharJogador();
  }

  function colide(o) {
    var px = player.x + w_pad(), pw = player.w - 2 * w_pad();
    var py = player.y + 4, ph = player.h - 6;
    var ox = o.x + 2, ow = OBST_W - 4, oy = CHAO - OBST_H + 2, oh = OBST_H - 2;
    return px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy;
  }
  function w_pad() { return player.w * 0.18; }

  function coletarPin(m) {
    var px = player.x, pw = player.w, py = player.y, ph = player.h;
    var dx = Math.max(px - m.x, 0, m.x - (px + pw));
    var dy = Math.max(py - m.y, 0, m.y - (py + ph));
    return Math.sqrt(dx * dx + dy * dy) < 9;
  }

  function fimDeJogo() {
    vivo = false;
    if (pontos > recorde) {
      recorde = Math.floor(pontos);
      try { localStorage.setItem(CHAVE, String(recorde)); } catch (e) {}
    }
    els.recorde.textContent = Math.floor(recorde / 5);
    els.dica.textContent = 'Rota interrompida — toque para tentar de novo';
    els.dica.style.visibility = 'visible';
  }

  function loop(ts) {
    // k = "quadros de 60fps" decorridos: mesma velocidade em telas de 90/120Hz.
    var k = ultimoTs ? Math.min(3, (ts - ultimoTs) / 16.667) : 1;
    ultimoTs = ts; tempo += k; bgScroll += velocidade * 0.35 * k;

    player.vy += GRAVIDADE * k;
    player.y += player.vy * k;
    if (player.y >= CHAO - player.h) { player.y = CHAO - player.h; player.vy = 0; player.pulando = false; }

    if (tempo - ultimoObstaculo > Math.max(50, 90 - velocidade * 6)) {
      obstaculos.push({ x: W + 10 });
      ultimoObstaculo = tempo;
    }
    if (tempo - ultimoPin > 130) {
      pins.push({ x: W + 10, y: CHAO - 44 - Math.random() * 26, coletada: false });
      ultimoPin = tempo;
    }

    for (var i = 0; i < obstaculos.length; i++) obstaculos[i].x -= velocidade * k;
    obstaculos = obstaculos.filter(function (o) { return o.x > -30; });
    for (var m = 0; m < pins.length; m++) pins[m].x -= velocidade * k;
    pins = pins.filter(function (m) { return m.x > -20 && !m.coletada; });

    for (var j = 0; j < obstaculos.length; j++) { if (colide(obstaculos[j])) { fimDeJogo(); break; } }
    for (var n = 0; n < pins.length; n++) {
      if (!pins[n].coletada && coletarPin(pins[n])) {
        pins[n].coletada = true; pinsColetados++; pontos += 50;
        els.pins.textContent = String(pinsColetados);
      }
    }
    pins = pins.filter(function (m) { return !m.coletada; });

    desenharTudo();

    if (vivo) {
      pontos += k;
      var exibidos = Math.floor(pontos / 5);
      els.pontos.textContent = exibidos;
      velocidade = Math.min(9, 4.2 + exibidos * 0.06);
      raf = requestAnimationFrame(loop);
    }
  }

  /* ====================== Gatilhos ====================== */

  window.addEventListener('offline', verificar);
  window.addEventListener('online', verificar);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && !navigator.onLine) verificar();
  });

  if (!navigator.onLine) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', verificar);
    else verificar();
  }
})();
