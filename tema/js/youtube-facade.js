document.addEventListener('DOMContentLoaded', function () {
  function loadYouTubeFacade(facade) {
    var videoId = facade.getAttribute('data-yt-id');
    if (!videoId) return;
    var iframe = document.createElement('iframe');
    iframe.setAttribute('src', 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&rel=0');
    iframe.setAttribute('title', facade.getAttribute('aria-label') || 'YouTube video player');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    iframe.setAttribute('allowfullscreen', '');
    iframe.style.position = 'absolute';
    iframe.style.inset = '0';
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    facade.innerHTML = '';
    facade.appendChild(iframe);
    facade.classList.remove('yt-facade');
  }
  document.querySelectorAll('.yt-facade').forEach(function (facade) {
    facade.addEventListener('click', function () { loadYouTubeFacade(facade); });
    facade.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        loadYouTubeFacade(facade);
      }
    });
  });
});
