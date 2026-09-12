(function() {
  'use strict';

  var carousel = document.querySelector('.carousel-container');
  if (!carousel) return;

  var track = carousel.querySelector('.carousel-track');
  var slides = Array.from(track.children);
  var outer = document.querySelector('.carousel-outer');
  var prevBtn = outer ? outer.querySelector('.prev') : null;
  var nextBtn = outer ? outer.querySelector('.next') : null;

  var currentIndex = 0;
  var slideWidth = 0;
  var autoTimer = null;
  var isVisible = false;
  var isPaused = false;
  var touchStartX = 0;

  function updateSlideWidth() {
    if (slides.length > 0) {
      slideWidth = slides[0].getBoundingClientRect().width;
      goToSlide(currentIndex, false);
    }
  }

  function goToSlide(index, smooth) {
    var total = slides.length;
    if (index < 0) index = total - 1;
    if (index >= total) index = 0;
    currentIndex = index;

    var translateX = -currentIndex * slideWidth;
    track.style.transition = smooth ? 'transform 0.5s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
    track.style.transform = 'translateX(' + translateX + 'px)';
  }

  function nextSlide() { goToSlide(currentIndex + 1, true); }
  function prevSlide() { goToSlide(currentIndex - 1, true); }

  function startAutoScroll() {
    if (autoTimer) clearInterval(autoTimer);
    if (!isVisible || isPaused) return;
    autoTimer = setInterval(function() {
      if (!isPaused && isVisible) nextSlide();
    }, 4000);
  }

  function stopAutoScroll() {
    if (autoTimer) {
      clearInterval(autoTimer);
      autoTimer = null;
    }
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) {
        isVisible = true;
        startAutoScroll();
      } else {
        isVisible = false;
        stopAutoScroll();
      }
    });
  }, { threshold: 0.3 });
  observer.observe(carousel);

  carousel.addEventListener('mouseenter', function() {
    isPaused = true;
    stopAutoScroll();
  });
  carousel.addEventListener('mouseleave', function() {
    isPaused = false;
    if (isVisible) startAutoScroll();
  });

  carousel.addEventListener('touchstart', function(e) {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  carousel.addEventListener('touchend', function(e) {
    if (touchStartX === 0) return;
    var diffX = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(diffX) > 50) {
      if (diffX > 0) prevSlide();
      else nextSlide();
    }
    touchStartX = 0;
  });

  if (prevBtn) prevBtn.addEventListener('click', prevSlide);
  if (nextBtn) nextBtn.addEventListener('click', nextSlide);

  var resizeTimer;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function() {
      updateSlideWidth();
    }, 150);
  });

  updateSlideWidth();
  if (carousel.getBoundingClientRect().top < window.innerHeight) {
    isVisible = true;
    startAutoScroll();
  }
})();
