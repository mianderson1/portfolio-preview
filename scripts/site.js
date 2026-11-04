/* Three slides use a simplified graphic on mobile — larger labels, fewer
   elements. <picture> would be the obvious tool, but with display:contents it
   still made the <img> wrap to a second grid row at desktop, and without it the
   wrapper becomes the grid item and every .slide__media rule misses. Swapping
   the src keeps the grid exactly as it was. */
(function () {
  const imgs = [...document.querySelectorAll('.slide__media[data-mobile-src]')];
  if (!imgs.length) return;
  const mq = matchMedia('(max-width: 700px)');
  const sync = () => imgs.forEach(img => {
    if (!img.dataset.desktopSrc) img.dataset.desktopSrc = img.getAttribute('src');
    const want = mq.matches ? img.dataset.mobileSrc : img.dataset.desktopSrc;
    if (!img.getAttribute('src').endsWith(want)) img.setAttribute('src', want);
  });
  sync();
  mq.addEventListener('change', sync);
})();

/* About carousel — a native scroll-snap track.
   The slides used to share one grid cell and cross-fade, so a swipe had
   nothing to move. They now sit in a row inside a scroller: the gesture, the
   momentum and the snap belong to the browser, and all this does is drive it
   from the arrows and dots, and read back which slide it settled on. */
(function () {
  const root = document.querySelector('[data-carousel]');
  if (!root) return;

  const viewport = root.querySelector('.carousel__viewport');
  const slides = [...root.querySelectorAll('.slide')];
  const dotsBox = root.querySelector('.carousel__dots');
  const prev = root.querySelector('[data-prev]');
  const next = root.querySelector('[data-next]');
  if (!viewport || !slides.length) return;

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
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

  /* Centre a slide by the difference between its midpoint and the
     scrollport's. Measuring beats arithmetic here: below 700 the scroller
     carries inline padding and a gap, and this never has to know. */
  function centre(n, behavior) {
    const v = viewport.getBoundingClientRect();
    const s = slides[n].getBoundingClientRect();
    const delta = (s.left + s.width / 2) - (v.left + v.width / 2);
    if (!delta) return;
    viewport.scrollBy({ left: delta, behavior });
  }

  let typeT;
  /* The panel moves in, then the type follows it. Only when a control was
     used: after a free swipe the incoming card has been on screen the whole
     time, and re-animating its panel there reads as a glitch rather than as
     an entrance. */
  function enter(slide, animate) {
    const lines = slide.querySelector('[data-lines]');
    const play = () => { if (window.__playLines) window.__playLines(lines); };
    clearTimeout(typeT);
    if (!animate || reduce.matches) { play(); return; }
    slide.classList.remove('is-entering');
    void slide.offsetWidth;                       // restart the animation
    slide.classList.add('is-entering');
    // the panel's travel is a token, so read the matching delay from the same
    // place rather than keeping a second copy of the timing here
    const d = parseFloat(getComputedStyle(document.documentElement)
                .getPropertyValue('--motion-type-delay')) || 170;
    typeT = setTimeout(play, d);
  }

  /* Split in two. The classes drive the de-emphasis of the off-centre cards,
     so they have to track the scroll live — waiting for it to settle would
     leave the card you are dragging towards blurred under your finger. The
     copy reveal is the expensive half and still waits for the scroll to stop. */
  function applyActive(n) {
    if (n === i) return false;
    i = n;
    slides.forEach((s, k) => {
      s.classList.toggle('is-current', k === i);
      if (k !== i) s.classList.remove('is-entering');
    });
    dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
    return true;
  }

  let revealed = i;
  function mark(n, animate) {
    if (!applyActive(n)) return;
    revealed = i;
    enter(slides[i], animate);
  }

  // which slide is nearest the middle right now
  function nearest() {
    const v = viewport.getBoundingClientRect();
    const mid = v.left + v.width / 2;
    let best = 0, bestD = Infinity;
    slides.forEach((s, n) => {
      const r = s.getBoundingClientRect();
      const d = Math.abs((r.left + r.width / 2) - mid);
      if (d < bestD) { bestD = d; best = n; }
    });
    return best;
  }

  /* A programmatic scroll passes over the slides in between, and reading those
     would replay their copy reveal on the way past. Hold the readback until
     the scroll has settled. */
  let locked = false, settle;
  function go(n) {
    const target = (n + slides.length) % slides.length;
    /* Wrapping runs the length of the track. Smooth-scrolling across three
       snap points lets the snap engine catch the scroll part-way and settle
       somewhere in between — which is how the last slide stopped being able to
       reach the first. A wrap jumps instead. */
    const wrapped = Math.abs(target - i) > 1;
    locked = true;
    centre(target, (reduce.matches || wrapped) ? 'auto' : 'smooth');
    mark(target, true);
    clearTimeout(settle);
    // re-read at the end: if the scroll did not land where it was told, the
    // dots and the index correct themselves rather than drifting out of sync
    settle = setTimeout(() => { locked = false; mark(nearest(), false); }, 700);
  }

  let raf = 0, idle;
  viewport.addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0;
      if (!locked) applyActive(nearest());
    });
    clearTimeout(idle);
    idle = setTimeout(() => {
      if (locked) return;
      const n = nearest();
      applyActive(n);
      if (n !== revealed) { revealed = n; enter(slides[n], false); }
    }, 120);
  }, { passive: true });

  /* iOS scrolls a newly focused control into view, which shifts the page under
     the tap. detail > 0 means the click came from a pointer rather than from
     the keyboard, so the focus is dropped there and kept everywhere else. */
  const tap = (btn, step) => btn.addEventListener('click', e => {
    if (e.detail > 0) btn.blur();
    go(i + step);
  });
  tap(prev, -1);
  tap(next, 1);

  root.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft') { go(i - 1); prev.focus(); }
    if (e.key === 'ArrowRight') { go(i + 1); next.focus(); }
  });

  // the card width changes with the breakpoint, so re-centre what was showing
  let lastW = innerWidth, resizeT;
  addEventListener('resize', () => {
    if (innerWidth === lastW) return;
    lastW = innerWidth;
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      locked = true;
      centre(i, 'auto');
      clearTimeout(settle);
      settle = setTimeout(() => { locked = false; }, 200);
    }, 180);
  });

  slides.forEach((s, k) => s.classList.toggle('is-current', k === i));
  dots.forEach((d, k) => d.setAttribute('aria-selected', String(k === i)));
  centre(i, 'auto');
})();

/* Reveal the nav once the hero has scrolled past.
   Can't observe the hero itself: it is position:sticky for the sheet overlay,
   so it stays pinned at top:0 and never stops intersecting. Use scroll depth. */
(function () {
  const nav = document.getElementById('site-nav');
  if (!nav) return;

  /* Mark the section being read. IntersectionObserver is no good here: the hero
     is position:sticky, so it reports as visible forever and every section below
     it would tie. Take the last section whose top has crossed a reading line. */
  const links = [...nav.querySelectorAll('.site-nav__links a[href^="#"]'),
                 ...document.querySelectorAll('.nav-popover a[href^="#"]')];
  const sections = [];
  for (const a of links) {
    const href = a.getAttribute('href');
    if (sections.some(s => s.href === href)) continue;
    const el = document.querySelector(href);
    if (el) sections.push({ href, el });
  }

  let currentHref = null;
  function spy() {
    if (!sections.length) return;
    const line = window.scrollY + window.innerHeight * 0.4;
    let active = sections[0].href;
    for (const s of sections) {
      if (s.el.getBoundingClientRect().top + window.scrollY <= line) active = s.href;
    }
    // the last section is shorter than the reading line can reach
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      active = sections[sections.length - 1].href;
    }
    if (active === currentHref) return;
    currentHref = active;
    // the compact bar names the section you are in rather than saying "Sections"
    const label = nav.querySelector('.site-nav__current');
    const match = links.find(a => a.getAttribute('href') === active);
    if (label && match) label.textContent = match.textContent.trim();
    for (const a of links) {
      const on = a.getAttribute('href') === active;
      a.classList.toggle('is-current', on);
      if (on) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    }
  }

  // the popover anchors above the bar, so it needs the bar's measured height
  const measure = () =>
    document.documentElement.style.setProperty('--nav-h', nav.offsetHeight + 'px');

  // a single class toggle is cheap; no rAF throttle needed
  const update = () => {
    nav.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.7);
    spy();
    measure();
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update, { passive: true });
  update();

  const pop = document.getElementById('nav-sections');
  const btn = nav.querySelector('.site-nav__disclosure');
  if (pop && btn && 'onbeforetoggle' in pop) {
    pop.addEventListener('beforetoggle', e =>
      btn.setAttribute('aria-expanded', String(e.newState === 'open')));
  }
  if (pop) pop.addEventListener('click', e => {
    if (e.target.tagName === 'A' && pop.hidePopover) pop.hidePopover();
  });
})();

/* Skill cards — cross-fade between the front heading and the back detail. */
(function () {
  document.querySelectorAll('.card').forEach(card => {
    const btn = card.querySelector('.card__flip');
    if (!btn) return;
    const back = card.querySelector('.card__face--back[data-lines]');
    const toggle = () => {
      const open = card.classList.toggle('is-flipped');
      btn.setAttribute('aria-expanded', String(open));
      // the back copy reveals line by line, same as the hero and slide copy.
      // __playLines is defined once fonts have loaded, which is long before a
      // click can land, but guard anyway so a flip never depends on it.
      if (open && back && window.__playLines) window.__playLines(back);
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

  /* The original markup, kept so a re-split starts from the source rather
     than from the spans the last split left behind. */
  const original = new WeakMap();

  function splitIntoLines(el) {
    if (!original.has(el)) original.set(el, el.innerHTML);
    el.innerHTML = original.get(el);

    /* Walk to the text nodes rather than reading textContent. The hero's
       subtext wraps "Currently:" in an <em>, and flattening to text would
       drop it — so offsets are mapped back into the tree and each line is
       cloned out with its markup intact. */
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let total = 0, node;
    while ((node = walker.nextNode())) {
      nodes.push({ node, start: total, len: node.nodeValue.length });
      total += node.nodeValue.length;
    }
    if (!total) return;
    const full = nodes.map(n => n.node.nodeValue).join('');
    const at = off => {
      for (const n of nodes) if (off <= n.start + n.len) return [n.node, off - n.start];
      const last = nodes[nodes.length - 1];
      return [last.node, last.len];
    };

    const range = document.createRange();
    const breaks = [];
    let prevTop = null;
    for (let i = 1; i <= total; i++) {
      const [sn, so] = at(i - 1), [en, eo] = at(i);
      range.setStart(sn, so);
      range.setEnd(en, eo);
      const r = range.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;      // collapsed whitespace
      if (prevTop !== null && r.top - prevTop > 1) breaks.push(i - 1);
      prevTop = r.top;
    }

    const bounds = [0, ...breaks, total];
    const frag = document.createDocumentFragment();
    let n = 0;
    for (let i = 0; i < bounds.length - 1; i++) {
      let a = bounds[i], b = bounds[i + 1];
      // trim the leading space only. The space that caused the break belongs
      // to the end of this line, and keeping it is what stops the lines
      // concatenating into "healthcareat" for anything reading the text.
      while (a < b && /\s/.test(full[a])) a++;
      if (a >= b) continue;
      const [sn, so] = at(a), [en, eo] = at(b);
      range.setStart(sn, so);
      range.setEnd(en, eo);
      const outer = document.createElement('span');
      outer.className = 'line';
      outer.style.setProperty('--n', n++);
      const inner = document.createElement('span');
      inner.appendChild(range.cloneContents());
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
    // every block in the hero, not just the first — the subtext opts in too,
    // and each carries its own delay base so they arrive in order
    document.querySelectorAll('.hero [data-lines]').forEach(play);
    play(document.querySelector('.hero__actions'));
    const current = document.querySelector('.slide.is-current [data-lines]');
    play(current);
    window.__playLines = play;
  });

  /* Only the width can change where the lines break, and watching it is what
     keeps the copy still on iOS: showing or hiding the URL bar fires resize
     with the width untouched, which used to re-split and replay the reveal
     every time you stopped scrolling. After a real width change the lines are
     re-measured but left in their resting state — the copy is visible by
     default, so dropping is-revealing simply means it does not animate again. */
  let t, lastWidth = innerWidth;
  addEventListener('resize', () => {
    if (innerWidth === lastWidth) return;
    lastWidth = innerWidth;
    clearTimeout(t);
    t = setTimeout(() => {
      targets().forEach(el => el.classList.remove('is-revealing'));
      splitAll();
    }, 180);
  });
})();

/* Copy the email address and confirm with a toast.
   This never hands off to the mail client: the click is always cancelled, and
   if the async clipboard is unavailable or rejects (Safari does when the page
   is not focused) we fall back to a hidden textarea, then to showing the
   address in the toast so it can still be read off. The mailto: href only
   survives for right-click "Copy Email Address" and for no-JS. */
(function () {
  const toast = document.getElementById('toast');
  const targets = document.querySelectorAll('[data-copy-email]');
  if (!toast || !targets.length) return;

  const closeBtn = toast.querySelector('.toast__close');
  const label = toast.querySelector('.toast__text');
  let timer;

  function show(message) {
    label.textContent = message;
    toast.hidden = false;
    void toast.offsetWidth;                 // let the transition catch the change
    toast.classList.add('is-open');
    clearTimeout(timer);
    timer = setTimeout(hide, 4000);
  }
  function hide() {
    clearTimeout(timer);
    toast.classList.remove('is-open');
    setTimeout(() => { toast.hidden = true; }, 300);
  }
  closeBtn.addEventListener('click', hide);
  addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });

  // deprecated, but still the only copy path in a few browsers
  function legacyCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:-9999px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (err) { ok = false; }
    ta.remove();
    return ok;
  }

  targets.forEach(el => {
    el.addEventListener('click', async e => {
      e.preventDefault();                   // never open the mail app
      const email = el.dataset.copyEmail;
      let ok = false;
      if (navigator.clipboard) {
        try { await navigator.clipboard.writeText(email); ok = true; }
        catch (err) { ok = false; }
      }
      if (!ok) ok = legacyCopy(email);
      show(ok ? 'Copied email address' : email);
    });
  });
})();

/* "Hello" goes to the very top. The hero is position:sticky, so an #anchor jump
   lands at its flow position rather than at the top of the document. */
(function () {
  document.querySelectorAll('a[href="#hello"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const pop = document.getElementById('nav-sections');
      if (pop && pop.matches(':popover-open')) pop.hidePopover();
      window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  });
})();
