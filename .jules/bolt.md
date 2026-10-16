## 2023-10-16 - Prevent Layout Thrashing in Scroll Handlers
**Learning:** Found O(N) layout thrashing inside scroll event handlers. Reading `offsetLeft`, `offsetWidth`, and `offsetTop` synchronously after making style/DOM changes blocks the main thread during high-frequency events like scrolling.
**Action:** Always decouple DOM layout reads from DOM writes. Cache element metrics (e.g., offsets and dimensions) during `resize` or initialization, and wrap scroll handlers inside `requestAnimationFrame` to limit execution to screen refresh rate and prevent layout thrashing.
