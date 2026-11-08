/* Economizei! Rio Claro — anúncios (anuncios/anuncios.js)
   Um motor para todos os espaços, lendo uma planilha (CSV publicado):
   - artigos: rotativo, no meio do artigo (ou onde houver <div class="eb-slot"></div>)
   - página de categorias: 1 anunciante por grupo (.espaco-anuncio[data-categoria="id-do-grupo"])
   Contrato = inicio + dias. Sem contrato vigente: volta ao anúncio padrão; sem padrão: o espaço some. */
(function () {
  'use strict';
  if (window.EconomizeiAnuncios) return;

  var CSV_URL = window.EB_CSV || 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQcjCC6rL61fXu0zX5Do5InEr5CCjCzNOzVcjjhwt_dXQx0GNhyleBI1E9Xp6Rhinbgd2nUCYr07Gdj/pub?output=csv';
  var CACHE_KEY = 'eb_csv_v2', CACHE_MS = 30 * 60 * 1000;
  var TEMAS = ['azul', 'dourado', 'verde', 'escuro', 'claro', 'vermelho'];
  var EFEITOS = ['brilho', 'zoom', 'flutuar', 'entrar', 'pulse'];

  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt) e.textContent = txt;
    return e;
  }

  /* ---------- planilha ---------- */
  function parseCSV(t) {
    var rows = [], row = [], cur = '', q = false, i, c;
    t = String(t || '').replace(/^\uFEFF/, '');
    for (i = 0; i < t.length; i++) {
      c = t.charAt(i);
      if (q) {
        if (c === '"') { if (t.charAt(i + 1) === '"') { cur += '"'; i++; } else q = false; }
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && t.charAt(i + 1) === '\n') i++;
        row.push(cur); cur = ''; rows.push(row); row = [];
      } else cur += c;
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    if (rows.length < 2) return [];
    var head = rows[0].map(function (h) { return norm(h).replace(/[^a-z0-9]/g, ''); });
    return rows.slice(1)
      .filter(function (r) { return r.join('').trim() !== ''; })
      .map(function (r) {
        var o = {};
        head.forEach(function (h, k) { if (h) o[h] = (r[k] || '').trim(); });
        return o;
      });
  }

  var linhas = null, fila = [], buscando = false;
  function carregar(cb) {
    if (linhas) return cb(linhas);
    fila.push(cb);
    if (buscando) return;
    buscando = true;
    function fim(rows) { linhas = rows; buscando = false; fila.splice(0).forEach(function (f) { f(rows); }); }
    if (!/^https?:\/\//i.test(CSV_URL)) return fim([]);
    try {
      var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (c && c.u === CSV_URL && Date.now() - c.t < CACHE_MS) return fim(c.r);
    } catch (e) { /* sem cache */ }
    fetch(CSV_URL)
      .then(function (r) { if (!r.ok) throw 0; return r.text(); })
      .then(function (t) {
        var rows = parseCSV(t);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), u: CSV_URL, r: rows })); } catch (e) {}
        fim(rows);
      })
      .catch(function () { fim([]); });
  }

  /* ---------- regras ---------- */
  function data(s) {
    s = String(s || '').trim();
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return new Date(+m[3], m[2] - 1, +m[1]);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], m[2] - 1, +m[3]) : null;
  }
  function hoje() { var h = new Date(); return new Date(h.getFullYear(), h.getMonth(), h.getDate()); }

  // '' = ignorar | 'contrato' = vigente hoje | 'padrao' = sem datas (anúncio da casa)
  function classificar(r) {
    if (/^(nao|n|0|false)$/.test(norm(r.ativo))) return '';
    if (!r.titulo && !r.imagem) return '';
    if (!r.inicio) return 'padrao';
    var i = data(r.inicio);
    if (!i) return '';                                   // data digitada errada: não vira padrão por engano
    var h = hoje(), d = parseInt(r.dias, 10);
    if (h < i) return '';
    if (d > 0 && h > new Date(i.getFullYear(), i.getMonth(), i.getDate() + d - 1)) return '';
    return 'contrato';
  }
  function espacos(r) { return String(r.espaco || '').split(/[,;]/).map(norm).filter(Boolean); }
  function sorteio(a) { return a[Math.floor(Math.random() * a.length)]; }

  function escolher(rows, espaco) {
    espaco = norm(espaco);
    var con = [], padEsp = [], padGeral = [];
    rows.forEach(function (r) {
      var t = classificar(r);
      if (!t) return;
      var es = espacos(r), meu = es.indexOf(espaco) > -1;
      if (t === 'contrato' && meu) con.push(r);
      else if (t === 'padrao' && meu) padEsp.push(r);
      else if (t === 'padrao' && es.indexOf('padrao') > -1) padGeral.push(r);
    });
    if (con.length) {
      if (espaco === 'artigos') return { r: sorteio(con), contrato: true };      // rotativo
      con.sort(function (a, b) { return data(a.inicio) - data(b.inicio); });     // exclusivo: quem começou antes
      return { r: con[0], contrato: true };
    }
    var pad = padEsp.length ? padEsp : padGeral;
    return pad.length ? { r: sorteio(pad), contrato: false } : null;
  }

  /* ---------- montagem (textContent: nada da planilha vira HTML) ---------- */
  function linkSeguro(l) {
    l = String(l || '').trim();
    if (!l) return '';
    if (/^[+\d][\d\s().-]{8,}$/.test(l)) {               // só telefone -> WhatsApp
      var d = l.replace(/\D/g, '');
      if (d.length <= 11) d = '55' + d;
      return 'https://wa.me/' + d + '?text=' + encodeURIComponent('Olá! Vim pelo Economizei Rio Claro.');
    }
    if (/^https?:\/\//i.test(l)) return l;
    if (/^[\w-]+(\.[\w-]+)+/.test(l)) return 'https://' + l;
    return '';
  }
  function imgSegura(u) { return /^https:\/\//i.test(u || '') ? u : ''; }

  function montar(r, contrato) {
    var tema = norm(r.tema), layout = norm(r.layout), efeito = norm(r.efeito);
    if (TEMAS.indexOf(tema) < 0) tema = 'azul';
    if (EFEITOS.indexOf(efeito) < 0) efeito = '';
    var fx = efeito ? ' eb--' + efeito : '';
    var rel = 'noopener' + (contrato ? ' sponsored' : '');
    var link = linkSeguro(r.link), pic = imgSegura(r.imagem), picM = imgSegura(r.imagemmobile), logo = imgSegura(r.logo);

    if (layout === 'imagem' && pic) {
      var box = el(link ? 'a' : 'div', 'eb eb--img' + fx);
      if (link) { box.href = link; box.target = '_blank'; box.rel = rel; }
      var pict = el('picture');
      if (picM) { var s = el('source'); s.media = '(max-width:600px)'; s.srcset = picM; pict.appendChild(s); }
      var im = el('img', 'eb-pic');
      im.src = pic; im.alt = r.titulo || 'Publicidade'; im.loading = 'lazy'; im.decoding = 'async';
      pict.appendChild(im); box.appendChild(pict);
      return box;
    }

    var b = el('div', 'eb eb--' + tema + fx);
    if (layout === 'logo' && logo) {
      var lg = el('img', 'eb-img');
      lg.src = logo; lg.alt = ''; lg.width = 64; lg.height = 64; lg.loading = 'lazy'; lg.decoding = 'async';
      b.appendChild(lg);
    }
    var txt = el('div', 'eb-txt');
    txt.appendChild(el('strong', 'eb-t', r.titulo));
    if (r.texto) txt.appendChild(el('span', 'eb-p', r.texto));
    b.appendChild(txt);
    if (link) {
      var a = el('a', 'eb-btn', r.botao || 'Saiba mais');
      a.href = link; a.target = '_blank'; a.rel = rel;
      b.appendChild(a);
    }
    return b;
  }

  // Efeitos só rodam enquanto o bloco está visível
  function vigiar(bloco) {
    if (!('IntersectionObserver' in window)) { bloco.classList.add('eb-on', 'eb-vis'); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        bloco.classList.toggle('eb-vis', e.isIntersecting);
        if (e.isIntersecting) bloco.classList.add('eb-on');
      });
    }, { threshold: 0.2 });
    io.observe(bloco);
  }

  function preencher(slot) {
    var espaco = slot.getAttribute('data-espaco') || slot.getAttribute('data-categoria') || 'artigos';
    carregar(function (rows) {
      var e = escolher(rows, espaco);
      if (!e) return;                                    // sem contrato e sem padrão: espaço fica vazio
      var b = montar(e.r, e.contrato), w = el('div', 'eb-wrap');
      if (e.contrato) {                                  // anúncio de terceiro é identificado; o da casa não
        w.appendChild(el('div', 'eb-rotulo', slot.getAttribute('data-rotulo') ||
          (norm(espaco) === 'artigos' ? 'Continua após a publicidade' : 'Publicidade')));
      }
      w.appendChild(b);
      slot.appendChild(w);
      vigiar(b);
    });
  }

  function observar(slot) {
    if (slot.getAttribute('data-eb')) return;
    slot.setAttribute('data-eb', '1');
    if (!('IntersectionObserver' in window)) return preencher(slot);
    var io = new IntersectionObserver(function (es) {
      if (es[0].isIntersecting) { io.disconnect(); preencher(slot); }
    }, { rootMargin: '400px' });
    io.observe(slot);
  }

  /* ---------- onde entra nos artigos ---------- */
  // Padrão: depois da primeira seção (antes do 2º subtítulo do conteúdo); artigo curto: no meio dos parágrafos.
  function slotDoArtigo() {
    var s = document.querySelector('.eb-slot');
    if (s) return;
    var corpo = document.querySelector('.item-post .post-body');
    if (!corpo) return;                                  // só em página de artigo
    s = el('div', 'eb-slot');
    s.setAttribute('data-espaco', 'artigos');
    var p1 = corpo.querySelector('p');
    var hs = [].filter.call(corpo.querySelectorAll('h2'), function (h) {
      return p1 && (p1.compareDocumentPosition(h) & 4);  // só subtítulos depois do 1º parágrafo (ignora o título)
    });
    if (hs.length >= 2) { hs[1].parentNode.insertBefore(s, hs[1]); return; }
    var ps = corpo.querySelectorAll('p');
    if (ps.length > 2) { var m = ps[Math.floor(ps.length / 2)]; m.parentNode.insertBefore(s, m.nextSibling); }
    else corpo.appendChild(s);
  }

  function montarTodos() {
    slotDoArtigo();
    [].forEach.call(document.querySelectorAll('.eb-slot, .espaco-anuncio[data-categoria]'), observar);
  }

  window.EconomizeiAnuncios = { montar: montarTodos };   // idempotente: pode ser chamado de novo
  function iniciar() { setTimeout(montarTodos, 0); }     // depois dos scripts da própria página
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
