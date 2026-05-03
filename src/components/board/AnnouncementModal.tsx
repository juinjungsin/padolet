"use client";

import { useEffect, useState } from "react";
import { Announcement } from "@/lib/firestore";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { RiMegaphoneLine } from "react-icons/ri";

interface AnnouncementModalProps {
  sessionId: string;
  announcement: Announcement | null | undefined;
}

export default function AnnouncementModal({
  sessionId,
  announcement,
}: AnnouncementModalProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!announcement || !announcement.active || !announcement.id) {
      setOpen(false);
      return;
    }
    const dismissedKey = `padolet_ann_dismissed_${sessionId}`;
    const dismissedId = sessionStorage.getItem(dismissedKey);
    if (dismissedId === announcement.id) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [announcement, sessionId]);

  function handleClose() {
    if (announcement?.id) {
      sessionStorage.setItem(`padolet_ann_dismissed_${sessionId}`, announcement.id);
    }
    setOpen(false);
  }

  if (!announcement) return null;

  return (
    <Modal open={open} onClose={handleClose} className="max-w-md" showClose={false}>
      <div className="px-6 pt-6 pb-2">
        <span className="inline-flex items-center gap-1.5 bg-linen text-ink text-xs font-semibold px-3 py-1 rounded-full">
          <RiMegaphoneLine size={14} />
          공지
        </span>
      </div>
      <div className="px-6 pb-6">
        <p
          className="font-display text-xl text-graphite mb-4"
          style={{ fontWeight: 700, letterSpacing: "-0.4px" }}
        >
          새 공지가 도착했습니다
        </p>
        <p className="text-sm text-ink whitespace-pre-wrap leading-relaxed mb-6">
          {announcement.content}
        </p>
        <div className="flex justify-end">
          <Button onClick={handleClose}>확인</Button>
        </div>
      </div>
    </Modal>
  );
}
