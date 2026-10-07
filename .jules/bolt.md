## 2023-10-24 - Layout Thrashing in Scroll Handlers
**Learning:** Reading layout properties like `offsetLeft` or `offsetWidth` immediately after writing layout properties like `style.transform` inside a `scroll` event handler causes layout thrashing, severely degrading performance.
**Action:** Cache static layout properties (like `offsetLeft` and `offsetWidth`) during `resize` events (e.g. `measureWork`), and use `requestAnimationFrame` to debounce the `scroll` event handler to ensure DOM updates happen in batches instead of synchronously.
