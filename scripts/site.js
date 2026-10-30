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
