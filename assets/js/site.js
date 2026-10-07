// Small page behaviours: autoplay looping clips only while they are on screen.
(() => {
  const vids = document.querySelectorAll('video[data-autoplay]');
  if (!vids.length || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) {
      const v = en.target;
      if (en.isIntersecting) v.play().catch(() => {});
      else v.pause();
    }
  }, { threshold: 0.4 });
  vids.forEach((v) => io.observe(v));
})();
