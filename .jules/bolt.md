## 2024-05-15 - Eliminating Layout Thrashing in Horizontal Scroll
**Learning:** Found a textbook case of layout thrashing in `updateWork`. Setting `workProgress.style.width` (layout write) was immediately followed by reading `card.offsetLeft` (layout read) in a loop, forcing synchronous reflows on every scroll frame.
**Action:** Always prefer `transform: scaleX` over `width` for progress bars. Cache element metrics (`offsetLeft`, `offsetWidth`) on resize rather than reading them continuously during scroll-driven animations.
