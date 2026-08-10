/**
 * KAILASH PORTFOLIO - SCROLL TRIGGERED ANIMATIONS
 * Uses IntersectionObserver to trigger animations when scrolling DOWN or UP.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Select all elements configured with scroll animation classes
  const animatedElements = document.querySelectorAll('.scroll-anim');

  // Options for IntersectionObserver
  const observerOptions = {
    root: null, // Viewport
    rootMargin: '0px 0px -40px 0px', // Trigger slightly before full view
    threshold: 0.15 // 15% visibility required to trigger
  };

  // Callback function executed when elements enter or leave viewport
  const observerCallback = (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // Element scrolled INTO view (scrolling down or up) -> Show animation
        entry.target.classList.add('is-visible');
      } else {
        // Element scrolled OUT of view -> Remove class so animation triggers again on next scroll!
        entry.target.classList.remove('is-visible');
      }
    });
  };

  // Initialize IntersectionObserver
  const scrollObserver = new IntersectionObserver(observerCallback, observerOptions);

  // Observe each element
  animatedElements.forEach(element => {
    scrollObserver.observe(element);
  });

  // Optional: Gentle entrance delay for header on initial page load
  setTimeout(() => {
    document.querySelector('#header-bar')?.classList.add('is-visible');
    document.querySelector('#hero-section')?.classList.add('is-visible');
  }, 100);
});
