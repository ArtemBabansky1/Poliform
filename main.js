/* ============================================================
   ПОЛИФОРМ — animations
   Lenis smooth scroll + GSAP ScrollTrigger
   ============================================================ */
(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  if (prefersReducedMotion || !hasGsap) {
    document.documentElement.classList.add('no-anim');
    if (!hasGsap) return;
  }

  gsap.registerPlugin(ScrollTrigger);

  var EASE = 'power4.out';

  /* ---------- Smooth scroll (Lenis) ---------- */
  var lenis = null;
  if (typeof Lenis !== 'undefined' && !prefersReducedMotion) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }

  /* ---------- Anchor links through Lenis ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -20, duration: 1.4 });
      else target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  /* ---------- Nav: static at top, slides in when scrolling up ---------- */
  var nav = document.getElementById('nav');
  var lastY = 0;
  var navFixed = false;
  function setNavFixed(on) {
    if (on === navFixed) return;
    navFixed = on;
    if (on) {
      /* compensate the space the nav leaves behind so content doesn't jump */
      document.body.style.paddingTop = (nav.offsetHeight + 16) + 'px';
      nav.classList.add('is-fixed');
    } else {
      document.body.style.paddingTop = '';
      nav.classList.remove('is-fixed', 'is-visible');
    }
  }
  function onScrollDir(y) {
    var goingUp = y < lastY;
    /* engage as soon as the static bar is fully above the viewport */
    var navGone = 16 + nav.offsetHeight;
    if (y <= 10) {
      setNavFixed(false);
    } else if (goingUp && y > navGone) {
      if (!navFixed) {
        setNavFixed(true);
        requestAnimationFrame(function () {
          requestAnimationFrame(function () { nav.classList.add('is-visible'); });
        });
      } else {
        nav.classList.add('is-visible');
      }
    } else if (!goingUp && navFixed) {
      nav.classList.remove('is-visible');
    }
    lastY = y;
  }
  if (nav) {
    if (lenis) lenis.on('scroll', function (e) { onScrollDir(e.scroll); });
    else window.addEventListener('scroll', function () { onScrollDir(window.scrollY); }, { passive: true });
  }

  /* ---------- Order modal (messengers + callback field) ---------- */
  var orderModal = document.getElementById('orderModal');
  if (orderModal) {
    var openModal = function () {
      orderModal.classList.add('is-open');
      orderModal.setAttribute('aria-hidden', 'false');
      if (lenis) lenis.stop();
    };
    var closeModal = function () {
      orderModal.classList.remove('is-open');
      orderModal.setAttribute('aria-hidden', 'true');
      if (lenis) lenis.start();
    };
    document.querySelectorAll('.js-order').forEach(function (btn) {
      btn.addEventListener('click', openModal);
    });
    orderModal.querySelectorAll('[data-modal-close]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });
  }

  /* ---------- Hero info feed: auto-rotating slides ---------- */
  var heroSlider = document.getElementById('heroSlider');
  if (heroSlider) {
    var hSlides = heroSlider.querySelectorAll('.hslide');
    var hDots = heroSlider.querySelectorAll('.hero__dot');
    var hCurrent = 0;
    var hTimer = null;
    var hGoTo = function (i) {
      hSlides[hCurrent].classList.remove('is-active');
      hDots[hCurrent].classList.remove('is-active');
      hCurrent = (i + hSlides.length) % hSlides.length;
      hSlides[hCurrent].classList.add('is-active');
      hDots[hCurrent].classList.add('is-active');
    };
    var hStart = function () {
      if (prefersReducedMotion) return;
      hTimer = setInterval(function () { hGoTo(hCurrent + 1); }, 5000);
    };
    hDots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        clearInterval(hTimer);
        hGoTo(i);
        hStart();
      });
    });
    heroSlider.addEventListener('mouseenter', function () { clearInterval(hTimer); });
    heroSlider.addEventListener('mouseleave', function () { hStart(); });
    hStart();
  }

  /* ---------- Split text into masked lines ----------
     NB: collapses only regular whitespace — &nbsp; ( )
     stays glued to its word so hanging prepositions never break. */
  function splitLines(el) {
    var text = el.textContent.replace(/[ \t\r\n]+/g, ' ').trim();
    var words = text.split(' ');
    el.textContent = '';
    var spans = words.map(function (word, i) {
      var s = document.createElement('span');
      s.textContent = word;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });
    var lines = [];
    var currentTop = null;
    spans.forEach(function (s) {
      if (s.offsetTop !== currentTop) { currentTop = s.offsetTop; lines.push([]); }
      lines[lines.length - 1].push(s.textContent);
    });
    el.textContent = '';
    return lines.map(function (lineWords) {
      var line = document.createElement('span');
      line.className = 'line';
      var inner = document.createElement('span');
      inner.className = 'line-inner';
      inner.textContent = lineWords.join(' ');
      line.appendChild(inner);
      el.appendChild(line);
      return inner;
    });
  }

  /* ---------- Big marquee: reacts to scroll velocity ---------- */
  function initMarquee() {
    var track = document.getElementById('marqueeTrack');
    if (!track) return;
    var setX = gsap.quickSetter(track, 'x', 'px');
    var x = 0;
    var dir = -1;
    var lastScroll = window.scrollY;
    var BASE_SPEED = 1.4;         /* px per 60fps frame at rest */
    var VELOCITY_BOOST = 0.22;    /* extra px per scrolled px */
    var MAX_VELOCITY = 60;

    gsap.ticker.add(function (time, deltaTime) {
      var y = window.scrollY;
      var vel = y - lastScroll;
      lastScroll = y;
      if (vel > 1) dir = -1;
      else if (vel < -1) dir = 1;
      var boost = Math.min(Math.abs(vel), MAX_VELOCITY) * VELOCITY_BOOST;
      x += dir * (BASE_SPEED + boost) * (deltaTime / 16.7);
      var half = track.scrollWidth / 2;
      if (half > 0) x = gsap.utils.wrap(-half, 0, x);
      setX(x);
    });
  }

  /* ---------- Founder quote: words scrub from grey to ink/lime ---------- */
  function initQuote() {
    var quote = document.getElementById('quoteText');
    if (!quote) return;
    var words = [];
    function splitNode(node, isAccent) {
      var text = node.textContent.replace(/[ \t\r\n]+/g, ' ');
      text.split(' ').forEach(function (word) {
        if (!word) return;
        /* glue leading punctuation (after an accent span) to the previous word */
        if (/^[,.;:!?»)]+$/.test(word) && words.length) {
          words[words.length - 1].textContent += word;
          return;
        }
        var s = document.createElement('span');
        s.className = 'q-word' + (isAccent ? ' q-word--accent' : '');
        s.textContent = word;
        quote.appendChild(s);
        quote.appendChild(document.createTextNode(' '));
        words.push(s);
      });
    }
    var source = Array.prototype.slice.call(quote.childNodes);
    quote.textContent = '';
    source.forEach(function (node) {
      splitNode(node, node.nodeType === 1 && node.tagName === 'I');
    });
    gsap.fromTo(words,
      { color: '#c9cbbe' },
      {
        color: function (i, el) {
          return el.classList.contains('q-word--accent') ? '#cef79e' : '#222f30';
        },
        stagger: 0.12,
        ease: 'none',
        scrollTrigger: {
          trigger: quote,
          start: 'top 78%',
          end: 'bottom 45%',
          scrub: true
        }
      });
  }

  function initAnimations() {
    if (prefersReducedMotion) {
      document.querySelectorAll('[data-count]').forEach(function (el) {
        el.textContent = el.getAttribute('data-count');
      });
      return;
    }

    initMarquee();
    initQuote();

    /* ---------- Line reveals for [data-split] ---------- */
    document.querySelectorAll('[data-split]').forEach(function (el) {
      var inners = splitLines(el);
      gsap.fromTo(inners,
        { yPercent: 110 },
        {
          yPercent: 0,
          duration: 1.1,
          ease: EASE,
          stagger: 0.09,
          scrollTrigger: { trigger: el, start: 'top 88%' }
        });
    });

    /* ---------- Statement: lines darken on scrub ---------- */
    var statement = document.querySelector('.about__statement');
    if (statement) {
      var stLines = statement.querySelectorAll('.line-inner');
      gsap.fromTo(stLines,
        { color: '#c9cbbe' },
        {
          color: '#222f30',
          stagger: 0.4,
          ease: 'none',
          scrollTrigger: {
            trigger: statement,
            start: 'top 75%',
            end: 'bottom 45%',
            scrub: true
          }
        });
    }

    /* ---------- Generic fade-up reveals ---------- */
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      gsap.fromTo(el,
        { opacity: 0, y: 36 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          ease: EASE,
          scrollTrigger: { trigger: el, start: 'top 90%' }
        });
    });

    /* ---------- Parallax inside masked wrappers ---------- */
    document.querySelectorAll('[data-parallax]').forEach(function (el) {
      var speed = parseFloat(el.getAttribute('data-parallax')) || 0.1;
      gsap.fromTo(el,
        { yPercent: -speed * 100 },
        {
          yPercent: speed * 100,
          ease: 'none',
          scrollTrigger: {
            trigger: el.parentElement,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true
          }
        });
    });

    /* ---------- Stats counters ---------- */
    document.querySelectorAll('[data-count]').forEach(function (el) {
      var target = parseInt(el.getAttribute('data-count'), 10);
      var obj = { val: 0 };
      gsap.to(obj, {
        val: target,
        duration: 1.6,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 90%' },
        onUpdate: function () { el.textContent = Math.round(obj.val); }
      });
    });

    /* ---------- Horizontal scroll section ---------- */
    var track = document.getElementById('hscrollTrack');
    var bar = document.getElementById('hscrollBar');
    if (track) {
      var pin = track.closest('.hscroll__pin');
      var getDistance = function () {
        return Math.max(0, track.scrollWidth - window.innerWidth);
      };
      gsap.to(track, {
        x: function () { return -getDistance(); },
        ease: 'none',
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          end: function () { return '+=' + getDistance(); },
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
          anticipatePin: 1,
          onUpdate: function (self) {
            if (bar) bar.style.width = (self.progress * 100) + '%';
          }
        }
      });
    }

    ScrollTrigger.sort();
    ScrollTrigger.refresh();
  }

  /* Wait for fonts so line-splitting measures real metrics */
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(initAnimations);
  } else {
    window.addEventListener('load', initAnimations);
  }
})();
