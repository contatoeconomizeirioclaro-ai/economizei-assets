(function($) {
  "use strict";

  $(function() {

    // ========== 1. CONSTRUIR MENU DESKTOP ==========
    function buildDesktopMenu() {
      var container = $('#main-menu');
      if (!container.length) return;

      var items = [];
      $('#LinkList74 ul li a').each(function() {
        var $this = $(this);
        items.push({
          text: $this.text(),
          url: $this.attr('href')
        });
      });

      if (!items.length) return;

      var $ul = $('<ul id="main-menu-nav" role="menubar">');
      var currentParent = null;

      $.each(items, function(i, item) {
        var text = item.text;
        var isSubmenu = text.charAt(0) === '_';

        if (isSubmenu) {
          if (currentParent) {
            var $subUl = currentParent.find('ul');
            if (!$subUl.length) {
              $subUl = $('<ul>').addClass('dropdown');
              currentParent.append($subUl);
            }
            var $subLi = $('<li>').append($('<a>', {
              href: item.url,
              text: text.substring(1)
            }));
            $subUl.append($subLi);
          }
        } else {
          currentParent = $('<li>').append($('<a>', {
            href: item.url,
            text: text,
            role: 'menuitem'
          }));
          $ul.append(currentParent);
        }
      });

      container.empty().append($ul);
      // Usar filter ao invés de :has() para melhor performance
      $ul.find('li').filter(function() {
        return $(this).find('ul').length > 0;
      }).addClass('has-sub').each(function() {
        // Itens-cabeçalho (ex: "Políticas e Termos") só organizam o submenu via hover -
        // não levam a lugar nenhum, então removemos o href='#' e usamos role=button
        // em vez de deixar um <a> "fantasma" (ruim para SEO e leitores de tela)
        $(this).children('a').first().removeAttr('href').attr({
          role: 'button',
          tabindex: '0',
          'aria-haspopup': 'true',
          'aria-expanded': 'false'
        });
      });
    }

    // ========== 2. CONSTRUIR MENU MOBILE (submenus recolhidos) ==========
    var menuIconMap = {
      'Home': 'fa-house',
      'Início': 'fa-house',
      'Políticas e Termos': 'fa-file-shield',
      'Quem Somos': 'fa-circle-info',
      'Cadastre o seu Negócio': 'fa-store',
      'Links úteis': 'fa-link'
    };

    function buildMobileMenu() {
      var mobileMenu = $('.mobile-menu');
      if (!mobileMenu.length) return;

      var desktopMenu = $('#main-menu-nav');
      if (!desktopMenu.length) return;

      var mobileList = $('<ul>').addClass('mobile-menu-ul');
      var currentParentLi = null;

      desktopMenu.children('li').each(function() {
        var $li = $(this).clone();
        var $a = $li.find('> a'); // Pega apenas o link principal do item
        var text = $a.text();
        var hasSubmenu = $(this).find('ul').length > 0;

        if (text.charAt(0) === '_') {
          // É um subitem
          $a.text(text.substring(1));
          if (currentParentLi) {
            var subUl = currentParentLi.find('.m-sub');
            if (!subUl.length) {
              subUl = $('<ul>').addClass('m-sub');
              currentParentLi.append(subUl);
              currentParentLi.addClass('has-sub');
            }
            subUl.append($li);
          }
        } else {
          // É um item principal
          var iconClass = menuIconMap[text];
          if (iconClass) {
            $a.prepend('<i class="fa-solid ' + iconClass + ' menu-item-icon" aria-hidden="true"></i>');
          }
          currentParentLi = $li;
          mobileList.append($li);
          if (hasSubmenu) {
            currentParentLi.addClass('has-sub');
            // Item-cabeçalho só abre/fecha o submenu (o clique já é interceptado
            // com e.preventDefault() no handler abaixo). Remove o href='#' herdado
            // do desktop e usa role=button, pra não deixar um <a> "fantasma".
            $a.removeAttr('href').attr({
              role: 'button',
              tabindex: '0',
              'aria-haspopup': 'true',
              'aria-expanded': 'false'
            });
          }
        }
      });

      mobileMenu.empty().append(mobileList);

      // FORÇAR FECHAMENTO IMEDIATO VIA JS
      mobileMenu.find('.m-sub').css('display', 'none');
      mobileMenu.find('.has-sub').removeClass('show');

      // Adicionar toggles (setas)
      mobileMenu.find('.has-sub > a').after('<span class="submenu-toggle"></span>');

      // Eventos
      mobileMenu.off('click', '.submenu-toggle').on('click', '.submenu-toggle', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSubmenu($(this).parent());
      });

      // Clique em links pais (com submenu) expande/contrai o submenu
      mobileMenu.off('click', '.has-sub > a').on('click', '.has-sub > a', function(e) {
        e.preventDefault();
        e.stopPropagation();
        toggleSubmenu($(this).parent());
      });
      
      // Clique em links filhos (subitens) permite navegação normal
      mobileMenu.off('click', '.m-sub a').on('click', '.m-sub a', function(e) {
        // Permite navegação normal - não previne o comportamento padrão
        e.stopPropagation();
      });

    function toggleSubmenu($li) {
  var $submenu = $li.children('.m-sub');
  var $toggleBtn = $li.children('a[role="button"]');
  if ($li.hasClass('show')) {
    $li.removeClass('show');
    $submenu.css('display', 'none');
    $toggleBtn.attr('aria-expanded', 'false');
  } else {
    $li.siblings('.has-sub.show').removeClass('show').children('.m-sub').css('display', 'none')
      .end().children('a[role="button"]').attr('aria-expanded', 'false');
    $li.addClass('show');
    $submenu.css('display', 'block');
    $toggleBtn.attr('aria-expanded', 'true');
  }
}
    }

      // Executa a construção dos menus com debounce para melhor performance
    buildDesktopMenu();
    buildMobileMenu();
    
    // Otimização: usar event delegation com debounce para hover no desktop
    var hoverTimeout;
    $('#main-menu').off('mouseenter', 'li').on('mouseenter', 'li', function() {
      clearTimeout(hoverTimeout);
      $(this).find('> ul').stop(true, false).fadeIn(100);
    }).off('mouseleave', 'li').on('mouseleave', 'li', function() {
      var $submenu = $(this).find('> ul');
      hoverTimeout = setTimeout(function() {
        $submenu.stop(true, false).fadeOut(100);
      }, 50);
    });

    // ========== 3. MENU MOBILE: DRAWER LATERAL COM OVERLAY ==========
    var mobileToggle = $('.mobile-menu-toggle');
    var mobileWrap = $('.mobile-menu-wrap');
    var mobileMenuContainer = $('.mobile-menu');

    // Cria o overlay dinamicamente (caso não exista no HTML)
    if ($('.menu-overlay').length === 0) {
      $('body').append('<div class="menu-overlay"></div>');
    }
    var overlay = $('.menu-overlay');

    // Função para abrir o menu
    function openMobileMenu() {
      $('body').addClass('nav-active');
      mobileToggle.attr('aria-expanded', 'true');
      $('body').css('overflow', 'hidden');
    }

    // Função para fechar o menu
    function closeMobileMenu() {
      $('body').removeClass('nav-active');
      mobileToggle.attr('aria-expanded', 'false');
      $('body').css('overflow', '');
    }

    // Toggle ao clicar no botão
    mobileToggle.on('click', function(e) {
      e.preventDefault();
      if ($('body').hasClass('nav-active')) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    // Fechar ao clicar no overlay
    overlay.on('click', function() {
      closeMobileMenu();
    });

    // ===== Fecha o drawer quando clica em links de subitens (dentro de .m-sub) =====
    mobileMenuContainer.on('click', '.m-sub a', function(e) {
      // Links dentro de submenus navegam normalmente e fecham o drawer
      closeMobileMenu();
    });

    // Impede que cliques dentro do drawer (em qualquer lugar) fechem o overlay
    mobileWrap.on('click', function(e) {
      e.stopPropagation();
    });

    // ========== 4. BUSCA ==========
    var searchToggle = $('.show-search');
    var searchForm = $('#nav-search');
    var hideSearch = $('.hide-search');

    searchToggle.on('click', function(e) {
      e.preventDefault();
      searchForm.fadeIn(200);
      searchToggle.hide();
      $('.social-toggle').hide();
    });

    hideSearch.on('click', function(e) {
      e.preventDefault();
      searchForm.fadeOut(200);
      searchToggle.show();
      $('.social-toggle').show();
    });

    // ========== 5. MENU SOCIAL ==========
    var socialToggle = $('.social-toggle');
    var socialMenu = $('#social-menu');

    socialToggle.on('click', function(e) {
      e.preventDefault();
      socialMenu.slideToggle(200);
      socialToggle.toggleClass('social-active');
    });

    // ========== 6. FIXED SIDEBAR (se ativado) ==========
  if (typeof fixedSidebar !== 'undefined' && fixedSidebar === true) {
  if ($('#sidebar-wrapper').length && $('#main-wrapper').length) {
    var initSticky = function() {
      $('#sidebar-wrapper').theiaStickySidebar({
        additionalMarginTop: 90,
        additionalMarginBottom: 20
      });
    };
    window.addEventListener('load', function() {
      requestAnimationFrame(initSticky);
    });
  }
}

    // ========== 7. AJUSTE DE ALTURA IGUAL (matchHeight) ==========
    // Nota: .grid-posts .index-post NÃO usa mais matchHeight — o CSS Grid
    // (.grid-posts{display:grid} + .index-post{height:100%}) já entrega
    // altura igual nativamente, sem o reflow que o JS causava (CLS).
   // A grade CSS já equaliza os cards; evita leitura de layout após a carga.
    // ========== 8. FECHAR MENU MOBILE AO REDIMENSIONAR PARA DESKTOP ==========
    $(window).on('resize', function() {
      if ($(window).width() > 980) {
        closeMobileMenu();
      }
    });

  });
})(jQuery);
