"use client";

import { useEffect } from "react";

/**
 * Global ambient motion: scroll progress, header elevation, and the pointer
 * spotlight used by cards marked with `data-spotlight`.
 *
 * Everything here is decorative and disabled when the user prefers reduced
 * motion. No timers, no polling, no layout reads outside rAF.
 */
export function AmbientFx() {
  useEffect(() => {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const max = root.scrollHeight - window.innerHeight;
        const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
        root.style.setProperty("--scroll-progress", progress.toFixed(4));
        root.dataset.scrolled = window.scrollY > 8 ? "true" : "false";
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    let onPointerMove: ((event: PointerEvent) => void) | null = null;
    if (!reduceMotion) {
      onPointerMove = (event: PointerEvent) => {
        const target = (event.target as Element | null)?.closest?.("[data-spotlight]");
        if (!(target instanceof HTMLElement)) return;
        const rect = target.getBoundingClientRect();
        target.style.setProperty("--mx", `${Math.round(event.clientX - rect.left)}px`);
        target.style.setProperty("--my", `${Math.round(event.clientY - rect.top)}px`);
      };
      window.addEventListener("pointermove", onPointerMove, { passive: true });
    }

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      if (onPointerMove) window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return <div className="scroll-progress" aria-hidden="true" />;
}
