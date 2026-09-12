(function() {
  if (!document.documentElement.classList.contains('app-view')) return;

  function init() {
    const logoLink = document.querySelector('#Header1 .header-image-wrapper');
    if (!logoLink) return;

    const baseUrl = window.location.origin + window.location.pathname;
    const homeAppUrl = baseUrl + '?app&m=1';  // URL da home app

    // Se já estiver na home app, bloqueia (não recarrega)
    if (window.location.href === homeAppUrl || 
        (window.location.pathname === '/' && window.location.search.includes('app'))) {
      logoLink.addEventListener('click', function(e) {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    } else {
      // Em outras páginas, redireciona para a home app
      logoLink.href = homeAppUrl;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
