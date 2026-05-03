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
}

export default function Modal({
  open,
  onClose,
  children,
  className = "",
  closeOnOverlay = true,
  closeOnEsc = true,
  showClose = true,
  header,
}: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !closeOnEsc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, closeOnEsc, onClose]);

  // body 스크롤 잠금 (모달이 열린 동안)
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

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
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative bg-chalk-card border border-silver-mist rounded-3xl shadow-[--shadow-card] w-full ${className}`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {(header || showClose) && (
          <div className="flex items-start justify-between px-6 pt-6 pb-2">
            <div className="flex-1">{header}</div>
            {showClose && (
              <button
                onClick={onClose}
                className="text-slate-text hover:text-graphite cursor-pointer -mr-1"
                aria-label="닫기"
              >
                <RiCloseLine size={22} />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
