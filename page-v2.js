/* =========================================================================
   Opt-in page V2 — behaviour: before/after splitter, projects carousel,
   testimonials drag-slider, FAQ accordion, Lenis smooth scroll.
   Loaded with `defer` after GSAP/Draggable/InertiaPlugin/ScrollTrigger/Lenis.
   ========================================================================= */

  // Before/After slider — AFTER shown by default, drag handle right to reveal BEFORE.
  gsap.registerPlugin(Draggable);
  function initBeforeAfterSplitSlider() {
    const splitters = document.querySelectorAll('[data-splitter="wrap"]');
    splitters.forEach((splitter) => {
      if (splitter.dataset.kbInit) return;
      splitter.dataset.kbInit = '1';
      const handle = splitter.querySelector('[data-splitter="handle"]');
      const after = splitter.querySelector('[data-splitter="after"]');
      let bounds = splitter.getBoundingClientRect();
      let currentPercent = parseFloat(splitter.getAttribute('data-splitter-initial')) || 50;

      const setPositions = (percent) => {
        bounds = splitter.getBoundingClientRect();
        if (!bounds.width) return;
        const positionX = (percent / 100) * bounds.width;
        gsap.set(handle, { x: positionX, left: 0 });
        gsap.set(after, { clipPath: `inset(0 0 0 ${percent}%)` });
      };

      setPositions(currentPercent);

      const draggable = Draggable.create(handle, {
        type: 'x',
        bounds: splitter,
        cursor: 'ew-resize',
        activeCursor: 'grabbing',
        onDrag() {
          currentPercent = (this.x / bounds.width) * 100;
          gsap.set(after, { clipPath: `inset(0 0 0 ${currentPercent}%)` });
        }
      })[0];

      const resync = () => {
        setPositions(currentPercent);
        if (draggable) draggable.update();
      };

      // Re-sync whenever the splitter itself resizes — covers web fonts loading,
      // images decoding, GHL iframe paint, container queries, etc.
      if ('ResizeObserver' in window) {
        new ResizeObserver(resync).observe(splitter);
      } else {
        window.addEventListener('resize', resync);
      }

      // Belt-and-braces: re-sync once everything has finished loading.
      window.addEventListener('load', resync);
      splitter.querySelectorAll('img').forEach((img) => {
        if (!img.complete) img.addEventListener('load', resync, { once: true });
      });
    });
  }
  // Cascading slider — clip-path reveal carousel (selected work).
  function initCascadingSlider() {

    const duration = 0.65;
    const ease = 'power3.inOut';

    const breakpoints = [
      { maxWidth: 479, activeWidth: 0.78, siblingWidth: 0.08 },
      { maxWidth: 767, activeWidth: 0.70, siblingWidth: 0.10 },
      { maxWidth: 991, activeWidth: 0.60, siblingWidth: 0.10 },
      { maxWidth: Infinity, activeWidth: 0.60, siblingWidth: 0.13 },
    ];

    const wrappers = document.querySelectorAll('[data-cascading-slider-wrap]');
    wrappers.forEach(setupInstance);

    function setupInstance(wrapper) {
      if (wrapper.dataset.kbInit) return;
      wrapper.dataset.kbInit = '1';
      const viewport = wrapper.querySelector('[data-cascading-viewport]');
      const prevButton = wrapper.querySelector('[data-cascading-slider-prev]');
      const nextButton = wrapper.querySelector('[data-cascading-slider-next]');
      const slides = Array.from(viewport.querySelectorAll('[data-cascading-slide]'));
      let totalSlides = slides.length;

      if (totalSlides === 0) return;

      if (totalSlides < 9) {
        const originalSlides = slides.slice();
        while (slides.length < 9) {
          originalSlides.forEach(function(original) {
            const clone = original.cloneNode(true);
            clone.setAttribute('data-clone', '');
            viewport.appendChild(clone);
            slides.push(clone);
          });
        }
        totalSlides = slides.length;
      }

      let activeIndex = 0;
      let isAnimating = false;
      let slideWidth = 0;
      let slotCenters = {};
      let slotWidths = {};

      function readGap() {
        const raw = getComputedStyle(viewport).getPropertyValue('--gap').trim();
        if (!raw) return 0;
        const temp = document.createElement('div');
        temp.style.width = raw;
        temp.style.position = 'absolute';
        temp.style.visibility = 'hidden';
        viewport.appendChild(temp);
        const px = temp.offsetWidth;
        viewport.removeChild(temp);
        return px;
      }

      function getSettings() {
        const windowWidth = window.innerWidth;
        for (let i = 0; i < breakpoints.length; i++) {
          if (windowWidth <= breakpoints[i].maxWidth) return breakpoints[i];
        }
        return breakpoints[breakpoints.length - 1];
      }

      function getOffset(slideIndex, fromIndex) {
        if (fromIndex === undefined) fromIndex = activeIndex;
        let distance = slideIndex - fromIndex;
        const half = totalSlides / 2;
        if (distance > half) distance -= totalSlides;
        if (distance < -half) distance += totalSlides;
        return distance;
      }

      function measure() {
        const settings = getSettings();
        const viewportWidth = viewport.offsetWidth;
        const gap = readGap();

        const activeSlideWidth = viewportWidth * settings.activeWidth;
        const siblingSlideWidth = viewportWidth * settings.siblingWidth;
        const farSlideWidth = Math.max(0, (viewportWidth - activeSlideWidth - 2 * siblingSlideWidth - 4 * gap) / 2);

        slideWidth = activeSlideWidth;

        const visibleSlots = [
          { slot: -2, width: farSlideWidth },
          { slot: -1, width: siblingSlideWidth },
          { slot: 0, width: activeSlideWidth },
          { slot: 1, width: siblingSlideWidth },
          { slot: 2, width: farSlideWidth },
        ];

        let x = 0;
        visibleSlots.forEach(function(def, i) {
          slotCenters[String(def.slot)] = x + def.width / 2;
          slotWidths[String(def.slot)] = def.width;
          if (i < visibleSlots.length - 1) x += def.width + gap;
        });

        slotCenters['-3'] = slotCenters['-2'] - farSlideWidth / 2 - gap - farSlideWidth / 2;
        slotWidths['-3'] = farSlideWidth;
        slotCenters['3'] = slotCenters['2'] + farSlideWidth / 2 + gap + farSlideWidth / 2;
        slotWidths['3'] = farSlideWidth;

        slides.forEach(function(slide) {
          slide.style.width = slideWidth + 'px';
        });
      }

      function getSlideProps(offset) {
        const clamped = Math.max(-3, Math.min(3, offset));
        const slotWidth = slotWidths[String(clamped)];
        const clipAmount = Math.max(0, (slideWidth - slotWidth) / 2);
        const translateX = slotCenters[String(clamped)] - slideWidth / 2;

        return {
          x: translateX,
          '--clip': clipAmount,
          zIndex: 10 - Math.abs(clamped),
        };
      }

      function layout(animate, previousIndex) {
        slides.forEach(function(slide, index) {
          const offset = getOffset(index);

          if (offset < -3 || offset > 3) {
            if (animate && previousIndex !== undefined) {
              const previousOffset = getOffset(index, previousIndex);
              if (previousOffset >= -2 && previousOffset <= 2) {
                const exitSlot = previousOffset < 0 ? -3 : 3;
                gsap.to(slide, Object.assign({}, getSlideProps(exitSlot), {
                  duration: duration,
                  ease: ease,
                  overwrite: true,
                }));
                return;
              }
            }

            const parkSlot = offset < 0 ? -3 : 3;
            gsap.set(slide, getSlideProps(parkSlot));
            return;
          }

          const props = getSlideProps(offset);
          slide.setAttribute('data-status', offset === 0 ? 'active' : 'inactive');

          if (animate) {
            gsap.to(slide, Object.assign({}, props, {
              duration: duration,
              ease: ease,
              overwrite: true,
            }));
          } else {
            gsap.set(slide, props);
          }
        });
      }

      function goTo(targetIndex) {
        const normalizedTarget = ((targetIndex % totalSlides) + totalSlides) % totalSlides;
        if (isAnimating || normalizedTarget === activeIndex) return;
        isAnimating = true;

        const previousIndex = activeIndex;
        const travelDirection = getOffset(normalizedTarget, previousIndex) > 0 ? 1 : -1;

        slides.forEach(function(slide, index) {
          const currentOffset = getOffset(index, previousIndex);
          const nextOffset = getOffset(index, normalizedTarget);
          const wasInRange = currentOffset >= -3 && currentOffset <= 3;
          const willBeVisible = nextOffset >= -2 && nextOffset <= 2;

          if (!wasInRange && willBeVisible) {
            const entrySlot = travelDirection > 0 ? 3 : -3;
            gsap.set(slide, getSlideProps(entrySlot));
          }

          const wasInvisible = Math.abs(currentOffset) >= 3;
          const willBeStaging = Math.abs(nextOffset) === 3;
          const crossesSides = currentOffset * nextOffset < 0;
          if (wasInvisible && willBeStaging && crossesSides) {
            gsap.set(slide, getSlideProps(nextOffset > 0 ? 3 : -3));
          }
        });

        activeIndex = normalizedTarget;
        layout(true, previousIndex);
        gsap.delayedCall(duration + 0.05, function() { isAnimating = false; });
      }

      if (prevButton) prevButton.addEventListener('click', function() { goTo(activeIndex - 1); });
      if (nextButton) nextButton.addEventListener('click', function() { goTo(activeIndex + 1); });

      slides.forEach(function(slide, index) {
        slide.addEventListener('click', function() {
          if (index !== activeIndex) goTo(index);
        });
      });

      document.addEventListener('keydown', function(event) {
        if (event.key === 'ArrowLeft') goTo(activeIndex - 1);
        if (event.key === 'ArrowRight') goTo(activeIndex + 1);
      });

      let resizeTimer;
      window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
          measure();
          layout(false);
        }, 100);
      });

      measure();
      layout(false);
    }
  }

  // Overlapping testimonial slider — drag horizontally; cards scale/rotate behind active.
  if (window.InertiaPlugin) gsap.registerPlugin(InertiaPlugin);

  function initOverlappingSlider() {
    const inits = document.querySelectorAll('[data-overlap-slider-init]');
    if (!inits.length) return;

    inits.forEach(setupOverlappingSlider);

    function setupOverlappingSlider(init) {
      if (init.dataset.kbInit) return;
      init.dataset.kbInit = '1';
      const minScale = +(init.getAttribute('data-scale') ?? 0.45);
      const maxRotation = +(init.getAttribute('data-rotate') ?? -8);
      const inertia = true;

      const wrap = init.querySelector('[data-overlap-slider-collection]');
      const slider = init.querySelector('[data-overlap-slider-list]');
      const slides = Array.from(init.querySelectorAll('[data-overlap-slider-item]'));

      if (!wrap || !slider || !slides.length) return;

      wrap.style.touchAction = 'none';
      wrap.style.userSelect = 'none';

      let spacing = 0;
      let slideW = 0;
      let maxDrag = 0;
      let dragX = 0;
      let draggable;

      function clamp(value) {
        if (maxDrag <= 0) return 0;
        return Math.min(Math.max(value, 0), maxDrag);
      }

      function update() {
        gsap.set(slider, { x: -dragX });
        slides.forEach((slide, i) => {
          const threshold = i * spacing;
          const local = Math.max(0, dragX - threshold);
          const t = spacing > 0 ? Math.min(local / spacing, 1) : 0;
          gsap.set(slide, {
            x: local,
            scale: 1 - (1 - minScale) * t,
            rotation: maxRotation * t,
            transformOrigin: '75% center'
          });
        });
      }

      function recalc() {
        if (!slides.length) return;
        const style = getComputedStyle(slides[0]);
        const gapRight = parseFloat(style.marginRight) || 0;
        slideW = slides[0].offsetWidth;
        spacing = slideW + gapRight;
        maxDrag = spacing * (slides.length - 1);
        dragX = clamp(dragX);
        update();
        if (draggable) draggable.applyBounds({ minX: -maxDrag, maxX: 0 });
      }

      draggable = Draggable.create(slider, {
        type: 'x',
        bounds: { minX: -maxDrag, maxX: 0 },
        inertia,
        maxDuration: 1,
        snap: (raw) => {
          const d = clamp(-raw);
          const idx = spacing > 0 ? Math.round(d / spacing) : 0;
          return -idx * spacing;
        },
        onDrag() { dragX = clamp(-this.x); update(); },
        onThrowUpdate() { dragX = clamp(-this.x); update(); }
      })[0];

      const ro = new ResizeObserver(() => { recalc(); });
      ro.observe(init);

      let active = false;
      let currentIndex = 0;

      function goToSlide(idx) {
        idx = Math.max(0, Math.min(idx, slides.length - 1));
        currentIndex = idx;
        const targetX = idx * spacing;
        gsap.to({ value: dragX }, {
          value: targetX,
          duration: 0.35,
          ease: 'power4.out',
          onUpdate: function () {
            dragX = this.targets()[0].value;
            gsap.set(slider, { x: -dragX });
            update();
          }
        });
        wrap.setAttribute('aria-label', `Slide ${idx + 1} of ${slides.length}`);
      }

      const io = new IntersectionObserver(entries => {
        active = entries[0].isIntersecting;
      }, { threshold: 0.25 });
      io.observe(init);

      wrap.setAttribute('role', 'region');
      wrap.setAttribute('aria-roledescription', 'carousel');
      wrap.setAttribute('aria-label', 'Testimonial slider');

      function onKey(e) {
        if (!active) return;
        if (e.key === 'ArrowLeft') { e.preventDefault(); goToSlide(currentIndex - 1); }
        if (e.key === 'ArrowRight') { e.preventDefault(); goToSlide(currentIndex + 1); }
      }
      window.addEventListener('keydown', onKey);

      recalc();
    }
  }

  // FAQ accordion — opening one closes the others.
  function initFaqAccordion() {
    const items = document.querySelectorAll('.faq__item');
    items.forEach(function (item) {
      if (item.dataset.kbInit) return;
      item.dataset.kbInit = '1';
      item.addEventListener('toggle', function () {
        if (!item.open) return;
        items.forEach(function (other) {
          if (other !== item) other.open = false;
        });
      });
    });
  }

  // Run every interactive init. Each is idempotent (guarded by data-kb-init),
  // so repeated calls are safe. GHL is a single-page app that renders this
  // embed late and can re-render it after hydration, so we fire on DOM ready,
  // on window load, and a few delayed retries to bind to the FINAL DOM.
  function kbInitAll() {
    try { initBeforeAfterSplitSlider(); } catch (e) {}
    try { initCascadingSlider(); } catch (e) {}
    try { initOverlappingSlider(); } catch (e) {}
    try { initFaqAccordion(); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', kbInitAll);
  } else {
    kbInitAll();
  }
  window.addEventListener('load', kbInitAll);
  [400, 1000, 2000, 3500].forEach(function (t) { setTimeout(kbInitAll, t); });

  gsap.registerPlugin(ScrollTrigger);

  const lenis = new Lenis({ anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => { lenis.raf(time * 1000); });
  gsap.ticker.lagSmoothing(0);

  window.addEventListener('load', () => {
    ScrollTrigger.refresh();
    lenis.resize();
  });
  document.fonts.ready.then(() => {
    ScrollTrigger.refresh();
    lenis.resize();
  });
