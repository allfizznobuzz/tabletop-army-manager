import { useEffect } from "react";

// Sync CSS variable for sticky army header height to keep columns level at any width
export default function useStickyHeaderHeight(
  selector = ".army-column .column-header",
  cssVar = "--army-header-offset",
) {
  useEffect(() => {
    const root = document.documentElement;
    let rafId = 0;
    let lastH = 0;
    const measureAndSet = () => {
      if (rafId) return; // coalesce
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        let h = 0;
        document.querySelectorAll(selector).forEach((el) => {
          const rect = el.getBoundingClientRect();
          h = Math.max(h, Math.ceil(rect.height));
        });
        if (h && h !== lastH) {
          lastH = h;
          root.style.setProperty(cssVar, `${h}px`);
        }
      });
    };
    const ro = new ResizeObserver(() => measureAndSet());
    document.querySelectorAll(selector).forEach((el) => ro.observe(el));
    window.addEventListener("resize", measureAndSet);
    measureAndSet();
    return () => {
      window.removeEventListener("resize", measureAndSet);
      ro.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [selector, cssVar]);
}
