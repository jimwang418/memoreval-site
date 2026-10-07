// Small page behaviours: inline icons, and looping clips that play only while on screen.
(() => {
  const ICON = {
    text: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 3.5h10M8 3.5v9.5"/></svg>',
    desc: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M2.5 3h11v7.5H7l-3 2.5v-2.5H2.5z"/><path d="M5 6h6M5 8h4" stroke-linecap="round"/></svg>',
    image: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2.5 11.5l3.5-3.5 3 3 2-2 2.5 2.5"/><circle cx="10.5" cy="6" r="1"/></svg>',
    graph: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="4" cy="4" r="1.8"/><circle cx="12" cy="4" r="1.8"/><circle cx="8" cy="12" r="1.8"/><path d="M5 5.5l2.2 4.8M11 5.5l-2.2 4.8"/></svg>',
  };
  window.SITE_ICON = ICON;
  document.querySelectorAll('i[data-ic]').forEach((i) => {
    i.classList.add('ic-i');
    i.innerHTML = ICON[i.dataset.ic] || '';
    i.setAttribute('aria-hidden', 'true');
  });

  // Looping clips: play while on screen, with a pause button; nothing autoplays under reduced motion.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PLAY = '<svg class="i-play" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.5v11l9.5-5.5z"/></svg><svg class="i-pause" viewBox="0 0 16 16" fill="currentColor"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>';
  const vids = [...document.querySelectorAll('video[data-autoplay]')];
  const held = new WeakSet();
  vids.forEach((v) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'vbtn paused'; b.innerHTML = PLAY; b.setAttribute('aria-label', 'Play');
    v.parentElement.appendChild(b);
    const sync = () => { b.classList.toggle('paused', v.paused); b.setAttribute('aria-label', v.paused ? 'Play' : 'Pause'); };
    v.addEventListener('play', sync); v.addEventListener('pause', sync);
    b.addEventListener('click', () => { if (v.paused) { held.delete(v); v.play().catch(() => {}); } else { held.add(v); v.pause(); } });
  });
  if (!vids.length || reduce) return;
  const io = new IntersectionObserver((ents) => {
    for (const en of ents) {
      const v = en.target;
      if (en.isIntersecting && !held.has(v)) v.play().catch(() => {});
      else if (!en.isIntersecting) v.pause();
    }
  }, { threshold: 0.4 });
  vids.forEach((v) => io.observe(v));
})();
