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
    const next = (n + slides.length) % slides.length;
    if (next === i) return;
    i = next;
    slides.forEach((s, k) => s.classList.toggle('is-current', k === i));
    dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
    if (window.__playLines) window.__playLines(slides[i].querySelector('[data-lines]'));
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
    const toggle = () => {
      const open = card.classList.toggle('is-flipped');
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', toggle);
    card.addEventListener('click', e => {
      if (e.target.closest('.card__flip')) return;   // button fires its own handler
      if (e.target.closest('a')) return;             // let links behave normally
      if (String(getSelection())) return;            // don't toggle after selecting text
      toggle();
    });
  });
})();

/* Line-by-line reveal.
   MagicUI splits on "\n"; these are single sentences that wrap, so the lines
   have to be measured from the rendered text with Range rects. */
(function () {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function splitIntoLines(el) {
    if (!el.dataset.text) el.dataset.text = el.textContent.trim();
    const text = el.dataset.text;
    el.textContent = text;

    const node = el.firstChild;
    if (!node || node.nodeType !== 3) return;

    const range = document.createRange();
    const breaks = [];
    let prevTop = null;
    for (let i = 1; i <= text.length; i++) {
      range.setStart(node, i - 1);
      range.setEnd(node, i);
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;      // collapsed whitespace
      if (prevTop !== null && r.top - prevTop > 1) breaks.push(i - 1);
      prevTop = r.top;
    }

    const bounds = [0, ...breaks, text.length];
    const frag = document.createDocumentFragment();
    let n = 0;
    for (let i = 0; i < bounds.length - 1; i++) {
      const chunk = text.slice(bounds[i], bounds[i + 1]).trim();
      if (!chunk) continue;
      const outer = document.createElement('span');
      outer.className = 'line';
      outer.style.setProperty('--n', n++);
      const inner = document.createElement('span');
      inner.textContent = chunk;
      outer.appendChild(inner);
      frag.appendChild(outer);
    }
    el.textContent = '';
    el.appendChild(frag);
  }

  function play(el) {
    if (!el || reduce) return;
    el.classList.remove('is-revealing');
    void el.offsetWidth;                                   // restart the animation
    el.classList.add('is-revealing');
  }

  const targets = () => [...document.querySelectorAll('[data-lines]')];

  function splitAll() { targets().forEach(splitIntoLines); }

  // webfonts change where lines break, so split only once they have loaded
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    splitAll();
    const hero = document.querySelector('.hero [data-lines]');
    play(hero);
    const current = document.querySelector('.slide.is-current [data-lines]');
    play(current);
    window.__playLines = play;
  });

  let t;
  addEventListener('resize', () => {
    clearTimeout(t);
    t = setTimeout(() => {
      splitAll();
      targets().forEach(el => el.classList.remove('is-revealing'));
      const vis = document.querySelector('.slide.is-current [data-lines]');
      if (vis) vis.classList.add('is-revealing');
    }, 180);
  });
})();
