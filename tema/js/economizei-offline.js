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
    if (visivel) { setStatus(false); return; }
    if (fechada) return;
    abrir();
  }

  function voltou() {
    fechada = false;
    if (!visivel) return;
    setStatus(true);
    setTimeout(function () {
      if (RECARREGAR) { location.reload(); } else { fecharTela(); }
    }, 700);
  }

  /* ====================== Tela (Shadow DOM) ====================== */

  var CSS =
    ':host{all:initial}' +
    '*{box-sizing:border-box}' +
    '.ov{position:fixed;inset:0;z-index:2147483647;background:#fff;color:#1a3463;' +
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;' +
    'display:none;overflow:auto;overscroll-behavior:contain}' +
    '.ov.on{display:block}' +
    '.wrap{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
    'padding:24px;text-align:center}' +
    '.selo{width:64px;height:64px;border-radius:50%;background:#f4c430;display:flex;align-items:center;' +
    'justify-content:center;font-size:30px;margin-bottom:14px;box-shadow:0 6px 16px rgba(244,196,48,.35)}' +
    'h1{font-size:19px;margin:0 0 4px}' +
    '.sub{margin:0 0 18px;color:#6b7280;font-size:14px}' +
    '.status{font-size:12px;font-weight:600;color:#c0392b;margin-bottom:4px}' +
    '.status.on{color:#1a8f4c}' +
    'canvas{width:100%;max-width:340px;height:auto;background:#fbfbfb;border:1px solid #ececec;' +
    'border-radius:10px;margin-top:14px;touch-action:none}' +
    '.score{display:flex;gap:18px;font-size:12px;font-weight:700;margin-top:10px;letter-spacing:.02em}' +
    '.melhor{color:#e2aa22}' +
    '.dica{font-size:12px;color:#6b7280;margin-top:4px}' +
    'button{font:inherit;cursor:pointer}' +
    '.retry{margin-top:18px;background:#1a3463;color:#fff;border:0;padding:10px 22px;border-radius:30px;' +
    'font-weight:700;font-size:13px}' +
    '.retry:active{transform:scale(.97)}' +
    '.fechar{position:absolute;top:10px;right:12px;background:none;border:0;color:#6b7280;font-size:13px;' +
    'padding:8px 10px}' +
    '.rodape{margin-top:22px;font-size:11px;color:#b9bec9}';

  var HTML =
    '<div class="ov" role="dialog" aria-modal="true" aria-label="Você está offline">' +
    '<button class="fechar" type="button">Continuar lendo ✕</button>' +
    '<div class="wrap">' +
    '<div class="selo">\uD83D\uDECD\uFE0F</div>' +
    '<h1>Você está offline</h1>' +
    '<p class="sub">Assim que a conexão voltar, a página recarrega sozinha.</p>' +
    '<div class="status">● Sem conexão</div>' +
    '<canvas width="320" height="140"></canvas>' +
    '<div class="score"><span>PONTOS: <span class="pontos">0</span></span>' +
    '<span class="melhor">RECORDE: <span class="recorde">0</span></span></div>' +
    '<div class="dica">Toque na tela ou aperte ESPAÇO para pular</div>' +
    '<button class="retry" type="button">Tentar novamente</button>' +
    '<div class="rodape">Economizei! Rio Claro</div>' +
    '</div></div>';

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
      recorde: root.querySelector('.recorde'),
      dica: root.querySelector('.dica'),
      retry: root.querySelector('.retry'),
      fechar: root.querySelector('.fechar')
    };

    els.retry.addEventListener('click', function () {
      els.status.textContent = '● Verificando…';
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
    els.status.textContent = online ? '● Conectado — recarregando…' : '● Sem conexão';
    els.status.className = online ? 'status on' : 'status';
  }

  function abrir() {
    construir();
    visivel = true;
    els.ov.className = 'ov on';
    setStatus(false);
    desenharTudo();
    clearInterval(timerChecagem);
    timerChecagem = setInterval(verificar, 5000);
  }

  function fecharTela() {
    visivel = false;
    clearInterval(timerChecagem);
    pararJogo();
    if (els) els.ov.className = 'ov';
  }

  /* ====================== Mini-jogo ====================== */

  var ctx, W = 320, H = 140, CHAO = H - 24;
  var CHAVE = 'economizei-offline-recorde';
  var player = { x: 26, y: 0, w: 22, h: 22, vy: 0, pulando: false };
  var GRAVIDADE = 0.9, FORCA_PULO = -12;
  var obstaculos = [], velocidade = 4.2, pontos = 0, vivo = false;
  var tempo = 0, ultimoObstaculo = 0, raf = null, ultimoTs = 0, recorde = 0;

  function iniciarJogo() {
    ctx = els.canvas.getContext('2d');
    var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    els.canvas.width = W * dpr;
    els.canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    try { recorde = parseInt(localStorage.getItem(CHAVE) || '0', 10) || 0; } catch (e) {}
    els.recorde.textContent = Math.floor(recorde / 5);
    player.y = CHAO - player.h;
  }

  function resetar() {
    player.y = CHAO - player.h; player.vy = 0; player.pulando = false;
    obstaculos = []; velocidade = 4.2; pontos = 0;
    ultimoObstaculo = tempo; vivo = true;
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

  function desenharTudo() {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = '#d8dbe0';
    ctx.beginPath(); ctx.moveTo(0, CHAO); ctx.lineTo(W, CHAO); ctx.stroke();
    ctx.font = '20px sans-serif'; ctx.textBaseline = 'top';
    for (var i = 0; i < obstaculos.length; i++) ctx.fillText('\uD83E\uDDFE', obstaculos[i].x, CHAO - 20);
    ctx.font = '22px sans-serif';
    ctx.fillText('\uD83D\uDECD\uFE0F', player.x, player.y - 2);
  }

  function colide(o) {
    var px = player.x + 3, pw = player.w - 8, py = player.y + 3, ph = player.h - 6;
    var ox = o.x + 3, ow = 14, oy = CHAO - 20 + 3, oh = 17;
    return px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy;
  }

  function fimDeJogo() {
    vivo = false;
    if (pontos > recorde) {
      recorde = Math.floor(pontos);
      try { localStorage.setItem(CHAVE, String(recorde)); } catch (e) {}
    }
    els.recorde.textContent = Math.floor(recorde / 5);
    els.dica.textContent = 'Fim de jogo — toque para tentar de novo';
    els.dica.style.visibility = 'visible';
  }

  function loop(ts) {
    // k = "quadros de 60fps" decorridos: mesma velocidade em telas de 90/120Hz.
    var k = ultimoTs ? Math.min(3, (ts - ultimoTs) / 16.667) : 1;
    ultimoTs = ts; tempo += k;

    player.vy += GRAVIDADE * k;
    player.y += player.vy * k;
    if (player.y >= CHAO - player.h) { player.y = CHAO - player.h; player.vy = 0; player.pulando = false; }

    if (tempo - ultimoObstaculo > Math.max(50, 90 - velocidade * 6)) {
      obstaculos.push({ x: W + 10 });
      ultimoObstaculo = tempo;
    }
    for (var i = 0; i < obstaculos.length; i++) obstaculos[i].x -= velocidade * k;
    obstaculos = obstaculos.filter(function (o) { return o.x > -20; });
    for (var j = 0; j < obstaculos.length; j++) { if (colide(obstaculos[j])) { fimDeJogo(); break; } }

    desenharTudo();

    if (vivo) {
      pontos += k;
      var exibidos = Math.floor(pontos / 5);
      els.pontos.textContent = exibidos;
      velocidade = Math.min(9, 4.2 + exibidos * 0.08);
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
