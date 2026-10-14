## 2024-06-15 - Mixed scroll listener anti-pattern
**Learning:** Found a codebase-specific performance anti-pattern where some scroll events (`queueNav`) correctly throttled via `requestAnimationFrame` while others (`updateWork`, `onScroll`) executed synchronously on every scroll tick. This inconsistency stresses the main thread unnecessarily.
**Action:** Always verify *all* scroll and resize listeners across a file when adding or auditing them, applying a consistent `requestAnimationFrame` queue to prevent layout thrashing and preserve framerate on complex animations.
