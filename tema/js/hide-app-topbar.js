(function() {
  var host = (window.location.hostname || '').toLowerCase();
  var query = window.location.search || '';
  var isAppHost = host === 'app.economizeirioclaro.com.br';
  var isAppQuery = /(?:^|[?&])app=(?:1|true)(?:&|$)/i.test(query);

  if (!isAppHost && !isAppQuery) return;

  function hideAppTopBar() {
    var bars = document.querySelectorAll('.top-bar-painel');
    for (var i = 0; i < bars.length; i++) {
      if (bars[i].style.display !== 'none') {
        bars[i].style.display = 'none';
      }
    }
  }

  hideAppTopBar();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hideAppTopBar);
  }
  window.addEventListener('load', hideAppTopBar);

  // O App pode recriar o cabeçalho depois do carregamento; reaplica somente esta regra.
  if (window.MutationObserver) {
    var appTopBarObserver = new MutationObserver(hideAppTopBar);
    appTopBarObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style']
    });
  }
})();
