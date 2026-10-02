# Wang Koo Portfolio — Step-by-Step Prompt Guide

A sequence of prompts that rebuilds this single-page portfolio from an empty folder. Paste them into Claude Code **one at a time, in order**, and check the result in the browser after each step before moving on.

---

## Before you start

Set up the project folder so it looks like this:

```
Opus Try/
└── assets/
    ├── Video Scrub.mp4   ← 8s, 24fps clip that orbits a 3D scene (used for the hero scrub)
    ├── c1.png            ← transparent PNG sticker (purple </> badge)
    ├── c2.png            ← transparent PNG sticker
    ├── c3.png            ← transparent PNG sticker ("Designer" torn paper)
    └── c4.png            ← transparent PNG sticker
```

- The four `c*.png` images must have **transparent backgrounds**.
- You need **Node.js** installed. It's used for a tiny local server, because the video frames can't be read when you double-click `index.html` (the `file://` protocol).

---

## Step 1 — Project files and local server

```text
In this folder, create index.html, style.css and script.js. Link the CSS in the head
and the JS just before </body>. Load the Oswald font from Google Fonts (weights
300, 400, 500, 600, 700) with preconnect tags. Page title: "Wang Koo — Designer",
plus a meta description: "Wang Koo is a designer from Indonesia crafting brands,
interfaces and 3D worlds."

Also create .claude/serve.js: a minimal Node static server (no dependencies) on
port 5500 that serves the project root, sets correct content types for html, css,
js, mp4, png, jpg and svg, and supports HTTP Range requests so the video can seek.
Add a .claude/launch.json named "portfolio" that runs `node .claude/serve.js` on
port 5500, then start it and open the page.
```

---

## Step 2 — Design system (iOS-style glass)

```text
Set up the design system in style.css. The site is black and white with an Apple
iOS-style frosted "glass" look, and every heading is uppercase Oswald.

:root tokens:
- --black #0a0a0a, --ink #111, --white #f5f5f3, --muted rgba(245,245,243,0.62)
- --glass-bg rgba(255,255,255,0.12), --glass-bg-strong rgba(255,255,255,0.18)
- --glass-border rgba(255,255,255,0.28)
- --glass-blur: blur(22px) saturate(180%)
- --glass-shadow: 0 10px 40px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.45),
  inset 0 -1px 0 rgba(255,255,255,.08)
- --radius 28px, --gutter 16px, --font "Oswald", sans-serif

Base: border-box everywhere, black body, white text, smooth scrolling,
overflow-x: clip, links inherit color with no underline. A .container is
min(1200px, 100% - 2*gutter) wide and centered. An .eyebrow is a small uppercase
label (0.85rem, 0.2em letter-spacing, muted color). An .outline class makes text
transparent with a 1.5px white -webkit-text-stroke.

Components:
- .glass: translucent bg, backdrop-filter blur (with -webkit- prefix), 1px glass
  border, glass shadow, radius. Add a ::before with a 160deg white-to-transparent
  gradient at mix-blend-mode: soft-light to act as a specular sheen.
- .btn: pill button (999px radius), uppercase, 0.08em tracking, lifts 2px on hover,
  and a .btn__arrow child that slides 4px right on hover. Variants: .btn--light
  (white bg, dark text, soft shadow), .btn--sm, .btn--lg. A .btn.glass brightens
  to --glass-bg-strong on hover.
- .chip: small uppercase glass pill. A .dot inside it is an 8px green (#4ade80)
  circle with an infinite pulsing box-shadow ring.
- .tag: small uppercase glass pill used for skill labels.
```

---

## Step 3 — Floating glass navigation

```text
Add a fixed, centered glass nav bar: 18px from the top, same width as .container,
fully rounded, z-index 50. Left: the logo "WANG KOO", where "WANG" is bold and "KOO"
is light weight. Middle: links About (#about), Work (#work) and Words
(#testimonials), uppercase with 0.14em tracking, 75% opacity, 100% on hover.
Right: a small white "Contact" pill button linking to #contact. Hide the middle
links below 640px.
```

---

## Step 4 — Hero layout

```text
Build the hero section (#hero): full viewport height (100vh with a 100svh
override), min-height 620px, overflow hidden. Layers from back to front:

1. A <canvas id="heroCanvas"> covering the whole section (the video will be drawn
   here in the next step).
2. A shade overlay: a left-to-right dark gradient (rgba(0,0,0,.55) fading out by
   55%) plus a bottom-to-top one (fading out by 40%) so the text stays readable.
3. Content pinned 56px from the bottom, inside the container, as a flex row:
   LEFT
   - glass chip with a pulsing green dot: "Available for projects, 2026"
   - h1 "WANG<br>KOO" at clamp(4.5rem, 13vw, 11.5rem), weight 700, line-height 0.86
   - one-line intro, light weight, max 420px wide: "Designer from Indonesia
     crafting brands, interfaces and playful 3D worlds."
   - two buttons: white "Get in touch →" (#contact) and glass "View work" (#work)
   RIGHT (a 220px column of three glass stat cards, hidden below 900px)
   - "08+" / "Years designing"
   - "120" / "Projects shipped"
   - "Based in" / "JAKARTA, ID" / the live local time in Jakarta
4. A small glass pill mouse icon centered at the bottom whose inner dot animates
   downward on a loop (scroll cue), linking to #about.

In script.js, fill the time card with the current time in Asia/Jakarta using
Intl.DateTimeFormat (en-GB, 2-digit hour and minute) followed by " WIB", and
update it every 30 seconds.
```

---

## Step 5 — Cursor-driven video scrub (the key feature)

```text
Make the hero canvas a cursor-driven video scrub using assets/Video Scrub.mp4
(reference it as "assets/Video%20Scrub.mp4").

On load, split the video into 96 still frames held in memory as ImageBitmaps,
downscaled so the longest side is at most 1280px. Don't seek frame by frame; it's
very slow on videos with few keyframes. Instead:
  Pass 1: play the video muted at 2x speed and use requestVideoFrameCallback to
          call createImageBitmap on each presented frame, storing it in the slot
          that matches its mediaTime. Repeat the playthrough up to 3 times if
          slots are still empty.
  Pass 2: seek only to the slots that are still missing.
Stop just before the video's end (duration - 0.05s) so the last slot gets a real
frame.

Map the mouse's X position across the hero (0 on the left, 1 on the right) to a
frame index. Touch drag works the same way. Ease toward the target in a
requestAnimationFrame loop (current += (target - current) * 0.12) and only redraw
when the frame index changes. Draw frames "object-fit: cover" style, with the
canvas sized to the hero times devicePixelRatio (capped at 2), and redraw on
resize. While frames are still loading, show the nearest frame that has loaded.

Keep FRAME_COUNT, MAX_FRAME_SIDE, PLAYBACK_RATE, CAPTURE_RUNS and EASE as
constants at the top of the file.
```

---

## Step 6 — Glass loader

```text
Add a loader overlay inside the hero (z-index 60) with a dark radial-gradient
background. Centered in it is a glass pill containing the label "LOADING", a thin
4px progress bar (white fill on a 15% white track) and a percentage. Update the
bar as frames are captured. When all 96 frames are ready, add .is-done to fade the
loader out over 0.7s and hide it.
```

---

## Step 7 — Section 2: big marquee and About

```text
Add section #about on the black background (padding 120px top, 140px bottom).

Marquee: two rows of giant uppercase text scrolling across the full width, both
tilted -2deg, in opposite directions.
- Row 1 (moves left): "Brand Identity ✦ UI / UX ✦ 3D Design ✦ Motion ✦"
- Row 2 (moves right, .marquee--reverse): "Wang Koo ✦ Designer ✦ Indonesia ✦ Since 2018 ✦"
- Alternate between solid and .outline words. Text size clamp(4rem, 14vw, 13rem),
  weight 700. The ✦ separators are smaller and at 60% opacity.
- In JS, clone each track so the loop is seamless and move it with
  translate3d in a requestAnimationFrame loop at 60px/s, wrapping within one
  track width. Scroll velocity temporarily speeds it up (smoothed boost). Don't
  run the animation when prefers-reduced-motion is set.

About block, 120px below the marquee:
- eyebrow "(01) About"
- a large light-weight paragraph (clamp(1.6rem, 3.6vw, 3rem)): "I'm Wang Koo, a
  multidisciplinary designer working out of Jakarta. I build identities people
  remember, interfaces that feel effortless and 3D scenes with a sense of play,
  for studios and startups across Asia and beyond." Make "identities people
  remember" bold.
- a row of glass tags: Branding, Product Design, Blender / C4D, Figma, Art Direction
```

---

## Step 8 — Section 3: horizontal scroll projects

```text
Add section #work with a light background (#f1efec) and dark text. As you scroll
down, it pins to the screen and slides the projects sideways.

Structure: a tall section containing a sticky, 100vh-high inner panel with
overflow hidden. Inside the panel:
- header row: eyebrow "(02) Selected Work" on the left, and a counter
  "01 / 05" on the right
- a flex track (width: max-content), starting with an intro block ("SELECTED
  PROJECTS" in a big bold heading, plus "Scroll to explore a few favourites from
  the last couple of years.") followed by 5 project cards
- a thin 3px progress bar at the bottom

Each project card is min(560px, 82vw) wide, min(62vh, 560px) tall, with a 32px
radius. Its background is abstract CSS-gradient artwork, with a big "01"–"05"
number in the top-left using mix-blend-mode: overlay. A glass info bar is pinned
to the bottom showing the title, category and year. On hover the card lifts 6px
and the artwork scales to 1.04.
Projects:
  01 Kopi Senja: Brand identity · Packaging, 2025 (warm brown/orange with a sun circle)
  02 Lumen Bank: Mobile app · UI / UX, 2025 (deep navy with blue/violet glows)
  03 Pixel Pals: 3D characters · Motion, 2024 (pink with pink and yellow dots)
  04 Batik Now: Editorial · Art direction, 2024 (brown/gold with repeating rings)
  05 Orbit OS: Product design · Web, 2023 (near-black with thin orbit rings)

In JS: set the section's height to (track.scrollWidth - innerWidth) + innerHeight.
On scroll, progress = -section.top / distance, clamped between 0 and 1. Then
translate the track by -progress * distance, set the progress bar width, and
update the counter. Re-measure on resize and after document.fonts.ready.
```

---

## Step 9 — Section 4: testimonials

```text
Add section #testimonials on black (140px vertical padding). Behind the content,
add two large blurred color blobs (filter blur 80px, 55% opacity) that drift
slowly: a pink one (#e0529c, 520px) at the top-left and a blue one (#4f7cff, 460px)
at the bottom-right.

Content: eyebrow "(03) Kind Words", a huge heading "WHAT CLIENTS SAY", then a
3-column grid of glass quote cards (32px padding, min-height 300px). The middle
card is pushed down 60px so the row looks staggered. Each card has a
light-weight quote and a footer with a white circular initials avatar, a name and
a role:
  - AS · Ayu Setiawan, Founder, Kopi Senja
  - DL · Daniel Lim, Head of Product, Lumen
  - MR · Maya Rahman, Creative Lead, Orbit
Below 900px, stack the cards in one column and remove the stagger.
(These quotes are placeholders. Replace them with real ones before launch.)
```

---

## Step 10 — Section 5: footer

```text
Add footer #contact with an off-white background (--white), dark text, 40px
rounded top corners and 140px top padding.
- eyebrow "(04) Contact"
- huge heading "LET'S MAKE<br>SOMETHING GREAT" with "GREAT" in dark outline text
- a large dark pill button "hello@wangkoo.design →" (mailto link)
- a 4-column grid above a thin divider: Studio (Jakarta, Indonesia / Working
  worldwide), Social (Instagram, Dribbble, Behance, LinkedIn), Menu (About, Work,
  Words), and a round 64px light-glass "↑" back-to-top button
- a bottom row: "© 2026 Wang Koo" on the left, "Designed in Indonesia" on the right
- finally, a giant "WANG KOO" wordmark (22vw, weight 700, line-height 0.78),
  centered and slightly cut off by the bottom edge
```

---

## Step 11 — Nav adapts to light sections

```text
Mark the Work section and the footer with data-nav="light". In JS, on scroll,
check whether the nav's vertical center overlaps one of those sections, and if so
add .nav--dark to the nav: a faint dark glass background, dark border, dark text,
and the Contact button inverted to dark with white text. Transition background,
color and border over 0.35s.
```

---

## Step 12 — Cursor image trail

```text
Add a cursor effect: while the mouse button is held down, the images
assets/c1.png → c4.png pop out along the cursor's path, in order and looping,
leaving a trail before disappearing.

First, the originals are several MB each, so make 400px (longest side) copies in
assets/trail/ that keep the transparency, and use those.

- A fixed, full-screen layer (#trail) with pointer-events: none and z-index 100.
- On pointerdown (left button), spawn one image at the cursor. On pointermove
  while pressed, spawn a new image every 90px of travel, filling evenly along
  fast strokes (max 6 per move).
- Each image: random width 110–180px, random tilt of ±20deg, a soft drop-shadow,
  and a slight nudge in the direction of travel. Animate it with the Web
  Animations API, giving each keyframe its own easing:
    pop from scale 0 to 1 with a springy overshoot (≈260ms) → hold near full
    size until ~700ms → shrink to 0.1, drop 40px, rotate further and fade out
    (≈450ms). Remove the element when the animation finishes.
- Preload the four images. Add a body class while pressed that disables text
  selection. End the trail on pointerup, pointercancel and window blur.
- Keep SPACING and LIFETIME as constants.
```

---

## Step 13 — Responsive and accessibility pass

```text
Do a final responsive and accessibility pass:
- Below 900px: hide the hero stat cards, stack the testimonials, and make the
  footer grid 2 columns.
- Below 640px: hide the nav links, raise the hero content to 80px from the bottom,
  tighten section padding, and stack the footer bottom row.
- Under prefers-reduced-motion: turn off smooth scrolling, the pulsing dot, the
  scroll-cue and blob animations, and the marquee.
- Check there is no horizontal page scroll at phone width (375px).
```

---

## Step 14 — Run and verify

```text
Run it. Open http://localhost:5500 in the browser pane and check:
1. the loader reaches 100% and fades out
2. moving the cursor across the hero scrubs the video
3. the marquee rows scroll in opposite directions and speed up while scrolling
4. the Work section pins and slides horizontally, and the counter and bar update
5. the nav switches to dark over the Work section and the footer
6. holding the mouse and dragging leaves a c1→c4 image trail
7. the console shows no errors, on both desktop and mobile widths
```

---

### Troubleshooting notes

| Problem | Cause / fix |
|---|---|
| Hero stays black, or the loader shows "Error" | The page was opened as `file://`. Run `node .claude/serve.js` and open http://localhost:5500 |
| Loading takes 30+ seconds | Frames are being captured by seeking. Use the playback + `requestVideoFrameCallback` pass from Step 5 |
| Nav text vanishes on light sections | Step 11 is missing |
| Trail images show white boxes | The PNGs aren't transparent. Re-export them with an alpha channel |
| Page scrolls sideways on mobile | Make sure `overflow-x: clip` is on `html, body`, and that the marquee is inside an `overflow: hidden` section |
