/* About carousel — no dependencies. */
(function () {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;

  const slides = [...root.querySelectorAll('.slide')];
  const dotsBox = root.querySelector('.carousel__dots');
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  let i = slides.findIndex(s => s.classList.contains('is-current'));
  if (i < 0) i = 0;

  const dots = slides.map((_, n) => {
    const b = document.createElement('button');
    b.className = 'carousel__dot';
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `Slide ${n + 1} of ${slides.length}`);
    b.addEventListener('click', () => go(n));
    dotsBox.appendChild(b);
    return b;
  });

  function go(n) {
    i = (n + slides.length) % slides.length;
    slides.forEach((s, k) => s.classList.toggle('is-current', k === i));
    dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
  }

  prev.addEventListener('click', () => go(i - 1));
  next.addEventListener('click', () => go(i + 1));

  root.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { go(i - 1); prev.focus(); }
    if (e.key === 'ArrowRight') { go(i + 1); next.focus(); }
  });

  go(i);
})();

/* Reveal the nav once the hero has scrolled past. */
(function () {
  const nav = document.getElementById('site-nav');
  const hero = document.querySelector('.hero');
  if (!nav || !hero) return;

  if (!('IntersectionObserver' in window)) { nav.classList.add('is-visible'); return; }

  new IntersectionObserver(
    ([entry]) => nav.classList.toggle('is-visible', !entry.isIntersecting),
    { rootMargin: '-40% 0px 0px 0px', threshold: 0 }
  ).observe(hero);

  // keep aria-expanded honest for the mobile disclosure
  const pop = document.getElementById('nav-sections');
  const btn = nav.querySelector('.site-nav__disclosure');
  if (pop && btn && 'onbeforetoggle' in pop) {
    pop.addEventListener('beforetoggle', e =>
      btn.setAttribute('aria-expanded', String(e.newState === 'open')));
  }
  pop && pop.addEventListener('click', e => {
    if (e.target.tagName === 'A' && pop.hidePopover) pop.hidePopover();
  });
})();

/* Skill cards — cross-fade between the front heading and the back detail. */
(function () {
  document.querySelectorAll('.card').forEach(card => {
    const btn = card.querySelector('.card__flip');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const open = card.classList.toggle('is-flipped');
      btn.setAttribute('aria-expanded', String(open));
    });
  });
})();
