(function() {
  // Detecta se é realmente o Safari (fora dele, "Adicionar à Tela de
  // Início" não existe ou fica em outro lugar, e os passos mostrados
  // ficam sem sentido — Chrome/Firefox iOS e navegadores dentro de apps
  // como Instagram/Facebook usam a engine do Safari mas não são o Safari).
  function isRealMobileSafari() {
    var ua = navigator.userAgent || navigator.vendor || window.opera || '';
    var isOtherBrowserOrWebview = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|Instagram|FBAN|FBAV|Line\/|MicroMessenger|Twitter/.test(ua);
    return !isOtherBrowserOrWebview;
  }

  // Função para detectar se é iOS (iPhone/iPad) e versão do Safari
  function isEligibleiOS() {
    if (typeof navigator === 'undefined') return false;
    
    // Verifica se é dispositivo iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    
    if (!isIOS) return false;

    // Fora do Safari de verdade, os passos abaixo não se aplicam —
    // melhor não mostrar do que mostrar instrução que não funciona
    if (!isRealMobileSafari()) return false;
    
    // Verifica se já está no modo standalone (já instalado como PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         window.navigator.standalone === true;
    
    if (isStandalone) return false; // Já instalado, não mostra aviso
    
    // Verifica versão do Safari (opcional - iOS 16.4+ tem melhor suporte PWA)
    const matches = navigator.userAgent.match(/OS (\d+)_/);
    if (matches && matches.length > 1) {
      const iosVersion = parseInt(matches[1], 10);
      if (iosVersion < 14) return false; // Versões muito antigas
    }
    
    return true;
  }
  
  // Verifica se o usuário já fechou o banner antes (usando localStorage)
  function shouldShowBanner() {
    const fechado = localStorage.getItem('pwaBannerFechado');
    if (fechado) {
      const dataFechamento = parseInt(fechado, 10);
      const agora = Date.now();
      const umaSemana = 7 * 24 * 60 * 60 * 1000;
      // Mostra novamente depois de uma semana
      return (agora - dataFechamento) > umaSemana;
    }
    return true;
  }
  
  // Mostra o banner se elegível
  if (isEligibleiOS() && shouldShowBanner()) {
    // Pequeno delay para não atrapalhar o carregamento
    setTimeout(function() {
      var banner = document.getElementById('ios-pwa-banner');
      if (banner) {
        banner.style.display = 'block';
      }
    }, 2000); // Aparece após 2 segundos
  }
  
  // Função global para fechar o banner
  window.fecharBannerPWA = function() {
    var banner = document.getElementById('ios-pwa-banner');
    if (banner) {
      banner.style.display = 'none';
      // Salva no localStorage que fechou (agora)
      localStorage.setItem('pwaBannerFechado', Date.now().toString());
    }
  };
})();
