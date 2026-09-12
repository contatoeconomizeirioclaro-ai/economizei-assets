(function() {
  'use strict';
  
  // Chave para armazenar a posição no sessionStorage
  var SCROLL_STORAGE_KEY = 'economizei_scroll_positions';
  
  // Função para obter o objeto de posições salvas
  function getScrollPositions() {
    try {
      var stored = sessionStorage.getItem(SCROLL_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (e) {
      console.warn('Erro ao recuperar posições de scroll:', e);
      return {};
    }
  }
  
  // Função para salvar a posição de scroll
  function saveScrollPosition() {
    try {
      var positions = getScrollPositions();
      var currentUrl = window.location.pathname + window.location.search;
      positions[currentUrl] = window.scrollY || window.pageYOffset || 0;
      sessionStorage.setItem(SCROLL_STORAGE_KEY, JSON.stringify(positions));
    } catch (e) {
      console.warn('Erro ao salvar posição de scroll:', e);
    }
  }
  
  // Função para restaurar a posição de scroll
  function restoreScrollPosition() {
    try {
      var positions = getScrollPositions();
      var currentUrl = window.location.pathname + window.location.search;
      var savedPosition = positions[currentUrl];
      
      if (typeof savedPosition !== 'undefined' && savedPosition > 0) {
        // Restaura após um pequeno delay para garantir que o DOM está pronto
        setTimeout(function() {
          window.scrollTo(0, savedPosition);
        }, 100);
      }
    } catch (e) {
      console.warn('Erro ao restaurar posição de scroll:', e);
    }
  }
  
  // Salva a posição sempre que o usuário rola a página
  window.addEventListener('scroll', function() {
    saveScrollPosition();
  }, { passive: true });
  
  // Salva a posição quando a página está prestes a ser descarregada
  window.addEventListener('beforeunload', function() {
    saveScrollPosition();
  });
  
  // Salva a posição quando clica em um link (card)
  document.addEventListener('click', function(e) {
    var link = e.target.closest('a[href]');
    if (link && link.href) {
      saveScrollPosition();
    }
  }, true);
  
  // Restaura a posição quando a página carrega
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', restoreScrollPosition);
  } else {
    restoreScrollPosition();
  }
  
  // Também tenta restaurar após um pequeno delay
  setTimeout(restoreScrollPosition, 500);
})();
