(function() {
  'use strict';
  
  // Aguarda o DOM carregar
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAppNav);
  } else {
    initAppNav();
  }
  
  function initAppNav() {
    var html = document.documentElement;
    // So roda dentro do PWA instalado (app-view) e nunca dentro da
    // webview nativa do app (app-webview) — evita listeners de scroll/
    // swipe/teclado e vibracao rodando a toa numa barra que fica oculta.
    if (!html.classList.contains('app-view') || html.classList.contains('app-webview')) return;
    
    var appNav = document.getElementById('app-bottom-nav');
    var backBtn = document.getElementById('app-back-button');
    var mainBtn = document.getElementById('app-main-button');
    
    if (!appNav) return;
    
    // 1. MELHORIAS DE ACESSIBILIDADE
    appNav.setAttribute('aria-hidden', 'false');
    
    // 2. BOTÃO VOLTAR INTELIGENTE
    if (backBtn) {
      backBtn.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Vibração tátil (se suportado)
        if (navigator.vibrate) navigator.vibrate(30);
        
        // Análise de uso (opcional)
        try {
          if (typeof gtag === 'function') {
            gtag('event', 'app_nav_click', {
              'event_category': 'app_navigation',
              'event_label': 'back_button'
            });
          }
        } catch(err) {}
        
        // Navegação com fallback
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.location.href = '/';
        }
      });
    }
    
    // 3. BOTÃO PRINCIPAL COM ANIMAÇÃO
    if (mainBtn) {
      // Efeito de pulso ao aparecer (somente se não for reduced-motion)
      if (!document.documentElement.classList.contains('reduced-motion')) {
        setTimeout(function() {
          mainBtn.style.animation = 'pulseEffect 2s ease-in-out';
          setTimeout(function() {
            mainBtn.style.animation = '';
          }, 2000);
        }, 300);
      }
      
      // Feedback visual ao clicar
      mainBtn.addEventListener('click', function() {
        if (navigator.vibrate) navigator.vibrate([30, 20, 30]);
      });
    }
    
    // 4. DETECÇÃO DE ROLAGEM (esconde/mostra barra)
    var lastScrollTop = 0;
    var scrollTimeout;
    
    window.addEventListener('scroll', function() {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      
      var currentScroll = window.pageYOffset || document.documentElement.scrollTop;
      
      // Esconde ao rolar para baixo, mostra ao rolar para cima
      if (currentScroll > lastScrollTop && currentScroll > 100) {
        appNav.classList.add('nav-hidden');
      } else {
        appNav.classList.remove('nav-hidden');
      }
      
      lastScrollTop = currentScroll <= 0 ? 0 : currentScroll;
      
      // Mostra novamente após parar de rolar
      scrollTimeout = setTimeout(function() {
        appNav.classList.remove('nav-hidden');
      }, 1500);
    }, { passive: true });
    
    // 5. SWIPE PARA CIMA PARA ESCONDER TEMPORARIAMENTE
    var touchStartY = 0;
    var touchEndY = 0;
    
    appNav.addEventListener('touchstart', function(e) {
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });
    
    appNav.addEventListener('touchend', function(e) {
      touchEndY = e.changedTouches[0].screenY;
      
      // Swipe para cima (> 50px) na própria barra
      if (touchStartY - touchEndY > 50) {
        appNav.classList.add('nav-hidden');
        setTimeout(function() {
          appNav.classList.remove('nav-hidden');
        }, 3000);
      }
    }, { passive: true });
    
    // 6. KEYBOARD NAVIGATION
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        appNav.classList.toggle('nav-hidden');
      }
    });
  }
})();
