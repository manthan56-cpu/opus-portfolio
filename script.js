"use strict";

/* Hero video scrub settings */
const isMobile =
  typeof window !== "undefined" &&
  (window.innerWidth < 768 ||
    (window.matchMedia && window.matchMedia("(max-width: 767px)").matches));

const FRAME_COUNT = isMobile ? 64 : 192; // 64 on mobile keeps RAM < 40MB; 192 on desktop gives full 24fps
const MAX_FRAME_SIDE = isMobile ? 540 : 960; // downscale frames for mobile screens
const PLAYBACK_RATE = 2; // speed of the capture playthrough (2x keeps every frame)
const CAPTURE_RUNS = 3; // max playthroughs before falling back to seeking
const EASE = isMobile ? 0.22 : 0.18; // responsive scrub easing
const LOADER_MAX_MS = isMobile ? 2200 : 3000; // loader finishes faster on mobile

const VIDEO_SRC = "assets/Video%20Scrub.mp4";
const END_MARGIN = 0.05; // stop this far before the end so the last slot is a real frame

/* ==========================================================================
   Live local time in Delhi
   ========================================================================== */

const localTime = document.getElementById("localTime");

if (localTime) {
  const timeFormat = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
  });

  const updateTime = () => {
    localTime.textContent = `${timeFormat.format(new Date())} IST`;
  };

  updateTime();
  setInterval(updateTime, 30000);
}

/* ==========================================================================
   Hero video scrub
   ========================================================================== */

const hero = document.getElementById("hero");
const canvas = document.getElementById("heroCanvas");

if (hero && canvas && !isMobile) {
  const ctx = canvas.getContext("2d");
  const frames = new Array(FRAME_COUNT).fill(null);

  let target = 0;
  let current = 0;
  let lastIndex = -1;
  let lastBitmapA = null;
  let lastBitmapB = null;
  let lastBlend = 0;
  let dirty = true;

  /* ---- Drawing ---------------------------------------------------------- */

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = hero.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    dirty = true;
  }

  // Nearest loaded frame to `index`, searching outward in both directions.
  function nearestFrame(index) {
    for (let d = 0; d < FRAME_COUNT; d++) {
      if (frames[index - d]) return frames[index - d];
      if (frames[index + d]) return frames[index + d];
    }
    return null;
  }

  // Draw like `object-fit: cover`.
  function drawCover(bitmap) {
    const cw = canvas.width;
    const ch = canvas.height;
    const scale = Math.max(cw / bitmap.width, ch / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (cw - w) / 2, (ch - h) / 2, w, h);
  }

  // Blend the two frames the scrub sits between, so motion is continuous
  // instead of stepping through 24 stills per second.
  function draw(bitmapA, bitmapB, blend) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCover(bitmapA);
    if (bitmapB && bitmapB !== bitmapA && blend > 0.01) {
      ctx.globalAlpha = blend;
      drawCover(bitmapB);
      ctx.globalAlpha = 1;
    }
  }

  function tick() {
    current += (target - current) * EASE;
    const base = Math.floor(Math.min(Math.max(current, 0), FRAME_COUNT - 1));
    const blend = Math.min(Math.max(current - base, 0), 1);
    const bitmapA = nearestFrame(base);
    const bitmapB = nearestFrame(Math.min(base + 1, FRAME_COUNT - 1));

    if (
      bitmapA &&
      (dirty ||
        base !== lastIndex ||
        bitmapA !== lastBitmapA ||
        bitmapB !== lastBitmapB ||
        Math.abs(blend - lastBlend) > 0.015)
    ) {
      draw(bitmapA, bitmapB, blend);
      lastIndex = base;
      lastBitmapA = bitmapA;
      lastBitmapB = bitmapB;
      lastBlend = blend;
      dirty = false;
    }
    requestAnimationFrame(tick);
  }

  /* ---- Input ------------------------------------------------------------ */

  function setTargetFromX(clientX) {
    const rect = hero.getBoundingClientRect();
    const progress = Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1);
    target = progress * (FRAME_COUNT - 1);
  }

  hero.addEventListener("mousemove", (e) => setTargetFromX(e.clientX));
  hero.addEventListener("touchstart", (e) => setTargetFromX(e.touches[0].clientX), { passive: true });
  hero.addEventListener("touchmove", (e) => setTargetFromX(e.touches[0].clientX), { passive: true });

  window.addEventListener("resize", resizeCanvas);
  resizeCanvas();
  requestAnimationFrame(tick);

  /* ---- Frame extraction ------------------------------------------------- */

  const video = document.createElement("video");
  video.src = VIDEO_SRC;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.setAttribute("aria-hidden", "true");
  // Kept in the DOM (but invisible) so browsers keep presenting frames to it.
  video.style.cssText =
    "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(video);

  // Scratch canvas: copies the current video frame synchronously at the
  // target size, then gets turned into an ImageBitmap.
  const scratch = document.createElement("canvas");
  const scratchCtx = scratch.getContext("2d");

  const once = (el, type) => new Promise((resolve) => el.addEventListener(type, resolve, { once: true }));

  /* ---- Loader ----------------------------------------------------------- */

  const loader = document.getElementById("loader");
  const loaderFill = document.getElementById("loaderFill");
  const loaderPct = document.getElementById("loaderPct");
  const loaderBar = loaderFill && loaderFill.parentElement;
  let loadedCount = 0;
  const captureStart = performance.now();

  function updateLoader() {
    if (!loader) return;
    // Real capture progress, but the bar never stalls: it eases to 100% so the
    // loader finishes in about LOADER_MAX_MS even while frames are still being
    // captured in the background.
    const real = (loadedCount / FRAME_COUNT) * 100;
    const ramp =
      (Math.min((performance.now() - captureStart) / (LOADER_MAX_MS - 400), 1)) * 100;
    const pct = Math.min(100, Math.round(Math.max(real, ramp)));
    loaderFill.style.transform = `scaleX(${pct / 100})`;
    loaderPct.textContent = `${pct}%`;
    loaderBar.setAttribute("aria-valuenow", pct);
  }

  // Advance the bar on a ticker too, so it sweeps smoothly to 100% via the
  // time ramp even while frame captures are still trickling in.
  const loaderTicker = setInterval(updateLoader, 200);

  function hideLoader() {
    clearInterval(loaderTicker);
    if (loader) loader.classList.add("is-done");
  }

  function captureFrame(slot) {
    scratchCtx.drawImage(video, 0, 0, scratch.width, scratch.height);
    return createImageBitmap(scratch).then((bitmap) => {
      if (frames[slot]) {
        bitmap.close();
        return;
      }
      frames[slot] = bitmap;
      loadedCount++;
      updateLoader();
    });
  }

  // Browsers pause (or stall) video in background tabs, so only extract
  // while the page is visible.
  function whenVisible() {
    if (!document.hidden) return Promise.resolve();
    return new Promise((resolve) => {
      const check = () => {
        if (document.hidden) return;
        document.removeEventListener("visibilitychange", check);
        resolve();
      };
      document.addEventListener("visibilitychange", check);
    });
  }

  // Pass 1: play through at speed, grabbing each presented frame into the
  // slot that matches its media time. Resolves "done", "hidden" (the page was
  // hidden mid-run, so it doesn't count) or "failed" (playback refused).
  function playthrough(endTime) {
    return new Promise((resolve) => {
      const pending = [];
      const claimed = new Set();
      let done = false;

      const finish = (result = "done") => {
        if (done) return;
        done = true;
        clearTimeout(safety);
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("pause", onPause);
        video.pause();
        Promise.all(pending).then(() => resolve(result));
      };
      const onEnded = () => finish();
      const onPause = () => finish(document.hidden ? "hidden" : "done");

      const onFrame = (_now, meta) => {
        if (done) return;
        const slot = Math.min(
          FRAME_COUNT - 1,
          Math.max(0, Math.round((meta.mediaTime / endTime) * (FRAME_COUNT - 1)))
        );
        if (!frames[slot] && !claimed.has(slot)) {
          claimed.add(slot);
          pending.push(captureFrame(slot));
        }
        if (meta.mediaTime >= endTime) finish();
        else video.requestVideoFrameCallback(onFrame);
      };

      // Guard against a stalled playthrough.
      const safety = setTimeout(
        () => finish(document.hidden ? "hidden" : "done"),
        (endTime / PLAYBACK_RATE) * 1000 + 4000
      );

      video.currentTime = 0;
      once(video, "seeked").then(() => {
        // The first frame is already presented before playback starts, so
        // requestVideoFrameCallback never reports it: grab it now.
        if (!frames[0]) {
          claimed.add(0);
          pending.push(captureFrame(0));
        }
        video.playbackRate = PLAYBACK_RATE;
        video.requestVideoFrameCallback(onFrame);
        video
          .play()
          .then(() => {
            video.addEventListener("ended", onEnded);
            video.addEventListener("pause", onPause);
          })
          .catch(() => finish(document.hidden ? "hidden" : "failed"));
      });
    });
  }

  // Pass 2: seek only to the slots that are still empty.
  async function fillMissing(endTime) {
    for (let slot = 0; slot < FRAME_COUNT; slot++) {
      if (frames[slot]) continue;
      await whenVisible();
      video.currentTime = (slot / (FRAME_COUNT - 1)) * endTime;
      await once(video, "seeked");
      await captureFrame(slot);
    }
  }

  async function extractFrames() {
    // Hard cap on loader time: hide it after LOADER_MAX_MS even if frames are
    // still missing — the scrub shows the nearest loaded frame while the rest
    // keep filling in.
    setTimeout(hideLoader, LOADER_MAX_MS);

    if (video.readyState < 1) await once(video, "loadedmetadata");

    const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight));
    scratch.width = Math.round(video.videoWidth * scale);
    scratch.height = Math.round(video.videoHeight * scale);

    const endTime = Math.max(0, video.duration - END_MARGIN);

    if ("requestVideoFrameCallback" in HTMLVideoElement.prototype) {
      let runs = 0;
      while (runs < CAPTURE_RUNS && frames.includes(null)) {
        await whenVisible();
        const result = await playthrough(endTime);
        if (result === "failed") break;
        if (result === "done") runs++;
      }
    }
    await fillMissing(endTime);

    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
  }

  extractFrames()
    .catch((err) => console.error("Hero video scrub failed:", err))
    .finally(hideLoader);
}

/* ==========================================================================
   Hero (mobile): ambient autoplay loop
   There is no cursor to drive the scrub on touch, so play the clip as a
   soft looping background instead — and skip the frame-by-frame ImageBitmap
   capture entirely, saving CPU and memory on phones.
   ========================================================================== */

if (hero && canvas && isMobile) {
  canvas.style.display = "none";

  const loader = document.getElementById("loader");
  const hideLoader = () => loader && loader.classList.add("is-done");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const video = document.createElement("video");
  video.className = "hero__video";
  video.src = VIDEO_SRC;
  video.muted = true;
  video.setAttribute("muted", "");
  video.loop = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("aria-hidden", "true");
  video.preload = "auto";
  canvas.insertAdjacentElement("afterend", video);

  if (reduce) {
    // Honour reduced-motion: hold a single frame instead of looping.
    video.addEventListener(
      "loadeddata",
      () => {
        try {
          video.currentTime = Math.min(0.1, (video.duration || 1) * 0.1);
        } catch {}
        hideLoader();
      },
      { once: true }
    );
  } else {
    video.autoplay = true;
    video.setAttribute("autoplay", "");
    video.addEventListener("playing", hideLoader, { once: true });
    video.addEventListener("loadeddata", () => video.play().catch(() => {}), {
      once: true,
    });
  }

  // Never let the loader hang if the video is slow to start or blocked.
  setTimeout(hideLoader, LOADER_MAX_MS);
}

/* ==========================================================================
   Marquee
   ========================================================================== */

const MARQUEE_SPEED = 60; // px per second
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const marqueeRows = [...document.querySelectorAll(".marquee__row")];

if (marqueeRows.length && !reduceMotion) {
  const rows = marqueeRows.map((row) => {
    const track = row.querySelector(".marquee__track");
    const group = track.querySelector(".marquee__group");
    return {
      track,
      group,
      dir: row.classList.contains("marquee--reverse") ? 1 : -1,
      width: 0,
      offset: 0,
    };
  });

  // Clone the group until the track covers the row plus one extra group,
  // so wrapping by one group width is seamless.
  function measureMarquee() {
    for (const r of rows) {
      r.track.querySelectorAll(".marquee__group[data-clone]").forEach((c) => c.remove());
      r.width = r.group.getBoundingClientRect().width;
      if (!r.width) continue;
      const needed = Math.ceil(r.track.parentElement.offsetWidth / r.width) + 1;
      for (let i = 0; i < needed; i++) {
        const clone = r.group.cloneNode(true);
        clone.dataset.clone = "";
        r.track.appendChild(clone);
      }
      r.offset %= r.width;
    }
  }

  let visible = true;
  let boost = 0;
  let lastScrollY = window.scrollY;
  let lastTime = performance.now();

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
  }).observe(marqueeRows[0].closest(".marquee"));

  function marqueeTick(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    // Scroll velocity (px/s) adds a smoothed speed boost.
    const scrollY = window.scrollY;
    const velocity = dt > 0 ? Math.abs(scrollY - lastScrollY) / dt : 0;
    lastScrollY = scrollY;
    const boostTarget = Math.min(velocity * 0.4, 900);
    boost += (boostTarget - boost) * 0.08;

    if (visible) {
      const step = (MARQUEE_SPEED + boost) * dt;
      for (const r of rows) {
        if (!r.width) continue;
        r.offset = (r.offset + step) % r.width;
        // Left-moving rows go 0 → -width; right-moving rows go -width → 0.
        const x = r.dir < 0 ? -r.offset : r.offset - r.width;
        r.track.style.transform = `translate3d(${x}px, 0, 0)`;
      }
    }
    requestAnimationFrame(marqueeTick);
  }

  measureMarquee();
  document.fonts.ready.then(measureMarquee);
  window.addEventListener("resize", measureMarquee);
  requestAnimationFrame(marqueeTick);
}

/* ==========================================================================
   Work: horizontal scroll
   ========================================================================== */

const work = document.getElementById("work");
const workTrack = document.getElementById("workTrack");

if (work && workTrack) {
  const workProgress = document.getElementById("workProgress");
  const workCurrent = document.getElementById("workCurrent");
  const cards = [...workTrack.querySelectorAll(".project")];
  let distance = 0;
  let hashAligned = false;
  // ⚡ Bolt: Cache layout properties to prevent read-after-write layout thrashing in scroll handler
  let cardMetrics = [];
  let workQueued = false;

  function alignHashTarget() {
    if (hashAligned || !window.location.hash) return;
    try {
      const target = document.querySelector(window.location.hash);
      if (target) {
        hashAligned = true;
        requestAnimationFrame(() => {
          target.scrollIntoView({ behavior: "instant" });
          updateWork();
        });
      }
    } catch {
      // ignore invalid selector
    }
  }

  function measureWork() {
    distance = Math.max(0, workTrack.scrollWidth - window.innerWidth);
    work.style.height = `${distance + window.innerHeight}px`;
    cardMetrics = cards.map(card => ({
      left: card.offsetLeft,
      width: card.offsetWidth
    }));
    updateWork();
    alignHashTarget();
  }

  function updateWork() {
    workQueued = false;
    const top = work.getBoundingClientRect().top;
    const progress = distance ? Math.min(Math.max(-top / distance, 0), 1) : 0;

    workTrack.style.transform = `translate3d(${-progress * distance}px, 0, 0)`;
    workProgress.style.width = `${progress * 100}%`;

    // Current project = the card closest to a reference point that travels
    // from the left edge (progress 0) to the right edge (progress 1), so the
    // first and last cards both get counted. offsetLeft is measured from the
    // sticky panel, so add the track's shift.
    const center = window.innerWidth * progress + progress * distance;
    let current = 0;
    let best = Infinity;
    cardMetrics.forEach((metric, i) => {
      const d = Math.abs(metric.left + metric.width / 2 - center);
      if (d < best) {
        best = d;
        current = i;
      }
    });
    workCurrent.textContent = String(current + 1).padStart(2, "0");
  }

  // ⚡ Bolt: Debounce scroll events using requestAnimationFrame to batch DOM updates
  function queueWork() {
    if (workQueued) return;
    workQueued = true;
    requestAnimationFrame(updateWork);
  }

  window.addEventListener("scroll", queueWork, { passive: true });
  window.addEventListener("resize", measureWork);
  document.fonts.ready.then(() => {
    measureWork();
    alignHashTarget();
  });
  measureWork();
}

/* ==========================================================================
   Nav: dark variant over light sections
   ========================================================================== */

// Declared here — above the nav-dark block — so updateNav() can reference
// navDrawer without a temporal-dead-zone ReferenceError. That crash used to
// abort the rest of this file, silently killing the mobile drawer AND the
// cursor image trail (both are set up below).
const navToggle = document.getElementById("navToggle");
const navDrawer = document.getElementById("navDrawer");
const nav = document.querySelector(".nav");
const lightSections = [...document.querySelectorAll('[data-nav="light"]')];

if (nav && lightSections.length) {
  let navQueued = false;

  function updateNav() {
    navQueued = false;
    const navRect = nav.getBoundingClientRect();
    const y = navRect.top + navRect.height / 2;
    const overLight = lightSections.some((section) => {
      const rect = section.getBoundingClientRect();
      return rect.top <= y && rect.bottom >= y;
    });
    nav.classList.toggle("nav--dark", overLight);
    if (navDrawer) {
      navDrawer.classList.toggle("nav--dark", overLight);
    }
  }

  function queueNav() {
    if (navQueued) return;
    navQueued = true;
    requestAnimationFrame(updateNav);
  }

  window.addEventListener("scroll", queueNav, { passive: true });
  window.addEventListener("resize", queueNav);
  updateNav();
}

/* ==========================================================================
   Mobile navigation drawer
   (navToggle / navDrawer are declared above the nav-dark block)
   ========================================================================== */

if (navToggle && navDrawer) {
  function toggleDrawer(open) {
    const shouldOpen = open !== undefined ? open : !navDrawer.classList.contains("is-open");
    navDrawer.classList.toggle("is-open", shouldOpen);
    navToggle.classList.toggle("is-active", shouldOpen);
    navToggle.setAttribute("aria-expanded", String(shouldOpen));
    navDrawer.setAttribute("aria-hidden", String(!shouldOpen));
  }

  navToggle.addEventListener("click", () => toggleDrawer());

  // Close when clicking any link inside the drawer
  navDrawer.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => toggleDrawer(false));
  });

  // Close on Escape or click outside
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && navDrawer.classList.contains("is-open")) {
      toggleDrawer(false);
    }
  });

  document.addEventListener("click", (e) => {
    if (
      navDrawer.classList.contains("is-open") &&
      !navDrawer.contains(e.target) &&
      !navToggle.contains(e.target)
    ) {
      toggleDrawer(false);
    }
  });
}

/* ==========================================================================
   Cursor image trail
   ========================================================================== */

const SPACING = 90; // px of pointer travel between images
const LIFETIME = 1150; // ms each image lives (pop 260 → hold → shrink 450)
const TRAIL_MAX_PER_MOVE = 6;
const TRAIL_IMAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `assets/trail/c${n}.png`);

const trail = document.getElementById("trail");

// Desktop only: the trail is mouse-driven (touch pointers are ignored), so
// preloading nine stickers on a phone is ~1.4 MB of download it can never use.
if (trail && !isMobile) {
  // Preload so the first images don't pop in blank.
  TRAIL_IMAGES.forEach((src) => {
    const img = new Image();
    img.src = src;
  });

  let pressed = false;
  let imageIndex = 0;
  let lastX = 0;
  let lastY = 0;

  const random = (min, max) => min + Math.random() * (max - min);

  function spawn(x, y, dirX = 0, dirY = 0) {
    const img = document.createElement("img");
    img.src = TRAIL_IMAGES[imageIndex];
    img.alt = "";
    img.decoding = "async";
    imageIndex = (imageIndex + 1) % TRAIL_IMAGES.length;

    const width = random(110, 180);
    const tilt = random(-20, 20);
    const spin = tilt < 0 ? -18 : 18; // keeps rotating the way it leans
    // Nudge slightly in the direction of travel.
    img.style.width = `${width}px`;
    img.style.left = `${x + dirX * 14}px`;
    img.style.top = `${y + dirY * 14}px`;
    trail.appendChild(img);

    const t = (dy, rot, scale) =>
      `translate(-50%, -50%) translateY(${dy}px) rotate(${rot}deg) scale(${scale})`;

    const anim = img.animate(
      [
        { offset: 0, transform: t(0, tilt, 0), opacity: 1, easing: "cubic-bezier(0.34, 1.7, 0.64, 1)" },
        { offset: 260 / LIFETIME, transform: t(0, tilt, 1), opacity: 1, easing: "ease-out" },
        { offset: 700 / LIFETIME, transform: t(0, tilt + spin * 0.15, 0.94), opacity: 1, easing: "cubic-bezier(0.55, 0, 0.75, 0.2)" },
        { offset: 1, transform: t(40, tilt + spin, 0.1), opacity: 0 },
      ],
      { duration: LIFETIME, fill: "forwards" }
    );
    anim.onfinish = () => img.remove();
  }

  function endTrail() {
    if (!pressed) return;
    pressed = false;
    document.body.classList.remove("is-trailing");
  }

  window.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "touch" || e.button !== 0) return;
    pressed = true;
    lastX = e.clientX;
    lastY = e.clientY;
    document.body.classList.add("is-trailing");
    spawn(lastX, lastY);
  });

  window.addEventListener("pointermove", (e) => {
    if (!pressed || e.pointerType === "touch") return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    const dist = Math.hypot(dx, dy);
    const steps = Math.floor(dist / SPACING);
    if (!steps) return;

    const dirX = dx / dist;
    const dirY = dy / dist;
    // Fast strokes: spread at most TRAIL_MAX_PER_MOVE images evenly up to the cursor.
    const count = Math.min(steps, TRAIL_MAX_PER_MOVE);
    const step = steps > TRAIL_MAX_PER_MOVE ? dist / count : SPACING;

    for (let i = 1; i <= count; i++) {
      spawn(lastX + dirX * step * i, lastY + dirY * step * i, dirX, dirY);
    }
    lastX += dirX * step * count;
    lastY += dirY * step * count;
  });

  window.addEventListener("pointerup", endTrail);
  window.addEventListener("pointercancel", endTrail);
  window.addEventListener("blur", endTrail);
}

/* ==========================================================================
   Active nav link highlight via scroll spy
========================================================================== */
const sections = document.querySelectorAll('[data-section]');
const navLinks = document.querySelectorAll('.nav__links a');
if (sections.length && navLinks.length) {
  const onScroll = () => {
    let current = '';
    sections.forEach(sec => {
      if (window.scrollY >= sec.offsetTop - 200) {
        current = sec.getAttribute('data-section');
      }
    });
    navLinks.forEach(a => {
      a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ==========================================================================
   Smooth scroll with offset compensation
========================================================================== */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      const offset = 100;
      const top = target.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  });
});
