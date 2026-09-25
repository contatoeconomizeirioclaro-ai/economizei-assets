/* ============================================================
   ECONOMIZEI! RIO CLARO — SISTEMA DE MÓDULOS
   Registro central de módulos. Cada módulo se registra aqui
   ao carregar. O core consulta pra saber qual módulo usar
   conforme a coluna ESTILO do CSV.

   CONTRATO DO MÓDULO:
     Economizei.Modulos.registrar({
       id:        'loja',                    // identificador único
       estilo:    'loja',                    // casa com a coluna ESTILO
       rotulo:    'Comprar produtos',        // texto do botão
       icone:     'fa-cart-shopping',        // classe Font Awesome
       classe:    'btn-modulo',              // classe visual do botão
       abrir:     function(idx) { ... },     // abre o modal
       fechar:    function() { ... }         // fecha o modal
     });
   ============================================================ */
(function (global) {
  'use strict';

  var modulos = [];
  var porEstilo = {};

  function registrar(def) {
    if (!def || !def.id || !def.estilo) {
      console.error('[Modulos] Registro inválido (falta id ou estilo):', def);
      return;
    }
    if (typeof def.abrir !== 'function') {
      console.error('[Modulos] Registro inválido (falta abrir):', def);
      return;
    }
    var idx = -1;
    for (var i = 0; i < modulos.length; i++) {
      if (modulos[i].id === def.id) { idx = i; break; }
    }
    if (idx >= 0) modulos[idx] = def; else modulos.push(def);
    porEstilo[String(def.estilo).toLowerCase().trim()] = def;
  }

  function paraEstilo(estilo) {
    if (!estilo) return null;
    return porEstilo[String(estilo).toLowerCase().trim()] || null;
  }

  function abrir(id, idx) {
    for (var i = 0; i < modulos.length; i++) {
      if (modulos[i].id === id) {
        if (typeof modulos[i].abrir === 'function') modulos[i].abrir(idx);
        return;
      }
    }
    console.warn('[Modulos] Módulo não encontrado:', id);
  }

  function fechar(id) {
    for (var i = 0; i < modulos.length; i++) {
      if (modulos[i].id === id) {
        if (typeof modulos[i].fechar === 'function') modulos[i].fechar();
        return;
      }
    }
  }

  function listar() { return modulos.slice(); }

  global.Economizei = global.Economizei || {};
  global.Economizei.Modulos = {
    registrar: registrar,
    paraEstilo: paraEstilo,
    abrir: abrir,
    fechar: fechar,
    listar: listar
  };
})(window);
