/* ==============================================================
   ECONOMIZEI! RIO CLARO — MODELO DE LOJISTA
   Fonte única dos prefixos de módulo e das regras de estado do
   lojista (sem-cadastro / pendente / ativo / vencendo / vencido / bloqueado).

   Usado por: painel master, hub do empreendedor, painel-auth.js,
              e todos os módulos (via painel-auth.js).

   Sem dependências externas. Expõe tudo em window.Economizei.Lojista.
   ============================================================== */
(function (global) {
  'use strict';

  // Fonte única dos prefixos. Se você adicionar um novo módulo,
  // adicione aqui e tudo (master, hub, auth, módulos) enxerga.
  var PREFIXOS = {
    pedidos: [
      'PRO','RES','LAN','PAD','ACA','BAR','TRL','PAS','CHU','SUP',
      'ACO','HOR','GAS','MAT','FAR','ACD','POS','OFI','MEC','FES',
      'DOC','ALG','BRI','INT','VAR','PSH','AGR','PRA','DEL'
    ],
    loja: ['LOJA','ROU','SAP','MOV','DEC','FLO','ART','ACE','LIN','FIT','BRE','COS'],
    transporte: ['TAX','MOT','FRE','REB','VAN','TRANSP_'],
    orcamentos: ['PRO','MAT','SER','ARQ','TER','ALU']
  };

  // Rótulos bonitos pra UI
  var ROTULOS_MODULO = {
    pedidos: 'Pedidos',
    loja: 'Loja',
    transporte: 'Transporte',
    orcamentos: 'Orçamentos'
  };

  // ------------------------------------------------------------------
  // Módulo do lojista
  // ------------------------------------------------------------------

  // Retorna o nome do módulo ('pedidos'|'loja'|'transporte'|'orcamentos')
  // a partir do estabelecimentoId. Retorna null se não bate com nenhum.
  // Se o id bater com mais de um módulo (ex: PRO em pedidos e orcamentos),
  // retorna o primeiro que casar na ordem de PREFIXOS — hoje 'pedidos'.
  function moduloDoId(id) {
    if (!id) return null;
    var chaves = Object.keys(PREFIXOS);
    for (var i = 0; i < chaves.length; i++) {
      var mod = chaves[i];
      var prefixos = PREFIXOS[mod];
      for (var j = 0; j < prefixos.length; j++) {
        if (String(id).startsWith(prefixos[j])) return mod;
      }
    }
    return null;
  }

  // Lista todos os módulos que o id casa (útil pra debug do master)
  function modulosDoId(id) {
    if (!id) return [];
    return Object.keys(PREFIXOS).filter(function (mod) {
      return PREFIXOS[mod].some(function (p) { return String(id).startsWith(p); });
    });
  }

  function rotuloModulo(mod) {
    return ROTULOS_MODULO[mod] || mod || '';
  }

  // ------------------------------------------------------------------
  // Estado do lojista
  // ------------------------------------------------------------------

  function dataVencimento(dados) {
    if (!dados || !dados.dataVencimento) return null;
    if (typeof dados.dataVencimento.toDate === 'function') {
      return dados.dataVencimento.toDate();
    }
    return new Date(dados.dataVencimento);
  }

  // Dias restantes (arredonda pra cima). Retorna null se não tem vencimento.
  function diasParaVencer(dados) {
    var venc = dataVencimento(dados);
    if (!venc) return null;
    return Math.ceil((venc - new Date()) / (1000 * 60 * 60 * 24));
  }

  // Regra central. Os valores possíveis são:
  //   'sem-cadastro' — dados vazios/nulos (doc não existe no Firestore)
  //   'pendente'     — cadastro sem estabelecimentoId (aguardando aprovação)
  //   'bloqueado'    — bloqueadoManualmente === true
  //   'vencido'      — data de vencimento já passou
  //   'vencendo'     — faltam ≤ 10 dias
  //   'ativo'        — tudo em ordem
  function estadoDoLojista(dados) {
    if (!dados) return 'sem-cadastro';
    if (!dados.estabelecimentoId) return 'pendente';
    if (dados.bloqueadoManualmente === true) return 'bloqueado';
    var dias = diasParaVencer(dados);
    if (dias === null) return 'ativo';
    if (dias <= 0) return 'vencido';
    if (dias <= 10) return 'vencendo';
    return 'ativo';
  }

  // Estado pronto pra mostrar em UI. Devolve:
  //   { tipo, label, classe, cor, mensagem }
  // 'classe' casa com os badges do master/hub.
  function rotuloDoEstado(estado) {
    var mapa = {
      'sem-cadastro': { tipo: 'sem-cadastro', label: 'Sem cadastro',        classe: 'badge-neutral', cor: 'neutral', mensagem: 'Sua conta não possui cadastro de lojista.' },
      pendente:       { tipo: 'pendente',     label: 'Aguardando aprovação', classe: 'badge-neutral', cor: 'neutral', mensagem: 'Seu cadastro está em análise.' },
      ativo:          { tipo: 'ativo',        label: 'Ativo',               classe: 'badge-ok',      cor: 'ok',      mensagem: '' },
      vencendo:       { tipo: 'vencendo',     label: 'Vencendo em breve',   classe: 'badge-warn',    cor: 'warn',    mensagem: 'Sua assinatura vence em breve.' },
      vencido:        { tipo: 'vencido',      label: 'Vencido',             classe: 'badge-danger',  cor: 'danger',  mensagem: 'Sua assinatura venceu.' },
      bloqueado:      { tipo: 'bloqueado',    label: 'Bloqueado',           classe: 'badge-danger',  cor: 'danger',  mensagem: 'Seu acesso está suspenso.' }
    };
    return mapa[estado] || mapa.ativo;
  }

  // Atalho: devolve true/false se o cara pode usar o painel.
  function podeAcessar(dados) {
    var estado = estadoDoLojista(dados);
    return estado === 'ativo' || estado === 'vencendo';
  }

  // ------------------------------------------------------------------
  // Exposição
  // ------------------------------------------------------------------
  global.Economizei = global.Economizei || {};
  global.Economizei.Lojista = {
    PREFIXOS: PREFIXOS,
    ROTULOS_MODULO: ROTULOS_MODULO,
    moduloDoId: moduloDoId,
    modulosDoId: modulosDoId,
    rotuloModulo: rotuloModulo,
    dataVencimento: dataVencimento,
    diasParaVencer: diasParaVencer,
    estadoDoLojista: estadoDoLojista,
    rotuloDoEstado: rotuloDoEstado,
    podeAcessar: podeAcessar
  };
})(window);
