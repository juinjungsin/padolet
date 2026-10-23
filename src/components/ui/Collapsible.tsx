"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";

interface CollapsibleProps {
  children: ReactNode;
  /** 접힌 상태의 최대 높이(px) */
  maxHeight?: number;
}

/**
 * 긴 글을 일정 높이에서 접고 펼쳐보기 제공 (요구사항 5.2).
 * 내용이 실제로 넘칠 때만 버튼을 보인다. 첨부·답글·상태는 이 영역 밖에 두어 접혀도 접근 가능.
 */
export default function Collapsible({ children, maxHeight = 240 }: CollapsibleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const id = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // 처음 관찰할 때도 콜백이 한 번 호출된다
    const ro = new ResizeObserver(() => setOverflowing(el.scrollHeight > maxHeight + 4));
    ro.observe(el);
    return () => ro.disconnect();
  }, [maxHeight]);

  const collapsed = overflowing && !expanded;

  return (
    <div>
      <div
        id={id}
        ref={ref}
        className="relative overflow-hidden"
        style={collapsed ? { maxHeight } : undefined}
      >
        {children}
        {collapsed && (
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-chalk-card to-transparent pointer-events-none"
          />
        )}
      </div>
      {overflowing && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((v) => !v)}
          className="touch-target mt-1 inline-flex items-center h-8 text-sm font-semibold text-blueprint hover:underline cursor-pointer"
        >
          {expanded ? "접기" : "펼쳐보기"}
        </button>
      )}
    </div>
  );
}
