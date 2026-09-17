/* ============================================================
   ECONOMIZEI! RIO CLARO — ENDEREÇOS
   Duas APIs no mesmo arquivo:

   - EnderecosCache: baixa CNEFE + usuários, cacheia em localStorage,
     busca local instantânea.
   - EnderecosFavoritos: salva endereços favoritos no localStorage
     do usuário. Sem login, sem Firestore.

   Depende de: window.EconomizeiFirebase.db (comum/firebase.js)
   ============================================================ */
(function (global) {
  'use strict';

  /* ==========================================================
     PARTE 1 — ENDEREÇOS (download, cache, busca)
     ========================================================== */

  var CHAVE_CACHE = 'enderecosRioClaroV2';
  var TTL = 24 * 60 * 60 * 1000;
  var COL_BASE = 'enderecos_chunks';
  var COL_USER = 'enderecos_usuario';
  var COL_SUG = 'enderecos_sugestoes';
  var SCORE_MIN = 0.3;

  var indice = null;
  var carregando = null;

  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lerCache() {
    try {
      var bruto = localStorage.getItem(CHAVE_CACHE);
      if (!bruto) return null;
      var obj = JSON.parse(bruto);
      if (!obj || !obj.ts || !obj.dados) return null;
      if (Date.now() - obj.ts > TTL) return null;
      return obj.dados;
    } catch (e) {
      console.warn('[EnderecosCache] Cache corrompido, ignorando.', e);
      try { localStorage.removeItem(CHAVE_CACHE); } catch (e2) {}
      return null;
    }
  }

  function salvarCache(lista) {
    try {
      localStorage.setItem(CHAVE_CACHE, JSON.stringify({
        ts: Date.now(),
        dados: lista
      }));
    } catch (e) {
      console.warn('[EnderecosCache] Não foi possível salvar cache.', e);
    }
  }

  function limparCache() {
    try { localStorage.removeItem(CHAVE_CACHE); } catch (e) {}
    indice = null;
  }

  function baixarTudo() {
    if (!global.EconomizeiFirebase || !global.EconomizeiFirebase.db) {
      return Promise.reject(new Error('Firebase não inicializado.'));
    }
    var db = global.EconomizeiFirebase.db;

    var promessas = [
      db.collection(COL_BASE).get(),
      db.collection(COL_USER).get().catch(function () { return null; }),
      db.collection(COL_SUG).get().catch(function () { return null; })
    ];

    return Promise.all(promessas).then(function (results) {
      var base = [];
      var usuarios = [];

      if (results[0]) {
        results[0].forEach(function (doc) {
          var d = doc.data();
          if (d && Array.isArray(d.enderecos)) {
            for (var i = 0; i < d.enderecos.length; i++) {
              var e = d.enderecos[i];
              e.fonte = 'cnefe';
              base.push(e);
            }
          }
        });
      }

      if (results[1]) {
        results[1].forEach(function (doc) {
          var d = doc.data();
          if (!d) return;
          if (d.status === 'removido') return;
          var score = typeof d.score === 'number' ? d.score : 0.3;
          if (score < SCORE_MIN) return;

          var logradouro = d.logradouro || '';
          var numero = d.numero || 'SN';
          var bairro = d.bairro || '';
          var cep = d.cep || '';
          var busca = d.busca || norm([logradouro, numero !== 'SN' ? numero : '', bairro, cep].filter(Boolean).join(' '));

          usuarios.push({
            id: 'usr_' + doc.id,
            logradouro: logradouro,
            numero: numero,
            bairro: bairro,
            cep: cep,
            lat: d.lat,
            lng: d.lng,
            estabelecimento: null,
            especie: null,
            busca: busca,
            fonte: 'usuario',
            uid: d.uid || null,
            nome_usuario: d.nome_usuario || '',
            score: score
          });
        });
      }

      return usuarios.concat(base);
    });
  }

  function carregar() {
    if (indice) return Promise.resolve(indice);
    if (carregando) return carregando;

    var doCache = lerCache();
    if (doCache && doCache.length) {
      indice = doCache;
      return Promise.resolve(indice);
    }

    carregando = baixarTudo()
      .then(function (lista) {
        indice = lista;
        salvarCache(lista);
        carregando = null;
        return lista;
      })
      .catch(function (err) {
        carregando = null;
        throw err;
      });

    return carregando;
  }

  function recarregar() {
    limparCache();
    return carregar();
  }

  function adicionarLocal(endereco) {
    if (!endereco || !endereco.logradouro) return;

    var logradouro = endereco.logradouro;
    var numero = endereco.numero || 'SN';
    var bairro = endereco.bairro || '';
    var cep = endereco.cep || '';
    var busca = endereco.busca || norm([logradouro, numero !== 'SN' ? numero : '', bairro, cep].filter(Boolean).join(' '));

    var novo = {
      id: endereco.id || ('usr_local_' + Date.now()),
      logradouro: logradouro,
      numero: numero,
      bairro: bairro,
      cep: cep,
      lat: endereco.lat,
      lng: endereco.lng,
      estabelecimento: null,
      especie: null,
      busca: busca,
      fonte: 'usuario',
      uid: endereco.uid || null,
      nome_usuario: endereco.nome_usuario || '',
      score: typeof endereco.score === 'number' ? endereco.score : 0.6
    };

    if (!indice) {
      carregar().then(function () {
        indice.unshift(novo);
        salvarCache(indice);
      }).catch(function (err) {
        console.warn('[EnderecosCache] adicionarLocal antes de carregar falhou:', err);
      });
      return;
    }

    for (var i = 0; i < indice.length; i++) {
      var e = indice[i];
      if (norm(e.logradouro) === norm(logradouro) &&
          String(e.numero) === String(numero) &&
          norm(e.bairro) === norm(bairro)) {
        return;
      }
    }

    indice.unshift(novo);
    salvarCache(indice);
  }

  function buscar(query, limite) {
    if (!indice || !indice.length) return [];
    limite = limite || 8;
    var q = norm(query);
    if (q.length < 3) return [];

    var termos = q.split(' ').filter(Boolean);
    var resultado = [];
    var TETO_INTERNO = limite * 8;

    for (var i = 0; i < indice.length; i++) {
      var e = indice[i];
      var b = e.busca || '';
      var ok = true;
      for (var t = 0; t < termos.length; t++) {
        if (b.indexOf(termos[t]) === -1) { ok = false; break; }
      }
      if (ok) {
        resultado.push(e);
        if (resultado.length >= TETO_INTERNO) break;
      }
    }

    resultado.sort(function (a, b) {
      var aFonte = a.fonte === 'usuario' ? 0 : 1;
      var bFonte = b.fonte === 'usuario' ? 0 : 1;
      if (aFonte !== bFonte) return aFonte - bFonte;

      var aScore = typeof a.score === 'number' ? a.score : 0;
      var bScore = typeof b.score === 'number' ? b.score : 0;
      if (aScore !== bScore) return bScore - aScore;

      var aBusca = a.busca || '';
      var bBusca = b.busca || '';
      var aComeca = aBusca.indexOf(q) === 0 ? 0 : 1;
      var bComeca = bBusca.indexOf(q) === 0 ? 0 : 1;
      if (aComeca !== bComeca) return aComeca - bComeca;

      var aLog = norm(a.logradouro || '');
      var bLog = norm(b.logradouro || '');
      var aPri = aLog.indexOf(termos[0]) === 0 ? 0 : 1;
      var bPri = bLog.indexOf(termos[0]) === 0 ? 0 : 1;
      if (aPri !== bPri) return aPri - bPri;

      return aLog.localeCompare(bLog);
    });

    return resultado.slice(0, limite);
  }

  function porId(id) {
    if (!indice) return null;
    for (var i = 0; i < indice.length; i++) {
      if (indice[i].id === id) return indice[i];
    }
    return null;
  }

  global.EnderecosCache = {
    carregar: carregar,
    recarregar: recarregar,
    adicionarLocal: adicionarLocal,
    buscar: buscar,
    porId: porId,
    limparCache: limparCache,
    norm: norm,
    get pronto() { return !!indice; },
    get total() { return indice ? indice.length : 0; }
  };

  /* ==========================================================
     PARTE 2 — FAVORITOS (localStorage, só no navegador)
     ========================================================== */

  var CHAVE_FAV = 'enderecosFavoritosV1';
  var ouvintesFav = [];

  function chaveDe(e) {
    if (!e) return '';
    if (e.id) return 'id:' + String(e.id);
    return 'txt:' + norm(e.logradouro || '') + '|' + String(e.numero || 'SN') + '|' + norm(e.bairro || '');
  }

  function lerFav() {
    try {
      var bruto = localStorage.getItem(CHAVE_FAV);
      if (!bruto) return [];
      var obj = JSON.parse(bruto);
      return Array.isArray(obj) ? obj : [];
    } catch (e) {
      console.warn('[EnderecosFavoritos] Storage corrompido, ignorando.', e);
      try { localStorage.removeItem(CHAVE_FAV); } catch (e2) {}
      return [];
    }
  }

  function persistirFav(lista) {
    try {
      localStorage.setItem(CHAVE_FAV, JSON.stringify(lista));
    } catch (e) {
      console.warn('[EnderecosFavoritos] Não foi possível salvar.', e);
    }
  }

  function emitirFav() {
    var lista = lerFav();
    ouvintesFav.forEach(function (fn) {
      try { fn(lista); } catch (e) { console.warn(e); }
    });
  }

  function favTem(endereco) {
    var ch = chaveDe(endereco);
    if (!ch) return false;
    return lerFav().some(function (e) { return chaveDe(e) === ch; });
  }

  function favToggle(endereco) {
    if (!endereco || !endereco.logradouro) return false;
    var ch = chaveDe(endereco);
    var lista = lerFav();
    var idx = -1;
    for (var i = 0; i < lista.length; i++) {
      if (chaveDe(lista[i]) === ch) { idx = i; break; }
    }

    if (idx >= 0) {
      lista.splice(idx, 1);
      persistirFav(lista);
      emitirFav();
      return false;
    }

    lista.unshift({
      id: endereco.id || null,
      logradouro: endereco.logradouro || '',
      numero: endereco.numero || 'SN',
      bairro: endereco.bairro || '',
      cep: endereco.cep || '',
      lat: endereco.lat,
      lng: endereco.lng,
      address: endereco.address || endereco.logradouro || '',
      salvo_em: Date.now()
    });
    persistirFav(lista);
    emitirFav();
    return true;
  }

  function favListar() {
    return lerFav();
  }

  function favRemover(endereco) {
    var ch = chaveDe(endereco);
    if (!ch) return;
    var lista = lerFav().filter(function (e) { return chaveDe(e) !== ch; });
    persistirFav(lista);
    emitirFav();
  }

  function favLimpar() {
    try { localStorage.removeItem(CHAVE_FAV); } catch (e) {}
    emitirFav();
  }

  function favOnChange(fn) {
    if (typeof fn === 'function') ouvintesFav.push(fn);
  }

  global.EnderecosFavoritos = {
    tem: favTem,
    toggle: favToggle,
    listar: favListar,
    remover: favRemover,
    limpar: favLimpar,
    onChange: favOnChange
  };

})(window);
