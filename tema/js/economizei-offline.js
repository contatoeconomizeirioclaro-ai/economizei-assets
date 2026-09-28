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
    '<canvas width="330" height="170"></canvas>' +
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
  /* Corredor pela cidade: personagem correndo com o celular na mao, moedas com o
     selo do Economizei, lojas fechadas como obstaculo, e um horizonte que cicla por
     tres pontos turisticos de Rio Claro/RJ (Pedra do Bispo, ruinas da Igreja da
     Fazenda da Grama e a Estatua da Fenix), tudo desenhado em canvas -- sem imagens
     externas, entao continua funcionando 100% offline. */

  var ctx, W = 330, H = 170, CHAO = H - 34, HORIZON = CHAO;
  var CHAVE = 'economizei-offline-recorde';

  var NAVY = '#1a3463', NAVY_SOFT = 'rgba(26,52,99,0.55)', NAVY_HAZE = 'rgba(26,52,99,0.25)';
  var GOLD = '#e2aa22', GOLD_SOFT = 'rgba(226,170,34,0.8)', CREME = '#fdf3e0';

  var player = { x: 22, y: 0, w: 26, h: 34, vy: 0, pulando: false };
  var GRAVIDADE = 0.9, FORCA_PULO = -12;

  var OBST_W = 24, OBST_H = 30;
  var obstaculos = [], moedas = [];
  var velocidade = 4.2, pontos = 0, vivo = false;
  var tempo = 0, ultimoObstaculo = 0, ultimaMoeda = 0, raf = null, ultimoTs = 0, recorde = 0;
  var bgScroll = 0, ceuGrad = null;

  // Posicao (dentro de um ciclo de LOOP px) dos tres pontos turisticos no horizonte.
  var LOOP = 900;
  var PONTOS_TURISTICOS = [
    { pos: 160, desenha: desenharPedraDoBispo },
    { pos: 460, desenha: desenharIgrejaDaGrama },
    { pos: 720, desenha: desenharEstatuaDaFenix }
  ];

  function iniciarJogo() {
    ctx = els.canvas.getContext('2d');
    var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    els.canvas.width = W * dpr;
    els.canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ceuGrad = ctx.createLinearGradient(0, 0, 0, CHAO);
    ceuGrad.addColorStop(0, '#152547');
    ceuGrad.addColorStop(0.55, '#3c5591');
    ceuGrad.addColorStop(0.85, GOLD);
    ceuGrad.addColorStop(1, CREME);
    try { recorde = parseInt(localStorage.getItem(CHAVE) || '0', 10) || 0; } catch (e) {}
    els.recorde.textContent = Math.floor(recorde / 5);
    player.y = CHAO - player.h;
  }

  function resetar() {
    player.y = CHAO - player.h; player.vy = 0; player.pulando = false;
    obstaculos = []; moedas = []; velocidade = 4.2; pontos = 0; bgScroll = 0;
    ultimoObstaculo = tempo; ultimaMoeda = tempo; vivo = true;
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

  /* ---------- Cenario: ceu, colinas e os 3 pontos turisticos ---------- */

  function desenharCeu() {
    ctx.fillStyle = ceuGrad;
    ctx.fillRect(0, 0, W, CHAO);
  }

  function desenharColinas() {
    ctx.fillStyle = NAVY_HAZE;
    ctx.beginPath();
    ctx.moveTo(-20, HORIZON);
    for (var x = -20; x <= W + 20; x += 18) {
      ctx.lineTo(x, HORIZON - 9 - 7 * Math.sin((x + bgScroll * 0.6) / 65));
    }
    ctx.lineTo(W + 20, CHAO);
    ctx.lineTo(-20, CHAO);
    ctx.closePath();
    ctx.fill();
  }

  function desenharPedraDoBispo(x, baseY) {
    ctx.fillStyle = NAVY_SOFT;
    ctx.beginPath();
    ctx.moveTo(x - 20, baseY);
    ctx.lineTo(x - 13, baseY - 34);
    ctx.lineTo(x - 3, baseY - 48);
    ctx.lineTo(x + 8, baseY - 28);
    ctx.lineTo(x + 17, baseY - 40);
    ctx.lineTo(x + 26, baseY);
    ctx.closePath();
    ctx.fill();
  }

  function desenharIgrejaDaGrama(x, baseY) {
    ctx.fillStyle = NAVY_SOFT;
    // nave em ruina, com o topo da parede quebrado e irregular
    ctx.beginPath();
    ctx.moveTo(x - 24, baseY);
    ctx.lineTo(x - 24, baseY - 17);
    ctx.lineTo(x - 17, baseY - 24);
    ctx.lineTo(x - 10, baseY - 15);
    ctx.lineTo(x - 3, baseY - 21);
    ctx.lineTo(x - 1, baseY);
    ctx.closePath();
    ctx.fill();
    // torre sineira, mais alta que a nave
    ctx.fillRect(x + 3, baseY - 44, 11, 44);
    // sino (abertura da torre)
    ctx.fillStyle = 'rgba(253,243,224,0.55)';
    ctx.beginPath(); ctx.arc(x + 8.5, baseY - 30, 3, 0, Math.PI * 2); ctx.fill();
    // cruz torta no topo, marca de ruina
    ctx.strokeStyle = NAVY_SOFT; ctx.lineWidth = 1.6;
    ctx.save();
    ctx.translate(x + 8.5, baseY - 44);
    ctx.rotate(0.3);
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(0, 3); ctx.moveTo(-4, -3); ctx.lineTo(4, -3); ctx.stroke();
    ctx.restore();
  }

  function desenharEstatuaDaFenix(x, baseY) {
    ctx.fillStyle = NAVY_SOFT;
    ctx.fillRect(x - 9, baseY - 9, 18, 9);
    ctx.fillStyle = GOLD_SOFT;
    ctx.beginPath(); ctx.ellipse(x, baseY - 20, 4.5, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, baseY - 24);
    ctx.quadraticCurveTo(x - 20, baseY - 38, x - 5, baseY - 12);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x, baseY - 24);
    ctx.quadraticCurveTo(x + 20, baseY - 38, x + 5, baseY - 12);
    ctx.closePath(); ctx.fill();
  }

  function desenharPontosTuristicos() {
    for (var i = 0; i < PONTOS_TURISTICOS.length; i++) {
      var lm = PONTOS_TURISTICOS[i];
      var wx = lm.pos - (bgScroll % LOOP);
      while (wx < -60) wx += LOOP;
      while (wx > W + 60) wx -= LOOP;
      lm.desenha(wx, HORIZON);
      if (wx - LOOP > -60) lm.desenha(wx - LOOP, HORIZON);
      if (wx + LOOP < W + 60) lm.desenha(wx + LOOP, HORIZON);
    }
  }

  function desenharChao() {
    ctx.fillStyle = '#efe6d2';
    ctx.fillRect(0, CHAO, W, H - CHAO);
    ctx.strokeStyle = NAVY; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, CHAO + 0.5); ctx.lineTo(W, CHAO + 0.5); ctx.stroke();
    ctx.fillStyle = 'rgba(26,52,99,0.35)';
    var faixa = 16, vao = 14, total = faixa + vao;
    var off = bgScroll % total;
    for (var gx = -off; gx < W; gx += total) ctx.fillRect(gx, CHAO + (H - CHAO) / 2 - 1, faixa, 2);
  }

  /* ---------- Personagem: pessoa correndo com o celular na mao ---------- */

  function desenharJogador() {
    var w = player.w, h = player.h;
    var correndo = Math.floor(tempo / 6) % 2;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.fillStyle = NAVY;
    ctx.beginPath(); ctx.arc(w * 0.55, h * 0.13, h * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(w * 0.5, h * 0.24);
    ctx.rotate(-0.15);
    ctx.fillRect(-w * 0.16, 0, w * 0.32, h * 0.4);
    ctx.restore();
    ctx.strokeStyle = NAVY; ctx.lineWidth = w * 0.17; ctx.lineCap = 'round';
    ctx.beginPath();
    if (!player.pulando) {
      if (correndo === 0) {
        ctx.moveTo(w * 0.5, h * 0.62); ctx.lineTo(w * 0.8, h * 0.98);
        ctx.moveTo(w * 0.5, h * 0.62); ctx.lineTo(w * 0.24, h * 0.98);
      } else {
        ctx.moveTo(w * 0.5, h * 0.62); ctx.lineTo(w * 0.3, h * 0.9); ctx.lineTo(w * 0.5, h * 1.0);
        ctx.moveTo(w * 0.5, h * 0.62); ctx.lineTo(w * 0.74, h * 0.92);
      }
    } else {
      // no ar: pernas dobradas para tras (pose de salto)
      ctx.moveTo(w * 0.5, h * 0.62); ctx.lineTo(w * 0.32, h * 0.8); ctx.lineTo(w * 0.44, h * 0.92);
      ctx.moveTo(w * 0.5, h * 0.62); ctx.lineTo(w * 0.68, h * 0.78); ctx.lineTo(w * 0.56, h * 0.9);
    }
    ctx.stroke();
    // braco de tras
    ctx.beginPath();
    ctx.moveTo(w * 0.46, h * 0.32);
    ctx.lineTo(w * 0.2, h * (correndo === 0 && !player.pulando ? 0.46 : 0.38));
    ctx.stroke();
    // braco da frente segurando o celular
    var handX = w * 0.88, handY = h * 0.3;
    ctx.beginPath(); ctx.moveTo(w * 0.6, h * 0.3); ctx.lineTo(handX, handY); ctx.stroke();
    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(0.3);
    ctx.fillStyle = GOLD;
    ctx.fillRect(-3, -6.5, 6.5, 11);
    ctx.fillStyle = CREME;
    ctx.fillRect(-2, -5, 4.5, 6.5);
    ctx.restore();
    ctx.restore();
  }

  /* ---------- Lojas fechadas (obstaculo) e moedas com o selo (coletavel) ---------- */

  function desenharObstaculo(o) {
    var ox = o.x, oy = CHAO - OBST_H;
    ctx.fillStyle = '#c7ccd6';
    ctx.fillRect(ox, oy, OBST_W, OBST_H);
    ctx.strokeStyle = '#8b93a1'; ctx.lineWidth = 2;
    for (var yy = oy + 4; yy < oy + OBST_H - 2; yy += 5) {
      ctx.beginPath(); ctx.moveTo(ox + 2, yy); ctx.lineTo(ox + OBST_W - 2, yy); ctx.stroke();
    }
    ctx.fillStyle = NAVY;
    ctx.fillRect(ox - 2, oy - 6, OBST_W + 4, 6);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.arc(ox + OBST_W / 2, oy + OBST_H / 2, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(ox + OBST_W / 2 - 3, oy + OBST_H / 2 + 3);
    ctx.lineTo(ox + OBST_W / 2 + 3, oy + OBST_H / 2 - 3);
    ctx.stroke();
  }

  function desenharMoeda(m) {
    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = NAVY;
    ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = GOLD;
    ctx.font = 'bold 6px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('e', 0, 0.5);
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
    for (var j = 0; j < moedas.length; j++) desenharMoeda(moedas[j]);
    desenharJogador();
  }

  function colide(o) {
    var px = player.x + w_pad(), pw = player.w - 2 * w_pad();
    var py = player.y + 4, ph = player.h - 6;
    var ox = o.x + 2, ow = OBST_W - 4, oy = CHAO - OBST_H + 2, oh = OBST_H - 2;
    return px < ox + ow && px + pw > ox && py < oy + oh && py + ph > oy;
  }
  function w_pad() { return player.w * 0.18; }

  function coletaMoeda(m) {
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
    els.dica.textContent = 'Fim de jogo — toque para tentar de novo';
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
    if (tempo - ultimaMoeda > 130) {
      moedas.push({ x: W + 10, y: CHAO - 44 - Math.random() * 26, coletada: false });
      ultimaMoeda = tempo;
    }

    for (var i = 0; i < obstaculos.length; i++) obstaculos[i].x -= velocidade * k;
    obstaculos = obstaculos.filter(function (o) { return o.x > -30; });
    for (var m = 0; m < moedas.length; m++) moedas[m].x -= velocidade * k;
    moedas = moedas.filter(function (m) { return m.x > -20 && !m.coletada; });

    for (var j = 0; j < obstaculos.length; j++) { if (colide(obstaculos[j])) { fimDeJogo(); break; } }
    for (var n = 0; n < moedas.length; n++) {
      if (!moedas[n].coletada && coletaMoeda(moedas[n])) { moedas[n].coletada = true; pontos += 50; }
    }
    moedas = moedas.filter(function (m) { return !m.coletada; });

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
