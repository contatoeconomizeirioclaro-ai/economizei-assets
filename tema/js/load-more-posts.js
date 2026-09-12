(function($) {
    'use strict';
    $(document).ready(function() {
        var $gridContainer = $('.grid-posts');
        var $pagerContainer = $('#blog-pager');
        
        if (!$gridContainer.length || !$pagerContainer.length) return;

        function normalizarGradeDeArtigos() {
            $gridContainer.children('strong').each(function() {
                $(this).find('.index-post').each(function() {
                    $gridContainer.append(this);
                });
                $(this).remove();
            });
        }

        normalizarGradeDeArtigos();

        $(document).on('click', '.blog-pager-older-link', function(e) {
            e.preventDefault();
            var $link = $(this);
            var loadUrl = $link.attr('href');

            if (!loadUrl || $link.hasClass('loading')) return;

            $link.addClass('loading').text('Carregando...');
            
            $.ajax({
                url: loadUrl,
                type: 'GET',
                success: function(data) {
                    var $data = $(data);
                    var $newPosts = $data.find('.grid-posts .index-post').detach();
                    var $nextPageLink = $data.find('.blog-pager-older-link');

                    if ($newPosts.length) {
                        $gridContainer.append($newPosts);
                        normalizarGradeDeArtigos();
                        
                        // Não é mais necessário chamar matchHeight aqui:
                        // o CSS Grid recalcula a altura das linhas automaticamente
                        // assim que os novos cards (.index-post{height:100%}) entram no DOM.

                        if ($nextPageLink.length) {
                            $pagerContainer.find('.blog-pager-older-link')
                                .attr('href', $nextPageLink.attr('href'))
                                .removeClass('loading')
                                .text('Ver mais posts');
                        } else {
                            $pagerContainer.fadeOut();
                        }
                    } else {
                        $pagerContainer.fadeOut();
                    }
                },
                error: function() {
                    $link.removeClass('loading').text('Erro ao carregar. Tente novamente.');
                }
            });
        });
    });
})(jQuery);
