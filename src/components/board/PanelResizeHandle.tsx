"use client";
import { useEffect, useRef, useState } from "react";

export default function PanelResizeHandle() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(360);
  const dragging = useRef(false);
  function apply(value: number, persist = true) {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const next = Math.round(Math.max(280, Math.min(parent.clientWidth * 0.6, value)));
    parent.style.setProperty("--chat-width", `${next}px`);
    setWidth(next);
    if (persist) try { localStorage.setItem("padolet-chat-width-v1", String(next)); } catch { /* Storage may be unavailable. */ }
  }
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    let preferred = 360;
    try { const stored = Number(localStorage.getItem("padolet-chat-width-v1")); if (Number.isFinite(stored) && stored >= 280) preferred = stored; } catch { /* Use default. */ }
    parent.style.setProperty("--chat-width", `${preferred}px`);
    const observer = new ResizeObserver(() => {
      const panel = parent.querySelector<HTMLElement>("#chat-panel");
      if (panel && parent.clientWidth >= 1024) setWidth(Math.round(panel.getBoundingClientRect().width));
    });
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} role="separator" aria-label="보드와 대화 너비 조절" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={2000} aria-valuenow={width} tabIndex={0}
    className="hidden lg:flex w-3 shrink-0 items-center justify-center cursor-col-resize touch-none bg-vellum hover:bg-silver-mist focus:bg-silver-mist outline-none"
    title="끌거나 좌우 방향키로 크기 조절 · 두 번 클릭하면 초기화"
    onDoubleClick={() => apply(360)}
    onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); apply(width + (e.key === "ArrowLeft" ? 20 : -20)); } if (e.key === "Home") { e.preventDefault(); apply(360); } }}
    onPointerDown={e => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); }}
    onPointerMove={e => { if (dragging.current && ref.current?.parentElement) apply(ref.current.parentElement.getBoundingClientRect().right - e.clientX, false); }}
    onPointerUp={() => { dragging.current = false; apply(width); }}
    onPointerCancel={() => { dragging.current = false; }}><span aria-hidden className="h-10 w-1 rounded bg-slate-400" /></div>;
}
