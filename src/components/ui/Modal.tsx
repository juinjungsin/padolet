"use client";

import { ReactNode, useEffect, useRef } from "react";
import { RiCloseLine } from "react-icons/ri";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** ESC 또는 오버레이 클릭으로 닫히지 않게 하려면 false */
  closeOnOverlay?: boolean;
  closeOnEsc?: boolean;
  /** 우상단 X 버튼 표시 여부 */
  showClose?: boolean;
  /** 좌상단/내부에 표시할 헤더 영역 (선택) */
  header?: ReactNode;
  /** 스크린리더용 대화상자 이름 (제목 요소 id가 있으면 labelledBy 사용) */
  label?: string;
  labelledBy?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * 공통 모달 (요구사항 5.3 — 키보드 탐색·모달 닫기·포커스 복귀)
 * - 열릴 때 모달 안 첫 입력 요소(없으면 대화상자)로 포커스 이동
 * - Tab/Shift+Tab은 모달 안에서만 순환
 * - 닫히면 모달을 연 요소로 포커스 복귀
 */
export default function Modal({
  open,
  onClose,
  children,
  className = "",
  closeOnOverlay = true,
  closeOnEsc = true,
  showClose = true,
  header,
  label,
  labelledBy,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // 최신 onClose를 effect 재실행 없이 참조 (부모가 매 렌더 새 함수를 넘겨도 포커스가 튀지 않게)
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    if (dialog) {
      // 입력창이 있으면 입력창, 없으면 대화상자 자체 (닫기 버튼에 포커스가 가면 Enter로 바로 닫히는 문제 방지)
      const firstField = dialog.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])");
      (firstField ?? dialog).focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEsc) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialogRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    // body 스크롤 잠금 (모달이 열린 동안)
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [open, closeOnEsc]);

  if (!open) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (!closeOnOverlay) return;
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onMouseDown={handleOverlayClick}
      className="fixed inset-0 bg-graphite/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy ? undefined : label}
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className={`relative bg-chalk-card border border-silver-mist rounded-3xl shadow-[--shadow-card] w-full outline-none ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(header || showClose) && (
          <div className="flex items-start justify-between px-6 pt-5 pb-2">
            <div className="flex-1">{header}</div>
            {showClose && (
              <button
                onClick={onClose}
                className="touch-target inline-flex items-center justify-center w-9 h-9 -mr-2 rounded-full text-slate-text hover:text-graphite hover:bg-vellum cursor-pointer"
                aria-label="닫기"
              >
                <RiCloseLine size={22} aria-hidden />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
