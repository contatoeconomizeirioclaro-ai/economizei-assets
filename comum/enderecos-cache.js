/* ============================================================
   ECONOMIZEI! RIO CLARO — CACHE DE ENDEREÇOS
   Baixa 3 coleções em paralelo, mescla em um índice único,
   guarda em localStorage por 24h, oferece busca local.
   v3 — adicionarLocal() pra refletir marcações em tempo real
   ============================================================ */
(function (global) {
  'use strict';

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

  /* ============================================================
     adicionarLocal(objeto)
     Injeta um endereço novo no índice em memória E atualiza o
     localStorage, pra aparecer imediatamente nas buscas (mesma
     sessão e próximas até 24h).
     Formato esperado:
     { logradouro, numero, bairro, cep, lat, lng, busca?, uid?, nome_usuario?, score?, id? }
     ============================================================ */
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
      /* Cache ainda não foi carregado. Força carregar e depois adiciona. */
      carregar().then(function () {
        indice.unshift(novo);
        salvarCache(indice);
      }).catch(function (err) {
        console.warn('[EnderecosCache] adicionarLocal antes de carregar falhou:', err);
      });
      return;
    }

    /* Evita duplicata exata (mesmo logradouro + número + bairro) */
    for (var i = 0; i < indice.length; i++) {
      var e = indice[i];
      if (norm(e.logradouro) === norm(logradouro) &&
          String(e.numero) === String(numero) &&
          norm(e.bairro) === norm(bairro)) {
        /* Já existe, não duplica */
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

})(window);
