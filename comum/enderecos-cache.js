/* ============================================================
   ECONOMIZEI! RIO CLARO — CACHE DE ENDEREÇOS (CNEFE)
   Baixa uma vez do Firestore, guarda em localStorage por 24h,
   oferece busca local instantânea com filtro por termos.

   Depende de: window.EconomizeiFirebase.db (comum/firebase.js)
   Expõe: window.EnderecosCache
   ============================================================ */
(function (global) {
  'use strict';

  var CHAVE_CACHE = 'enderecosRioClaroV1';
  var TTL = 24 * 60 * 60 * 1000; // 24h
  var COLECAO = 'enderecos_chunks';

  var indice = null;      // array de endereços em memória
  var carregando = null;  // Promise enquanto baixa

  /* ---------- Normalização ---------- */
  function norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* ---------- Cache local (localStorage) ---------- */
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
      // localStorage cheio ou bloqueado — segue sem cache
      console.warn('[EnderecosCache] Não foi possível salvar cache.', e);
    }
  }

  function limparCache() {
    try { localStorage.removeItem(CHAVE_CACHE); } catch (e) {}
    indice = null;
  }

  /* ---------- Download do Firestore ---------- */
  function baixarFirestore() {
    if (!global.EconomizeiFirebase || !global.EconomizeiFirebase.db) {
      return Promise.reject(new Error('Firebase não inicializado.'));
    }
    var db = global.EconomizeiFirebase.db;
    return db.collection(COLECAO).get().then(function (snap) {
      var todos = [];
      snap.forEach(function (doc) {
        var dados = doc.data();
        if (dados && Array.isArray(dados.enderecos)) {
          for (var i = 0; i < dados.enderecos.length; i++) {
            todos.push(dados.enderecos[i]);
          }
        }
      });
      return todos;
    });
  }

  /* ---------- Carregar (com cache em memória, localStorage e rede) ---------- */
  function carregar() {
    if (indice) return Promise.resolve(indice);
    if (carregando) return carregando;

    var doCache = lerCache();
    if (doCache && doCache.length) {
      indice = doCache;
      return Promise.resolve(indice);
    }

    carregando = baixarFirestore()
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

  /* ---------- Busca local ---------- */
  function buscar(query, limite) {
    if (!indice || !indice.length) return [];
    limite = limite || 8;
    var q = norm(query);
    if (q.length < 3) return [];

    var termos = q.split(' ').filter(Boolean);
    var resultado = [];
    var TETO_INTERNO = limite * 5; // pega mais pra depois ordenar

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

    // Ordena por relevância:
    //   1. busca começa com a query completa
    //   2. logradouro começa com o primeiro termo
    //   3. alfabético
    resultado.sort(function (a, b) {
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

  /* ---------- Consulta por ID (opcional, pra debug) ---------- */
  function porId(id) {
    if (!indice) return null;
    for (var i = 0; i < indice.length; i++) {
      if (indice[i].id === id) return indice[i];
    }
    return null;
  }

  /* ---------- Exportação ---------- */
  global.EnderecosCache = {
    carregar: carregar,
    buscar: buscar,
    porId: porId,
    limparCache: limparCache,
    get pronto() { return !!indice; },
    get total() { return indice ? indice.length : 0; }
  };

})(window);