"use client";

import { ReactNode, useEffect, useId, useRef, useState } from "react";

export interface MenuItem {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  /** 링크 항목 (새 창이면 external) */
  href?: string;
  external?: boolean;
  danger?: boolean;
  /** 현재 켜진 상태 표시 (예: 잠금 중) */
  active?: boolean;
}

interface MenuProps {
  /** 트리거 버튼의 접근 가능한 이름 */
  label: string;
  trigger: ReactNode;
  items: MenuItem[];
  align?: "left" | "right";
  triggerClassName?: string;
}

/**
 * 키보드 접근 가능한 드롭다운 메뉴 (요구사항 4.3 — 더보기 메뉴, 5.3 — 키보드 탐색)
 * - Enter/Space/↓ 로 열고 첫 항목에 포커스, ↑ 로 열면 마지막 항목
 * - ↑↓ Home End 이동, Esc 닫고 트리거로 포커스 복귀, Tab 은 닫고 다음 요소로
 */
export default function Menu({ label, trigger, items, align = "right", triggerClassName = "" }: MenuProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);
  const menuId = useId();

  useEffect(() => {
    if (open) itemRefs.current[active]?.focus();
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openAt(index: number) {
    setActive(index);
    setOpen(true);
  }

  function close(focusTrigger: boolean) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function onTriggerKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      openAt(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      openAt(items.length - 1);
    }
  }

  function onMenuKeyDown(e: React.KeyboardEvent) {
    const last = items.length - 1;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i >= last ? 0 : i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? last : i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActive(last);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  if (items.length === 0) return null;

  const itemClass = (item: MenuItem) =>
    `touch-target w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left rounded-lg cursor-pointer outline-none focus-visible:bg-vellum hover:bg-vellum ${
      item.danger ? "text-terracotta" : "text-ink"
    }`;

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        title={label}
        onClick={() => (open ? close(false) : openAt(0))}
        onKeyDown={onTriggerKeyDown}
        className={triggerClassName}
      >
        {trigger}
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKeyDown}
          className={`absolute z-40 mt-1 min-w-[208px] max-w-[min(280px,calc(100vw-32px))] p-1.5 bg-chalk-card border border-silver-mist rounded-xl shadow-[0_8px_24px_rgba(24,59,86,0.14)] ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {items.map((item, i) => {
            const content = (
              <>
                {item.icon && (
                  <span className="shrink-0 text-slate-text" aria-hidden>
                    {item.icon}
                  </span>
                )}
                <span className="flex-1">{item.label}</span>
                {item.active && <span className="text-xs font-semibold text-blueprint">켜짐</span>}
              </>
            );
            const common = {
              ref: (el: HTMLElement | null) => {
                itemRefs.current[i] = el;
              },
              role: "menuitem",
              tabIndex: i === active ? 0 : -1,
              className: itemClass(item),
            };
            return item.href ? (
              <a
                key={item.key}
                {...common}
                href={item.href}
                target={item.external ? "_blank" : undefined}
                rel={item.external ? "noopener noreferrer" : undefined}
                onClick={() => close(false)}
              >
                {content}
              </a>
            ) : (
              <button
                key={item.key}
                {...common}
                type="button"
                onClick={() => {
                  close(true);
                  item.onSelect?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
